import { eq, sql } from "drizzle-orm";
import { env } from "~/env";
import { db } from "~/server/db";
import {
  annualRecords,
  dataAuditLogs,
  datasets,
  facilities,
  units,
  type NewAnnualRecord,
  type NewDataAuditLog,
} from "~/server/db/schema";

const CAMPD_BASE_URL = "https://api.epa.gov/easey";

export interface CampdAnnualEmissionsItem {
  stateCode: string;
  facilityName: string;
  facilityId: number;
  unitId: string;
  unit_id?: string;
  year: number;
  countOpTime?: number;
  sumOpTime?: number | null;
  grossLoad?: number | null; // MWh
  heatInput?: number | null; // MMBtu
  co2Mass?: number | null; // short tons
  so2Mass?: number | null; // short tons
  noxMass?: number | null; // short tons
  primaryFuelInfo?: string | null;
  secondaryFuelInfo?: string | null;
  unitType?: string | null;
  so2ControlInfo?: string | null;
  noxControlInfo?: string | null;
  pmControlInfo?: string | null;
  hgControlInfo?: string | null;
  programCodeInfo?: string | null;
}

export interface CampdApiResponse {
  items: CampdAnnualEmissionsItem[];
}

export interface SyncOptions {
  year: number;
  stateCode?: string;
  facilityId?: number;
  perPage?: number;
  maxPages?: number;
}

/**
 * Fetch raw annual apportioned emissions from EPA CAMPD API
 */
export async function fetchCampdAnnualEmissions(
  params: {
    year: number;
    stateCode?: string;
    facilityId?: number;
    page: number;
    perPage: number;
  },
  apiKey?: string,
): Promise<{ items: CampdAnnualEmissionsItem[]; totalCount: number }> {
  const key = apiKey ?? env.CAMPD_API;
  if (!key) {
    throw new Error(
      "CAMPD_API key is not configured in environment variables.",
    );
  }

  const query = new URLSearchParams();
  query.set("year", params.year.toString());
  query.set("page", params.page.toString());
  query.set("perPage", params.perPage.toString());

  if (params.stateCode && params.stateCode !== "ALL") {
    query.set("stateCode", params.stateCode.toUpperCase());
  }

  if (params.facilityId) {
    query.set("facilityId", params.facilityId.toString());
  }

  const url = `${CAMPD_BASE_URL}/emissions-mgmt/emissions/apportioned/annual?${query.toString()}`;

  const response = await fetch(url, {
    headers: {
      "x-api-key": key,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `CAMPD API error (${response.status} ${response.statusText}): ${errorText}`,
    );
  }

  const totalCountHeader = response.headers.get("x-total-count");
  const totalCount = totalCountHeader
    ? Number.parseInt(totalCountHeader, 10)
    : 0;
  const data = (await response.json()) as CampdApiResponse;

  return {
    items: data.items ?? [],
    totalCount: Number.isNaN(totalCount)
      ? (data.items?.length ?? 0)
      : totalCount,
  };
}

export interface AnomalyInput {
  heatInputMMBtu: number;
  co2MassTons: number;
  grossGenerationMWh: number;
  operatingHours: number;
  heatRateMMBtuMWh: number | null;
}

export interface AnomalyFlag {
  flagType:
    "ZERO_EMISSIONS_HIGH_HEAT" | "PHANTOM_GENERATION" | "EXTREME_HEAT_RATE";
  severity: "WARN" | "ERROR";
  details: string;
}

/**
 * Pure evaluation function for EPA physical sanity checks (PRD Section 3.3)
 */
export function evaluatePhysicalSanityRules(
  input: AnomalyInput,
): AnomalyFlag[] {
  const flags: AnomalyFlag[] = [];

  // Rule 1: ZERO_EMISSIONS_HIGH_HEAT
  if (input.heatInputMMBtu > 1000 && input.co2MassTons === 0) {
    flags.push({
      flagType: "ZERO_EMISSIONS_HIGH_HEAT",
      severity: "ERROR",
      details: `Heat input was ${input.heatInputMMBtu.toLocaleString()} MMBtu, but CO2 reported was 0.0 tons.`,
    });
  }

  // Rule 2: PHANTOM_GENERATION
  if (input.grossGenerationMWh > 0 && input.operatingHours === 0) {
    flags.push({
      flagType: "PHANTOM_GENERATION",
      severity: "ERROR",
      details: `Gross generation was ${input.grossGenerationMWh.toLocaleString()} MWh while operating time was 0 hours.`,
    });
  }

  // Rule 3: EXTREME_HEAT_RATE
  if (
    input.heatRateMMBtuMWh !== null &&
    (input.heatRateMMBtuMWh > 25.0 || input.heatRateMMBtuMWh < 5.0)
  ) {
    flags.push({
      flagType: "EXTREME_HEAT_RATE",
      severity: "WARN",
      details: `Heat rate of ${input.heatRateMMBtuMWh.toFixed(2)} MMBtu/MWh is outside normal thermal envelope (5.0 - 25.0).`,
    });
  }

  return flags;
}

/**
 * Optimized Ingestion Engine:
 * Batches records in memory, executes physical sanity checks,
 * calculates derived efficiency metrics, and commits in high-throughput chunks.
 */
export async function syncCampdAnnualEmissions(options: SyncOptions) {
  const year = options.year;
  const perPage = Math.min(options.perPage ?? 500, 500);
  const maxPages = options.maxPages ?? 10;

  // 1. Preload facility IDs and unit keys into memory maps for fast O(1) resolution
  const existingFacRows = await db
    .select({ id: facilities.id })
    .from(facilities);
  const facilitySet = new Set(existingFacRows.map((f) => f.id));

  const existingUnitRows = await db
    .select({
      id: units.id,
      facilityId: units.facilityId,
      unitId: units.unitId,
    })
    .from(units);
  const unitMap = new Map<string, string>();
  for (const u of existingUnitRows) {
    unitMap.set(`${u.facilityId}:${u.unitId}`, u.id);
  }

  // 2. Create Dataset record for batch auditing
  const datasetId = crypto.randomUUID();
  const datasetName =
    options.stateCode && options.stateCode !== "ALL"
      ? `CAMPD API ${year} [${options.stateCode.toUpperCase()}]`
      : `CAMPD API ${year} Ingestion Batch`;

  await db.insert(datasets).values({
    id: datasetId,
    name: datasetName,
    source: "API",
    reportingYear: year,
    rawRecordCount: 0,
    validRecords: 0,
    flaggedRecords: 0,
  });

  let page = 1;
  let totalRawProcessed = 0;
  let validRecordsCount = 0;
  let flaggedRecordsCount = 0;
  const anomaliesSummary: Array<{
    facilityId: number;
    unitId: string;
    flagType: string;
    severity: string;
    details: string;
  }> = [];

  while (page <= maxPages) {
    const { items } = await fetchCampdAnnualEmissions({
      year,
      stateCode: options.stateCode,
      facilityId: options.facilityId,
      page,
      perPage,
    });

    if (!items || items.length === 0) {
      break;
    }

    const recordsToInsert: NewAnnualRecord[] = [];
    const auditLogsToInsert: NewDataAuditLog[] = [];
    const newFacilitiesToInsert: Array<typeof facilities.$inferInsert> = [];
    const newUnitsToInsert: Array<typeof units.$inferInsert> = [];

    for (const item of items) {
      totalRawProcessed++;
      const facilityId = item.facilityId;
      const unitId = item.unitId || item.unit_id;
      if (!facilityId || !unitId) continue;

      // Auto-create facility stub if missing
      if (!facilitySet.has(facilityId)) {
        facilitySet.add(facilityId);
        newFacilitiesToInsert.push({
          id: facilityId,
          name: item.facilityName || `Facility #${facilityId}`,
          stateCode: item.stateCode || "US",
        });
      }

      // Auto-create unit if missing
      const unitKey = `${facilityId}:${unitId}`;
      let unitInternalId = unitMap.get(unitKey);
      if (!unitInternalId) {
        unitInternalId = crypto.randomUUID();
        unitMap.set(unitKey, unitInternalId);
        newUnitsToInsert.push({
          id: unitInternalId,
          unitId,
          facilityId,
          unitType: item.unitType ?? null,
          primaryFuel: item.primaryFuelInfo ?? null,
          secondaryFuel: item.secondaryFuelInfo ?? null,
          noxControls: item.noxControlInfo ?? null,
          so2Controls: item.so2ControlInfo ?? null,
          pmControls: item.pmControlInfo ?? null,
          hgControls: item.hgControlInfo ?? null,
          programCode: item.programCodeInfo ?? null,
        });
      }

      // Metric normalization
      const operatingHours = item.sumOpTime ?? 0.0;
      const grossGenerationMWh = item.grossLoad ?? 0.0;
      const heatInputMMBtu = item.heatInput ?? 0.0;
      const co2MassTons = item.co2Mass ?? 0.0;
      const so2MassTons = item.so2Mass ?? 0.0;
      const noxMassTons = item.noxMass ?? 0.0;

      // Derived Efficiency Metrics (PRD Section 1.2 & 3.3)
      const co2IntensityLbsMWh =
        grossGenerationMWh > 0
          ? Math.round((co2MassTons * 2000.0) / grossGenerationMWh)
          : null;
      const heatRateMMBtuMWh =
        grossGenerationMWh > 0
          ? Number((heatInputMMBtu / grossGenerationMWh).toFixed(2))
          : null;

      // Physical Sanity Anomaly Engine (PRD Section 3.3)
      const flags = evaluatePhysicalSanityRules({
        heatInputMMBtu,
        co2MassTons,
        grossGenerationMWh,
        operatingHours,
        heatRateMMBtuMWh,
      });

      const annualRecordId = `${unitInternalId}_${year}`;

      recordsToInsert.push({
        id: annualRecordId,
        datasetId,
        facilityId,
        unitInternalId,
        year,
        operatingHours,
        grossGenerationMWh,
        heatInputMMBtu,
        co2MassTons,
        so2MassTons,
        noxMassTons,
        co2IntensityLbsMWh,
        heatRateMMBtuMWh,
      });

      validRecordsCount++;

      if (flags.length > 0) {
        flaggedRecordsCount++;
        for (const flag of flags) {
          auditLogsToInsert.push({
            id: crypto.randomUUID(),
            annualRecordId,
            flagType: flag.flagType,
            severity: flag.severity,
            details: flag.details,
          });

          anomaliesSummary.push({
            facilityId,
            unitId,
            ...flag,
          });
        }
      }
    }

    // High throughput chunked batch commits
    if (newFacilitiesToInsert.length > 0) {
      await db.insert(facilities).values(newFacilitiesToInsert);
    }
    if (newUnitsToInsert.length > 0) {
      await db.insert(units).values(newUnitsToInsert);
    }
    if (recordsToInsert.length > 0) {
      // Chunk inserts in batches of 50 to respect SQLite parameter limits
      for (let i = 0; i < recordsToInsert.length; i += 50) {
        const chunk = recordsToInsert.slice(i, i + 50);
        await db
          .insert(annualRecords)
          .values(chunk)
          .onConflictDoUpdate({
            target: [annualRecords.unitInternalId, annualRecords.year],
            set: {
              datasetId: sql`excluded.dataset_id`,
              operatingHours: sql`excluded.operating_hours`,
              grossGenerationMWh: sql`excluded.gross_generation_mwh`,
              heatInputMMBtu: sql`excluded.heat_input_mmbtu`,
              co2MassTons: sql`excluded.co2_mass_tons`,
              so2MassTons: sql`excluded.so2_mass_tons`,
              noxMassTons: sql`excluded.nox_mass_tons`,
              co2IntensityLbsMWh: sql`excluded.co2_intensity_lbs_mwh`,
              heatRateMMBtuMWh: sql`excluded.heat_rate_mmbtu_mwh`,
            },
          });
      }
    }

    if (auditLogsToInsert.length > 0) {
      for (let i = 0; i < auditLogsToInsert.length; i += 50) {
        const chunk = auditLogsToInsert.slice(i, i + 50);
        await db.insert(dataAuditLogs).values(chunk);
      }
    }

    page++;
  }

  // Update Dataset summary counts
  await db
    .update(datasets)
    .set({
      rawRecordCount: totalRawProcessed,
      validRecords: validRecordsCount,
      flaggedRecords: flaggedRecordsCount,
    })
    .where(eq(datasets.id, datasetId));

  return {
    datasetId,
    year,
    rawRecordCount: totalRawProcessed,
    validRecords: validRecordsCount,
    flaggedRecords: flaggedRecordsCount,
    anomalies: anomaliesSummary,
  };
}
