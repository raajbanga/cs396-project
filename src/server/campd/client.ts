import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { env } from "~/env";
import {
  computeCo2IntensityLbsMWh,
  computeHeatRateMMBtuMWh,
} from "~/lib/emissions-metrics";
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

/**
 * Zod Ingestion & Normalization Schema (PRD Section 3.1):
 * Resolves malalignment across CAMPD REST API (camelCase), snake_case,
 * and bulk EPA Custom Data Download (CDD) CSV headers into unified internal fields.
 */
const rawCampdRecordSchema = z.record(z.unknown()).transform((raw, ctx) => {
  const get = (...keys: string[]): unknown => {
    for (const k of keys) {
      if (raw[k] !== undefined && raw[k] !== null && raw[k] !== "") {
        return raw[k];
      }
    }
    return undefined;
  };

  const toNum = (val: unknown, fallback = 0): number => {
    if (typeof val === "number") return Number.isNaN(val) ? fallback : val;
    if (typeof val === "string") {
      const n = Number.parseFloat(val.replace(/,/g, "").trim());
      return Number.isNaN(n) ? fallback : n;
    }
    return fallback;
  };

  const toStr = (val: unknown): string | null => {
    if (typeof val === "string") {
      const s = val.trim();
      return s.length > 0 ? s : null;
    }
    if (typeof val === "number" || typeof val === "boolean") {
      return String(val);
    }
    return null;
  };

  const facIdVal = get(
    "facilityId",
    "facility_id",
    "Facility ID (ORISPL)",
    "Facility ID",
  );
  const facilityId = Math.round(toNum(facIdVal, 0));

  const unitId = toStr(get("unitId", "unit_id", "Unit ID"));
  const stateCode = (toStr(get("stateCode", "state", "State")) ?? "US")
    .toUpperCase()
    .slice(0, 2);
  const facilityName =
    toStr(get("facilityName", "facility_name", "Facility Name")) ??
    `Facility #${facilityId}`;
  const year = Math.round(
    toNum(get("year", "Year", "reportingYear", "opYear", "calendarYear"), 0),
  );

  if (!facilityId || !unitId || !year) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Missing mandatory facilityId, unitId, or year",
    });
    return z.NEVER;
  }

  return {
    facilityId,
    facilityName,
    stateCode,
    unitId,
    year,
    operatingHours: toNum(
      get(
        "sumOpTime",
        "operatingTime",
        "operatingHours",
        "Operating Time",
        "countOpTime",
      ),
      0,
    ),
    grossGenerationMWh: toNum(
      get("grossLoad", "grossGenerationMWh", "Gross Load (MW-h)"),
      0,
    ),
    heatInputMMBtu: toNum(
      get("heatInput", "heatInputMMBtu", "Heat Input (MMBtu)"),
      0,
    ),
    co2MassTons: toNum(get("co2Mass", "co2MassTons", "CO2 (short tons)"), 0),
    so2MassTons: toNum(get("so2Mass", "so2MassTons", "SO2 (short tons)"), 0),
    noxMassTons: toNum(get("noxMass", "noxMassTons", "NOx (short tons)"), 0),
    primaryFuel: toStr(
      get(
        "primaryFuelInfo",
        "primaryFuel",
        "primary_fuel",
        "Primary Fuel Type",
      ),
    ),
    secondaryFuel: toStr(
      get(
        "secondaryFuelInfo",
        "secondaryFuel",
        "secondary_fuel",
        "Secondary Fuel Type",
      ),
    ),
    unitType: toStr(get("unitType", "unit_type", "Unit Type")),
    so2Controls: toStr(
      get("so2ControlInfo", "so2Controls", "so2_controls", "SO2 Controls"),
    ),
    noxControls: toStr(
      get("noxControlInfo", "noxControls", "nox_controls", "NOx Controls"),
    ),
    pmControls: toStr(
      get("pmControlInfo", "pmControls", "pm_controls", "PM Controls"),
    ),
    hgControls: toStr(
      get("hgControlInfo", "hgControls", "hg_controls", "Hg Controls"),
    ),
    programCode: toStr(
      get("programCodeInfo", "programCode", "program_code", "Program Code"),
    ),
  };
});

type NormalizedCampdRecord = z.infer<typeof rawCampdRecordSchema>;

interface SyncOptions {
  year: number;
  stateCode?: string;
  facilityId?: number;
  perPage?: number;
  maxPages?: number;
}

async function fetchCampdAnnualEmissions(
  params: {
    year: number;
    stateCode?: string;
    facilityId?: number;
    page: number;
    perPage: number;
  },
  apiKey?: string,
): Promise<{ items: Record<string, unknown>[]; totalCount: number }> {
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
  const data = (await response.json()) as { items?: Record<string, unknown>[] };

  return {
    items: data.items ?? [],
    totalCount: Number.isNaN(totalCount)
      ? (data.items?.length ?? 0)
      : totalCount,
  };
}

interface AnomalyInput {
  heatInputMMBtu: number;
  co2MassTons: number;
  grossGenerationMWh: number;
  operatingHours: number;
  heatRateMMBtuMWh: number | null;
}

/**
 * Physical Sanity Audit Thresholds (PRD Section 3.3):
 * Standard thermodynamic and operational bounds for CEMS data.
 */
const AUDIT_THRESHOLDS = {
  ZERO_EMISSIONS_MIN_HEAT_INPUT_MMBTU: 1000,
  PHANTOM_GENERATION_MIN_MWH: 0,
  HEAT_RATE_MIN_MMBTU_MWH: 5.0,
  HEAT_RATE_MAX_MMBTU_MWH: 25.0,
} as const;

type AuditFlagType =
  "ZERO_EMISSIONS_HIGH_HEAT" | "PHANTOM_GENERATION" | "EXTREME_HEAT_RATE";

type AuditSeverity = "WARN" | "ERROR";

interface AnomalyFlag {
  flagType: AuditFlagType;
  severity: AuditSeverity;
  details: string;
}

/**
 * Pure evaluation function for EPA physical sanity checks (PRD Section 3.3)
 */
function evaluatePhysicalSanityRules(input: AnomalyInput): AnomalyFlag[] {
  const flags: AnomalyFlag[] = [];

  // Rule 1: ZERO_EMISSIONS_HIGH_HEAT
  if (
    input.heatInputMMBtu >
      AUDIT_THRESHOLDS.ZERO_EMISSIONS_MIN_HEAT_INPUT_MMBTU &&
    input.co2MassTons === 0
  ) {
    flags.push({
      flagType: "ZERO_EMISSIONS_HIGH_HEAT",
      severity: "ERROR",
      details: `Heat input was ${input.heatInputMMBtu.toLocaleString()} MMBtu, but CO2 reported was 0.0 tons.`,
    });
  }

  // Rule 2: PHANTOM_GENERATION
  if (
    input.grossGenerationMWh > AUDIT_THRESHOLDS.PHANTOM_GENERATION_MIN_MWH &&
    input.operatingHours === 0
  ) {
    flags.push({
      flagType: "PHANTOM_GENERATION",
      severity: "ERROR",
      details: `Gross generation was ${input.grossGenerationMWh.toLocaleString()} MWh while operating time was 0 hours.`,
    });
  }

  // Rule 3: EXTREME_HEAT_RATE
  if (
    input.heatRateMMBtuMWh !== null &&
    (input.heatRateMMBtuMWh > AUDIT_THRESHOLDS.HEAT_RATE_MAX_MMBTU_MWH ||
      input.heatRateMMBtuMWh < AUDIT_THRESHOLDS.HEAT_RATE_MIN_MMBTU_MWH)
  ) {
    flags.push({
      flagType: "EXTREME_HEAT_RATE",
      severity: "WARN",
      details: `Heat rate of ${input.heatRateMMBtuMWh.toFixed(2)} MMBtu/MWh is outside normal thermal envelope (${AUDIT_THRESHOLDS.HEAT_RATE_MIN_MMBTU_MWH.toFixed(1)} - ${AUDIT_THRESHOLDS.HEAT_RATE_MAX_MMBTU_MWH.toFixed(1)}).`,
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
    flagType: AuditFlagType;
    severity: AuditSeverity;
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

    // 1. Zod normalization & in-memory composite natural key (facilityId, unitId, year) deduplication
    const dedupedBatch = new Map<string, NormalizedCampdRecord>();
    for (const rawItem of items) {
      totalRawProcessed++;
      const res = rawCampdRecordSchema.safeParse(rawItem);
      if (!res.success) continue;
      const rec = res.data;
      dedupedBatch.set(`${rec.facilityId}:${rec.unitId}:${rec.year}`, rec);
    }

    for (const item of dedupedBatch.values()) {
      const { facilityId, unitId } = item;

      // Auto-create facility stub if missing
      if (!facilitySet.has(facilityId)) {
        facilitySet.add(facilityId);
        newFacilitiesToInsert.push({
          id: facilityId,
          name: item.facilityName,
          stateCode: item.stateCode,
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
          unitType: item.unitType,
          primaryFuel: item.primaryFuel,
          secondaryFuel: item.secondaryFuel,
          noxControls: item.noxControls,
          so2Controls: item.so2Controls,
          pmControls: item.pmControls,
          hgControls: item.hgControls,
          programCode: item.programCode,
        });
      }

      // Normalized metrics from Zod output
      const {
        operatingHours,
        grossGenerationMWh,
        heatInputMMBtu,
        co2MassTons,
        so2MassTons,
        noxMassTons,
      } = item;

      const co2IntensityLbsMWh = computeCo2IntensityLbsMWh(
        co2MassTons,
        grossGenerationMWh,
      );
      const heatRateMMBtuMWh = computeHeatRateMMBtuMWh(
        heatInputMMBtu,
        grossGenerationMWh,
      );

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

      await db.delete(dataAuditLogs).where(
        inArray(
          dataAuditLogs.annualRecordId,
          recordsToInsert.map((record) => record.id!),
        ),
      );
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
