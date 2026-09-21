import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { env } from "~/env";
import { clampDateToYear } from "~/lib/date-options";
import {
  clampCampdDateRange,
  clampIsoDateToCampdPublished,
  clampYearToCampdPublished,
  getCampdPublishedYear,
  getCampdValidMonthsForYear,
  getDefaultCampdDateForYear,
  parseCampdQuarterEndFromError,
  toIsoDate,
} from "~/lib/campd-reporting-period";
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

export interface GranularOptions {
  facilityId: number;
  granularity: "hourly" | "daily" | "weekly" | "monthly" | "yearly";
  year?: number;
  date?: string; // YYYY-MM-DD for hourly or daily
  unitId?: string; // Optional unit filter
}

export interface GranularEmissionsItem {
  periodKey: string;
  periodLabel: string;
  subLabel?: string;
  operatingHours: number;
  grossGenerationMWh: number;
  heatInputMMBtu: number;
  co2MassTons: number;
  so2MassTons: number;
  noxMassTons: number;
  co2IntensityLbsMWh: number | null;
  heatRateMMBtuMWh: number | null;
}

export interface GranularEmissionsResult {
  facilityId: number;
  granularity: "hourly" | "daily" | "weekly" | "monthly" | "yearly";
  year: number;
  date?: string;
  unitId?: string;
  publishedThrough: string;
  source: "EPA_CAMPD_API" | "LOCAL_RECORDS" | "UNAVAILABLE";
  error?: string;
  summary: {
    totalOperatingHours: number;
    totalGenerationMWh: number;
    totalHeatInputMMBtu: number;
    totalCo2Tons: number;
    totalSo2Tons: number;
    totalNoxTons: number;
    co2IntensityLbsMWh: number | null;
    heatRateMMBtuMWh: number | null;
    itemCount: number;
  };
  items: GranularEmissionsItem[];
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface CampdFetchResult {
  items: Record<string, unknown>[];
  totalCount: number;
  error?: string;
}

function parseCampdItems(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as { items?: unknown }).items;
    if (Array.isArray(items)) return items as Record<string, unknown>[];
  }
  return [];
}

function extractCampdError(body: unknown, status: number): string {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
    if (Array.isArray(message)) {
      const joined = message
        .filter((part): part is string => typeof part === "string")
        .join(" ");
      if (joined) return joined;
    }
  }
  return `CAMPD API error (${status})`;
}

async function fetchCampdJson(
  path: string,
  query: URLSearchParams,
): Promise<CampdFetchResult> {
  const key = env.CAMPD_API;
  if (!key) {
    return {
      items: [],
      totalCount: 0,
      error: "CAMPD_API key is not configured.",
    };
  }

  try {
    const res = await fetch(`${CAMPD_BASE_URL}${path}?${query.toString()}`, {
      headers: { "x-api-key": key, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });

    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        items: [],
        totalCount: 0,
        error: extractCampdError(body, res.status),
      };
    }

    const items = parseCampdItems(body);
    const totalCountHeader = res.headers.get("x-total-count");
    const parsedTotal = totalCountHeader
      ? Number.parseInt(totalCountHeader, 10)
      : items.length;
    return {
      items,
      totalCount: Number.isNaN(parsedTotal) ? items.length : parsedTotal,
    };
  } catch (err) {
    return {
      items: [],
      totalCount: 0,
      error: err instanceof Error ? err.message : "CAMPD request failed",
    };
  }
}

async function fetchAllCampdPages(
  path: string,
  query: URLSearchParams,
  perPage = 500,
): Promise<CampdFetchResult> {
  const allItems: Record<string, unknown>[] = [];
  let page = 1;
  let totalCount = 0;
  let error: string | undefined;

  while (page <= 50) {
    const pageQuery = new URLSearchParams(query);
    pageQuery.set("page", String(page));
    pageQuery.set("perPage", String(perPage));
    const result = await fetchCampdJson(path, pageQuery);
    if (result.error) {
      error = result.error;
      break;
    }

    allItems.push(...result.items);
    totalCount = result.totalCount || allItems.length;
    if (result.items.length < perPage) break;
    if (totalCount > 0 && allItems.length >= totalCount) break;
    page += 1;
  }

  return {
    items: allItems,
    totalCount: totalCount || allItems.length,
    error,
  };
}

const PUBLISHED_THROUGH_TTL_MS = 60 * 60 * 1000;

let publishedThroughCache: { iso: string; expiresAt: number } | null = null;

function rememberPublishedThrough(iso: string) {
  publishedThroughCache = {
    iso,
    expiresAt: Date.now() + PUBLISHED_THROUGH_TTL_MS,
  };
}

function currentPublishedThrough(fallback: string): string {
  return publishedThroughCache?.iso ?? fallback;
}

function learnFromCampdError(error?: string): string | null {
  if (!error) return null;
  const parsed = parseCampdQuarterEndFromError(error);
  if (parsed) rememberPublishedThrough(parsed);
  return parsed;
}

export async function resolveCampdPublishedThrough(
  facilityId?: number,
): Promise<string> {
  if (publishedThroughCache && publishedThroughCache.expiresAt > Date.now()) {
    return publishedThroughCache.iso;
  }

  const fallback = toIsoDate(new Date());
  let probeId = facilityId;
  if (!probeId) {
    const [row] = await db
      .select({ id: facilities.id })
      .from(facilities)
      .limit(1);
    probeId = row?.id;
  }

  if (!probeId || !env.CAMPD_API) {
    rememberPublishedThrough(fallback);
    return fallback;
  }

  const year = new Date().getFullYear();
  const result = await fetchCampdJson(
    "/emissions-mgmt/emissions/apportioned/daily",
    new URLSearchParams({
      facilityId: String(probeId),
      beginDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      page: "1",
      perPage: "1",
    }),
  );
  const parsed = learnFromCampdError(result.error);
  const iso = parsed ?? (result.error ? fallback : `${year}-12-31`);
  rememberPublishedThrough(iso);
  return iso;
}

async function fetchCampdDateWindow(
  path: string,
  params: {
    facilityId: number;
    beginDate: string;
    endDate: string;
    publishedThrough: string;
  },
): Promise<CampdFetchResult> {
  const range = clampCampdDateRange(
    params.beginDate,
    params.endDate,
    params.publishedThrough,
  );
  const queryFor = (beginDate: string, endDate: string) =>
    new URLSearchParams({
      facilityId: params.facilityId.toString(),
      beginDate,
      endDate,
    });

  const result = await fetchAllCampdPages(
    path,
    queryFor(range.beginDate, range.endDate),
  );
  const learned = learnFromCampdError(result.error);
  if (!learned || learned === params.publishedThrough) return result;

  const retryRange = clampCampdDateRange(
    params.beginDate,
    params.endDate,
    learned,
  );
  if (
    retryRange.beginDate === range.beginDate &&
    retryRange.endDate === range.endDate
  ) {
    return result;
  }

  return fetchAllCampdPages(
    path,
    queryFor(retryRange.beginDate, retryRange.endDate),
  );
}

async function fetchCampdHourlyEmissions(params: {
  facilityId: number;
  beginDate: string;
  endDate: string;
  publishedThrough: string;
}): Promise<CampdFetchResult> {
  return fetchCampdDateWindow(
    "/emissions-mgmt/emissions/apportioned/hourly",
    params,
  );
}

async function fetchCampdDailyEmissions(params: {
  facilityId: number;
  beginDate: string;
  endDate: string;
  publishedThrough: string;
}): Promise<CampdFetchResult> {
  return fetchCampdDateWindow(
    "/emissions-mgmt/emissions/apportioned/daily",
    params,
  );
}

async function fetchCampdMonthlyEmissions(params: {
  facilityId: number;
  year: number;
  publishedThrough: string;
}): Promise<CampdFetchResult> {
  const requestMonths = async (publishedThrough: string) => {
    const months = getCampdValidMonthsForYear(params.year, publishedThrough);
    if (months.length === 0) {
      return {
        items: [] as Record<string, unknown>[],
        totalCount: 0,
        error: `No published CAMPD months for ${params.year}.`,
      };
    }

    return fetchAllCampdPages(
      "/emissions-mgmt/emissions/apportioned/monthly",
      new URLSearchParams({
        facilityId: params.facilityId.toString(),
        year: params.year.toString(),
        month: months.join("|"),
      }),
    );
  };

  const result = await requestMonths(params.publishedThrough);
  const learned = learnFromCampdError(result.error);
  if (!learned || learned === params.publishedThrough) return result;
  return requestMonths(learned);
}

function parseNum(val: unknown, fallback = 0): number {
  if (typeof val === "number") return Number.isNaN(val) ? fallback : val;
  if (typeof val === "string") {
    const n = Number.parseFloat(val.replace(/,/g, "").trim());
    return Number.isNaN(n) ? fallback : n;
  }
  return fallback;
}

function toCleanString(val: unknown): string {
  if (typeof val === "string") return val.trim();
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  return "";
}

function filterCampdRowsByUnit<T extends Record<string, unknown>>(
  rows: T[],
  unitId?: string,
): T[] {
  if (!unitId) return rows;
  const target = unitId.toLowerCase();
  return rows.filter((row) => {
    const id = toCleanString(row.unitId ?? row.unit_id);
    return id.toLowerCase() === target;
  });
}

function summarizeGranularItems(
  items: GranularEmissionsItem[],
  options?: { operatingHoursDecimals?: number },
): GranularEmissionsResult["summary"] {
  const totGen = items.reduce((s, i) => s + i.grossGenerationMWh, 0);
  const totHeat = items.reduce((s, i) => s + i.heatInputMMBtu, 0);
  const totCo2 = items.reduce((s, i) => s + i.co2MassTons, 0);
  const totSo2 = items.reduce((s, i) => s + i.so2MassTons, 0);
  const totNox = items.reduce((s, i) => s + i.noxMassTons, 0);
  const totHours = items.reduce((s, i) => s + i.operatingHours, 0);

  return {
    totalOperatingHours:
      options?.operatingHoursDecimals === 1
        ? Math.round(totHours * 10) / 10
        : Math.round(totHours),
    totalGenerationMWh: Math.round(totGen),
    totalHeatInputMMBtu: Math.round(totHeat),
    totalCo2Tons: Math.round(totCo2),
    totalSo2Tons: Number(totSo2.toFixed(1)),
    totalNoxTons: Number(totNox.toFixed(1)),
    co2IntensityLbsMWh: computeCo2IntensityLbsMWh(totCo2, totGen),
    heatRateMMBtuMWh: computeHeatRateMMBtuMWh(totHeat, totGen),
    itemCount: items.length,
  };
}

function emptyGranularResult(
  facilityId: number,
  granularity: "hourly" | "daily" | "weekly" | "monthly" | "yearly",
  year: number,
  unitId?: string,
  date?: string,
  error?: string,
  publishedThrough?: string,
): GranularEmissionsResult {
  return {
    facilityId,
    granularity,
    year,
    date,
    unitId,
    publishedThrough: currentPublishedThrough(
      publishedThrough ?? toIsoDate(new Date()),
    ),
    source: error ? "UNAVAILABLE" : "EPA_CAMPD_API",
    error,
    summary: {
      totalOperatingHours: 0,
      totalGenerationMWh: 0,
      totalHeatInputMMBtu: 0,
      totalCo2Tons: 0,
      totalSo2Tons: 0,
      totalNoxTons: 0,
      co2IntensityLbsMWh: null,
      heatRateMMBtuMWh: null,
      itemCount: 0,
    },
    items: [],
  };
}

/**
 * High-Resolution Multi-Granularity Aggregator:
 * Slices temporal stack telemetry into Hourly, Weekly, Monthly, or Yearly buckets.
 * Fetches all telemetry directly from EPA CAMPD API (with zero estimations).
 */
export async function fetchGranularEmissionsForFacility(
  options: GranularOptions,
): Promise<GranularEmissionsResult> {
  const facilityId = options.facilityId;
  const granularity = options.granularity;
  const publishedThrough = await resolveCampdPublishedThrough(facilityId);
  const year = clampYearToCampdPublished(
    options.year ?? getCampdPublishedYear(publishedThrough),
    publishedThrough,
  );
  const requestedUnitId =
    options.unitId && options.unitId !== "ALL" ? options.unitId : undefined;

  // 1. YEARLY GRANULARITY: Direct from relational store
  if (granularity === "yearly") {
    const annualRows = await db
      .select({
        year: annualRecords.year,
        unitId: units.unitId,
        grossGen: annualRecords.grossGenerationMWh,
        heatInput: annualRecords.heatInputMMBtu,
        co2: annualRecords.co2MassTons,
        so2: annualRecords.so2MassTons,
        nox: annualRecords.noxMassTons,
        hours: annualRecords.operatingHours,
      })
      .from(annualRecords)
      .innerJoin(units, eq(annualRecords.unitInternalId, units.id))
      .where(
        requestedUnitId
          ? and(
              eq(annualRecords.facilityId, facilityId),
              eq(units.unitId, requestedUnitId),
            )
          : eq(annualRecords.facilityId, facilityId),
      );

    const yearMap = new Map<
      number,
      {
        gen: number;
        heat: number;
        co2: number;
        so2: number;
        nox: number;
        hours: number;
      }
    >();

    for (const row of annualRows) {
      const cur = yearMap.get(row.year) ?? {
        gen: 0,
        heat: 0,
        co2: 0,
        so2: 0,
        nox: 0,
        hours: 0,
      };
      cur.gen += row.grossGen;
      cur.heat += row.heatInput;
      cur.co2 += row.co2;
      cur.so2 += row.so2;
      cur.nox += row.nox;
      cur.hours += row.hours;
      yearMap.set(row.year, cur);
    }

    const sortedYears = Array.from(yearMap.keys()).sort((a, b) => a - b);
    const items: GranularEmissionsItem[] = sortedYears.map((y) => {
      const data = yearMap.get(y)!;
      return {
        periodKey: `year_${y}`,
        periodLabel: String(y),
        subLabel: "Annual Aggregate",
        operatingHours: Math.round(data.hours),
        grossGenerationMWh: Math.round(data.gen),
        heatInputMMBtu: Math.round(data.heat),
        co2MassTons: Math.round(data.co2),
        so2MassTons: Number(data.so2.toFixed(1)),
        noxMassTons: Number(data.nox.toFixed(1)),
        co2IntensityLbsMWh: computeCo2IntensityLbsMWh(data.co2, data.gen),
        heatRateMMBtuMWh: computeHeatRateMMBtuMWh(data.heat, data.gen),
      };
    });

    return {
      facilityId,
      granularity: "yearly",
      year,
      unitId: requestedUnitId,
      publishedThrough: currentPublishedThrough(publishedThrough),
      source: "LOCAL_RECORDS",
      summary: summarizeGranularItems(items),
      items,
    };
  }

  // 2. MONTHLY GRANULARITY
  if (granularity === "monthly") {
    const monthlyResult = await fetchCampdMonthlyEmissions({
      facilityId,
      year,
      publishedThrough,
    });
    let rawMonthly = monthlyResult.items;

    rawMonthly = filterCampdRowsByUnit(rawMonthly, requestedUnitId);

    if (rawMonthly.length === 0) {
      return emptyGranularResult(
        facilityId,
        "monthly",
        year,
        requestedUnitId,
        undefined,
        monthlyResult.error,
        publishedThrough,
      );
    }

    const validMonths = getCampdValidMonthsForYear(
      year,
      currentPublishedThrough(publishedThrough),
    );
    const monthBuckets = new Map<
      number,
      {
        gen: number;
        heat: number;
        co2: number;
        so2: number;
        nox: number;
        hours: number;
      }
    >();

    for (const m of validMonths) {
      monthBuckets.set(m, {
        gen: 0,
        heat: 0,
        co2: 0,
        so2: 0,
        nox: 0,
        hours: 0,
      });
    }

    for (const row of rawMonthly) {
      const m = Number(row.month);
      const b = monthBuckets.get(m);
      if (!b) continue;
      b.gen += parseNum(row.grossLoad);
      b.heat += parseNum(row.heatInput);
      b.co2 += parseNum(row.co2Mass);
      b.so2 += parseNum(row.so2Mass);
      b.nox += parseNum(row.noxMass);
      b.hours += parseNum(row.sumOpTime);
    }

    const items: GranularEmissionsItem[] = Array.from(
      monthBuckets.entries(),
    ).map(([m, d]) => ({
      periodKey: `month_${m}`,
      periodLabel: MONTH_NAMES[m - 1] ?? `Month ${m}`,
      subLabel: `${year}`,
      operatingHours: Math.round(d.hours),
      grossGenerationMWh: Math.round(d.gen),
      heatInputMMBtu: Math.round(d.heat),
      co2MassTons: Math.round(d.co2),
      so2MassTons: Number(d.so2.toFixed(1)),
      noxMassTons: Number(d.nox.toFixed(1)),
      co2IntensityLbsMWh: computeCo2IntensityLbsMWh(d.co2, d.gen),
      heatRateMMBtuMWh: computeHeatRateMMBtuMWh(d.heat, d.gen),
    }));

    return {
      facilityId,
      granularity: "monthly",
      year,
      unitId: requestedUnitId,
      publishedThrough: currentPublishedThrough(publishedThrough),
      source: "EPA_CAMPD_API",
      summary: summarizeGranularItems(items),
      items,
    };
  }

  // 3. DAILY GRANULARITY
  if (granularity === "daily") {
    const targetDate = clampDateToYear(
      options.date ?? getDefaultCampdDateForYear(year, publishedThrough),
      year,
      publishedThrough,
    );
    const monthStr = targetDate.slice(5, 7) || "01";
    const mNum = parseInt(monthStr, 10) || 1;
    const daysInMonth = new Date(Date.UTC(year, mNum, 0)).getUTCDate();
    const beginDate = `${year}-${monthStr}-01`;
    const endDate = `${year}-${monthStr}-${String(daysInMonth).padStart(2, "0")}`;

    const dailyResult = await fetchCampdDailyEmissions({
      facilityId,
      beginDate,
      endDate,
      publishedThrough,
    });
    let rawDaily = dailyResult.items;

    rawDaily = filterCampdRowsByUnit(rawDaily, requestedUnitId);

    if (rawDaily.length === 0) {
      return emptyGranularResult(
        facilityId,
        "daily",
        year,
        requestedUnitId,
        targetDate,
        dailyResult.error,
        publishedThrough,
      );
    }

    const monthEndIso = `${year}-${monthStr}-${String(daysInMonth).padStart(2, "0")}`;
    const visibleEnd = clampIsoDateToCampdPublished(
      monthEndIso,
      currentPublishedThrough(publishedThrough),
    );
    const visibleDays = visibleEnd.startsWith(`${year}-${monthStr}-`)
      ? parseInt(visibleEnd.slice(8, 10), 10)
      : daysInMonth;

    const dayBuckets = new Map<
      number,
      {
        gen: number;
        heat: number;
        co2: number;
        so2: number;
        nox: number;
        hours: number;
        dateStr: string;
      }
    >();

    for (let d = 1; d <= visibleDays; d++) {
      dayBuckets.set(d, {
        gen: 0,
        heat: 0,
        co2: 0,
        so2: 0,
        nox: 0,
        hours: 0,
        dateStr: `${year}-${monthStr}-${String(d).padStart(2, "0")}`,
      });
    }

    for (const r of rawDaily) {
      const dateVal = toCleanString(r.date ?? r.opDate);
      const dayNum = parseInt(dateVal.slice(8, 10), 10);
      const b = dayBuckets.get(dayNum);
      if (!b) continue;
      b.gen += parseNum(r.grossLoad ?? r.grossGenerationMWh);
      b.heat += parseNum(r.heatInput ?? r.heatInputMMBtu);
      b.co2 += parseNum(r.co2Mass ?? r.co2MassTons);
      b.so2 += parseNum(r.so2Mass ?? r.so2MassTons);
      b.nox += parseNum(r.noxMass ?? r.noxMassTons);
      b.hours += parseNum(r.operatingTime ?? r.sumOpTime, 1.0);
    }

    const items: GranularEmissionsItem[] = [];
    for (let d = 1; d <= visibleDays; d++) {
      const b = dayBuckets.get(d)!;
      items.push({
        periodKey: `day_${d}`,
        periodLabel: `Day ${d}`,
        subLabel: b.dateStr.slice(5),
        operatingHours: Math.round(b.hours * 10) / 10,
        grossGenerationMWh: Math.round(b.gen),
        heatInputMMBtu: Math.round(b.heat),
        co2MassTons: Math.round(b.co2 * 10) / 10,
        so2MassTons: Number(b.so2.toFixed(1)),
        noxMassTons: Number(b.nox.toFixed(1)),
        co2IntensityLbsMWh: computeCo2IntensityLbsMWh(b.co2, b.gen),
        heatRateMMBtuMWh: computeHeatRateMMBtuMWh(b.heat, b.gen),
      });
    }

    return {
      facilityId,
      granularity: "daily",
      year,
      date: targetDate,
      unitId: requestedUnitId,
      publishedThrough: currentPublishedThrough(publishedThrough),
      source: "EPA_CAMPD_API",
      summary: summarizeGranularItems(items),
      items,
    };
  }

  // 4. WEEKLY GRANULARITY
  if (granularity === "weekly") {
    const weeklyRange = clampCampdDateRange(
      `${year}-01-01`,
      `${year}-12-31`,
      publishedThrough,
    );
    const dailyResult = await fetchCampdDailyEmissions({
      facilityId,
      beginDate: weeklyRange.beginDate,
      endDate: weeklyRange.endDate,
      publishedThrough,
    });
    let rawDaily = dailyResult.items;

    rawDaily = filterCampdRowsByUnit(rawDaily, requestedUnitId);

    if (rawDaily.length === 0) {
      return emptyGranularResult(
        facilityId,
        "weekly",
        year,
        requestedUnitId,
        undefined,
        dailyResult.error,
        publishedThrough,
      );
    }

    const weekBuckets = new Map<
      number,
      {
        gen: number;
        heat: number;
        co2: number;
        so2: number;
        nox: number;
        hours: number;
        startDate: string;
        endDate: string;
      }
    >();

    for (let w = 1; w <= 52; w++) {
      const startDay = (w - 1) * 7 + 1;
      const dStart = new Date(Date.UTC(year, 0, startDay));
      const dEnd = new Date(Date.UTC(year, 0, Math.min(startDay + 6, 365)));
      weekBuckets.set(w, {
        gen: 0,
        heat: 0,
        co2: 0,
        so2: 0,
        nox: 0,
        hours: 0,
        startDate: dStart.toISOString().slice(5, 10),
        endDate: dEnd.toISOString().slice(5, 10),
      });
    }

    for (const row of rawDaily) {
      const dateStr = toCleanString(row.date ?? row.opDate);
      if (dateStr.length < 10) continue;
      const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
      if (!y || !m || !d) continue;
      const dayOfYear = Math.floor(
        (Date.UTC(y, m - 1, d) - Date.UTC(year, 0, 1)) / (1000 * 60 * 60 * 24),
      );
      const weekNum = Math.min(52, Math.max(1, Math.floor(dayOfYear / 7) + 1));
      const b = weekBuckets.get(weekNum);
      if (!b) continue;
      b.gen += parseNum(row.grossLoad);
      b.heat += parseNum(row.heatInput);
      b.co2 += parseNum(row.co2Mass);
      b.so2 += parseNum(row.so2Mass);
      b.nox += parseNum(row.noxMass);
      b.hours += parseNum(row.sumOpTime ?? row.countOpTime);
    }

    const items: GranularEmissionsItem[] = Array.from(
      weekBuckets.entries(),
    ).map(([w, d]) => ({
      periodKey: `week_${w}`,
      periodLabel: `Week ${w}`,
      subLabel: `${d.startDate} - ${d.endDate}`,
      operatingHours: Math.round(d.hours),
      grossGenerationMWh: Math.round(d.gen),
      heatInputMMBtu: Math.round(d.heat),
      co2MassTons: Math.round(d.co2),
      so2MassTons: Number(d.so2.toFixed(1)),
      noxMassTons: Number(d.nox.toFixed(1)),
      co2IntensityLbsMWh: computeCo2IntensityLbsMWh(d.co2, d.gen),
      heatRateMMBtuMWh: computeHeatRateMMBtuMWh(d.heat, d.gen),
    }));

    return {
      facilityId,
      granularity: "weekly",
      year,
      unitId: requestedUnitId,
      publishedThrough: currentPublishedThrough(publishedThrough),
      source: "EPA_CAMPD_API",
      summary: summarizeGranularItems(items),
      items,
    };
  }

  // 5. HOURLY GRANULARITY
  const targetDate = clampDateToYear(
    options.date ?? getDefaultCampdDateForYear(year, publishedThrough),
    year,
    publishedThrough,
  );
  const hourlyResult = await fetchCampdHourlyEmissions({
    facilityId,
    beginDate: targetDate,
    endDate: targetDate,
    publishedThrough,
  });
  let rawHourly = hourlyResult.items;

  rawHourly = filterCampdRowsByUnit(rawHourly, requestedUnitId);

  if (rawHourly.length === 0) {
    return emptyGranularResult(
      facilityId,
      "hourly",
      year,
      requestedUnitId,
      targetDate,
      hourlyResult.error,
      publishedThrough,
    );
  }

  const hourBuckets = new Map<
    number,
    {
      gen: number;
      heat: number;
      co2: number;
      so2: number;
      nox: number;
      hours: number;
    }
  >();

  for (let h = 0; h < 24; h++) {
    hourBuckets.set(h, { gen: 0, heat: 0, co2: 0, so2: 0, nox: 0, hours: 0 });
  }

  for (const row of rawHourly) {
    const h = Number(row.hour);
    if (h >= 0 && h < 24) {
      const b = hourBuckets.get(h)!;
      b.gen += parseNum(row.grossLoad);
      b.heat += parseNum(row.heatInput);
      b.co2 += parseNum(row.co2Mass);
      b.so2 += parseNum(row.so2Mass);
      b.nox += parseNum(row.noxMass);
      b.hours += parseNum(row.opTime, 1);
    }
  }

  const items: GranularEmissionsItem[] = Array.from(hourBuckets.entries()).map(
    ([h, d]) => {
      const pad = (n: number) => n.toString().padStart(2, "0");
      return {
        periodKey: `hour_${h}`,
        periodLabel: `${pad(h)}:00 - ${pad(h)}:59`,
        subLabel: targetDate,
        operatingHours: Math.round(d.hours * 10) / 10,
        grossGenerationMWh: Math.round(d.gen),
        heatInputMMBtu: Math.round(d.heat),
        co2MassTons: Math.round(d.co2 * 10) / 10,
        so2MassTons: Number(d.so2.toFixed(2)),
        noxMassTons: Number(d.nox.toFixed(2)),
        co2IntensityLbsMWh: computeCo2IntensityLbsMWh(d.co2, d.gen),
        heatRateMMBtuMWh: computeHeatRateMMBtuMWh(d.heat, d.gen),
      };
    },
  );

  return {
    facilityId,
    granularity: "hourly",
    year,
    date: targetDate,
    unitId: requestedUnitId,
    publishedThrough: currentPublishedThrough(publishedThrough),
    source: "EPA_CAMPD_API",
    summary: summarizeGranularItems(items, { operatingHoursDecimals: 1 }),
    items,
  };
}
