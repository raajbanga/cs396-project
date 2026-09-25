import { and, eq, inArray, sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import { env } from "~/env";
import {
  clampCampdDateRange,
  clampDateToYear,
  clampIsoDateToCampdPublished,
  getCampdPublishedYear,
  getCampdValidMonthsForYear,
  getDefaultCampdDateForYear,
  pad2,
  parseCampdQuarterEndFromError,
  toIsoDate,
  type Granularity,
} from "~/lib/campd-reporting-period";
import {
  addTotals,
  deriveRates,
  emptyTotals,
  sumTotals,
  TOTAL_KEYS,
  type EmissionTotals,
} from "~/lib/emissions-metrics";
import { db } from "~/server/db";
import {
  annualRecords,
  dataAuditLogs,
  datasets,
  facilities,
  units,
} from "~/server/db/schema";

const CAMPD_BASE_URL =
  "https://api.epa.gov/easey/emissions-mgmt/emissions/apportioned";

type CampdRow = Record<string, unknown>;

interface CampdFetchResult {
  items: CampdRow[];
  error?: string;
}

function parseNum(val: unknown, fallback = 0): number {
  const n =
    typeof val === "number"
      ? val
      : typeof val === "string"
        ? Number.parseFloat(val.replace(/,/g, "").trim())
        : Number.NaN;
  return Number.isNaN(n) ? fallback : n;
}

function toStr(val: unknown): string | null {
  if (typeof val === "string") return val.trim() || null;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  return null;
}

/** First present, non-empty value among `keys`. */
const pick = (row: CampdRow, ...keys: string[]) =>
  keys
    .map((k) => row[k])
    .find((v) => v !== undefined && v !== null && v !== "");

/**
 * Field aliases across the CAMPD REST API (camelCase), snake_case, and bulk EPA
 * Custom Data Download (CDD) CSV headers (PRD Section 3.1).
 */
const METRIC_ALIASES: Record<keyof EmissionTotals, string[]> = {
  operatingHours: [
    "opTime",
    "sumOpTime",
    "operatingTime",
    "operatingHours",
    "Operating Time",
    "countOpTime",
  ],
  grossGenerationMWh: ["grossLoad", "grossGenerationMWh", "Gross Load (MW-h)"],
  heatInputMMBtu: ["heatInput", "heatInputMMBtu", "Heat Input (MMBtu)"],
  co2MassTons: ["co2Mass", "co2MassTons", "CO2 (short tons)"],
  so2MassTons: ["so2Mass", "so2MassTons", "SO2 (short tons)"],
  noxMassTons: ["noxMass", "noxMassTons", "NOx (short tons)"],
};

const UNIT_ALIASES = {
  unitType: ["unitType", "unit_type", "Unit Type"],
  primaryFuel: [
    "primaryFuelInfo",
    "primaryFuel",
    "primary_fuel",
    "Primary Fuel Type",
  ],
  secondaryFuel: [
    "secondaryFuelInfo",
    "secondaryFuel",
    "secondary_fuel",
    "Secondary Fuel Type",
  ],
  so2Controls: [
    "so2ControlInfo",
    "so2Controls",
    "so2_controls",
    "SO2 Controls",
  ],
  noxControls: [
    "noxControlInfo",
    "noxControls",
    "nox_controls",
    "NOx Controls",
  ],
  pmControls: ["pmControlInfo", "pmControls", "pm_controls", "PM Controls"],
  hgControls: ["hgControlInfo", "hgControls", "hg_controls", "Hg Controls"],
  programCode: [
    "programCodeInfo",
    "programCode",
    "program_code",
    "Program Code",
  ],
};

function readMetrics(row: CampdRow, missingHours = 0): EmissionTotals {
  const totals = emptyTotals();
  for (const key of TOTAL_KEYS) {
    totals[key] = parseNum(
      pick(row, ...METRIC_ALIASES[key]),
      key === "operatingHours" ? missingHours : 0,
    );
  }
  return totals;
}

const rawCampdRecordSchema = z.record(z.unknown()).transform((raw, ctx) => {
  const str = (...keys: string[]) => toStr(pick(raw, ...keys));
  const facilityId = Math.round(
    parseNum(
      pick(
        raw,
        "facilityId",
        "facility_id",
        "Facility ID (ORISPL)",
        "Facility ID",
      ),
    ),
  );
  const unitId = str("unitId", "unit_id", "Unit ID");
  const year = Math.round(
    parseNum(
      pick(raw, "year", "Year", "reportingYear", "opYear", "calendarYear"),
    ),
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
    unitId,
    year,
    facilityName:
      str("facilityName", "facility_name", "Facility Name") ??
      `Facility #${facilityId}`,
    stateCode: (str("stateCode", "state", "State") ?? "US")
      .toUpperCase()
      .slice(0, 2),
    metrics: readMetrics(raw),
    unit: Object.fromEntries(
      Object.entries(UNIT_ALIASES).map(([field, keys]) => [
        field,
        str(...keys),
      ]),
    ) as Record<keyof typeof UNIT_ALIASES, string | null>,
  };
});

type NormalizedCampdRecord = z.infer<typeof rawCampdRecordSchema>;

function extractCampdError(body: unknown, status: number): string {
  const message = (body as { message?: unknown } | null)?.message;
  const text = Array.isArray(message)
    ? message.filter((part) => typeof part === "string").join(" ")
    : typeof message === "string"
      ? message.trim()
      : "";
  return text || `CAMPD API error (${status})`;
}

async function fetchCampd(
  path: string,
  query: URLSearchParams,
): Promise<CampdFetchResult> {
  if (!env.CAMPD_API) {
    return { items: [], error: "CAMPD_API key is not configured." };
  }
  try {
    const res = await fetch(`${CAMPD_BASE_URL}${path}?${query.toString()}`, {
      headers: { "x-api-key": env.CAMPD_API, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok)
      return { items: [], error: extractCampdError(body, res.status) };
    const items = Array.isArray(body)
      ? body
      : (body as { items?: unknown } | null)?.items;
    return { items: Array.isArray(items) ? (items as CampdRow[]) : [] };
  } catch (err) {
    return {
      items: [],
      error: err instanceof Error ? err.message : "CAMPD request failed",
    };
  }
}

async function fetchAllCampdPages(
  path: string,
  query: URLSearchParams,
  perPage = 500,
): Promise<CampdFetchResult> {
  const items: CampdRow[] = [];
  for (let page = 1; page <= 50; page++) {
    const pageQuery = new URLSearchParams(query);
    pageQuery.set("page", String(page));
    pageQuery.set("perPage", String(perPage));
    const result = await fetchCampd(path, pageQuery);
    if (result.error) return { items, error: result.error };
    items.push(...result.items);
    if (result.items.length < perPage) break;
  }
  return { items };
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

function evaluatePhysicalSanityRules(
  m: EmissionTotals & { heatRateMMBtuMWh: number | null },
) {
  const { HEAT_RATE_MIN_MMBTU_MWH: minRate, HEAT_RATE_MAX_MMBTU_MWH: maxRate } =
    AUDIT_THRESHOLDS;
  const flags: {
    flagType: string;
    severity: "WARN" | "ERROR";
    details: string;
  }[] = [];

  if (
    m.heatInputMMBtu > AUDIT_THRESHOLDS.ZERO_EMISSIONS_MIN_HEAT_INPUT_MMBTU &&
    m.co2MassTons === 0
  ) {
    flags.push({
      flagType: "ZERO_EMISSIONS_HIGH_HEAT",
      severity: "ERROR",
      details: `Heat input was ${m.heatInputMMBtu.toLocaleString()} MMBtu, but CO2 reported was 0.0 tons.`,
    });
  }
  if (
    m.grossGenerationMWh > AUDIT_THRESHOLDS.PHANTOM_GENERATION_MIN_MWH &&
    m.operatingHours === 0
  ) {
    flags.push({
      flagType: "PHANTOM_GENERATION",
      severity: "ERROR",
      details: `Gross generation was ${m.grossGenerationMWh.toLocaleString()} MWh while operating time was 0 hours.`,
    });
  }
  const rate = m.heatRateMMBtuMWh;
  if (rate !== null && (rate > maxRate || rate < minRate)) {
    flags.push({
      flagType: "EXTREME_HEAT_RATE",
      severity: "WARN",
      details: `Heat rate of ${rate.toFixed(2)} MMBtu/MWh is outside normal thermal envelope (${minRate.toFixed(1)} - ${maxRate.toFixed(1)}).`,
    });
  }
  return flags;
}

async function insertInChunks<T>(
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>,
) {
  // Chunks of 50 respect SQLite's bound-parameter limit.
  for (let i = 0; i < rows.length; i += 50) await insert(rows.slice(i, i + 50));
}

const ANNUAL_UPSERT_COLUMNS = [
  "datasetId",
  ...TOTAL_KEYS,
  "co2IntensityLbsMWh",
  "heatRateMMBtuMWh",
] as const;

/**
 * Ingestion engine: normalizes CAMPD annual records page by page, runs physical
 * sanity checks, derives efficiency metrics, and upserts in chunked batches.
 */
export async function syncCampdAnnualEmissions({
  year,
  perPage = 500,
  maxPages = 10,
}: {
  year: number;
  perPage?: number;
  maxPages?: number;
}) {
  const facilitySet = new Set(
    (await db.select({ id: facilities.id }).from(facilities)).map((f) => f.id),
  );
  const unitMap = new Map(
    (
      await db
        .select({
          id: units.id,
          facilityId: units.facilityId,
          unitId: units.unitId,
        })
        .from(units)
    ).map((u) => [`${u.facilityId}:${u.unitId}`, u.id]),
  );

  const datasetId = crypto.randomUUID();
  await db.insert(datasets).values({
    id: datasetId,
    name: `CAMPD API ${year} Ingestion Batch`,
    source: "API",
    reportingYear: year,
  });

  let rawRecordCount = 0;
  let validRecords = 0;
  let flaggedRecords = 0;
  let anomalyCount = 0;

  for (let page = 1; page <= maxPages; page++) {
    const { items, error } = await fetchCampd(
      "/annual",
      new URLSearchParams({
        year: String(year),
        page: String(page),
        perPage: String(Math.min(perPage, 500)),
      }),
    );
    if (error) throw new Error(`CAMPD API error: ${error}`);
    if (items.length === 0) break;
    rawRecordCount += items.length;

    // Dedupe on the natural key (facilityId, unitId, year).
    const batch = new Map<string, NormalizedCampdRecord>();
    for (const item of items) {
      const res = rawCampdRecordSchema.safeParse(item);
      if (res.success) {
        batch.set(
          `${res.data.facilityId}:${res.data.unitId}:${res.data.year}`,
          res.data,
        );
      }
    }

    const newFacilities: (typeof facilities.$inferInsert)[] = [];
    const newUnits: (typeof units.$inferInsert)[] = [];
    const records: (typeof annualRecords.$inferInsert)[] = [];
    const auditLogs: (typeof dataAuditLogs.$inferInsert)[] = [];

    for (const rec of batch.values()) {
      const { facilityId, unitId } = rec;
      if (!facilitySet.has(facilityId)) {
        facilitySet.add(facilityId);
        newFacilities.push({
          id: facilityId,
          name: rec.facilityName,
          stateCode: rec.stateCode,
        });
      }

      const unitKey = `${facilityId}:${unitId}`;
      let unitInternalId = unitMap.get(unitKey);
      if (!unitInternalId) {
        unitInternalId = crypto.randomUUID();
        unitMap.set(unitKey, unitInternalId);
        newUnits.push({ id: unitInternalId, unitId, facilityId, ...rec.unit });
      }

      const metrics = { ...rec.metrics, ...deriveRates(rec.metrics) };
      const annualRecordId = `${unitInternalId}_${year}`;
      records.push({
        id: annualRecordId,
        datasetId,
        facilityId,
        unitInternalId,
        year,
        ...metrics,
      });

      const flags = evaluatePhysicalSanityRules(metrics);
      if (flags.length > 0) flaggedRecords++;
      anomalyCount += flags.length;
      auditLogs.push(
        ...flags.map((flag) => ({
          id: crypto.randomUUID(),
          annualRecordId,
          ...flag,
        })),
      );
    }
    validRecords += batch.size;

    await insertInChunks(newFacilities, (c) => db.insert(facilities).values(c));
    await insertInChunks(newUnits, (c) => db.insert(units).values(c));
    await insertInChunks(records, (c) =>
      db
        .insert(annualRecords)
        .values(c)
        .onConflictDoUpdate({
          target: [annualRecords.unitInternalId, annualRecords.year],
          set: Object.fromEntries(
            ANNUAL_UPSERT_COLUMNS.map((col) => [
              col,
              sql.raw(`excluded.${annualRecords[col].name}`),
            ]),
          ),
        }),
    );
    if (records.length > 0) {
      await db.delete(dataAuditLogs).where(
        inArray(
          dataAuditLogs.annualRecordId,
          records.map((r) => r.id!),
        ),
      );
    }
    await insertInChunks(auditLogs, (c) => db.insert(dataAuditLogs).values(c));
  }

  await db
    .update(datasets)
    .set({ rawRecordCount, validRecords, flaggedRecords })
    .where(eq(datasets.id, datasetId));

  return {
    datasetId,
    year,
    rawRecordCount,
    validRecords,
    flaggedRecords,
    anomalyCount,
  };
}

const PUBLISHED_THROUGH_TTL_MS = 60 * 60 * 1000;
let publishedThroughCache: { iso: string; expiresAt: number } | null = null;

function rememberPublishedThrough(iso: string) {
  publishedThroughCache = {
    iso,
    expiresAt: Date.now() + PUBLISHED_THROUGH_TTL_MS,
  };
  return iso;
}

/** EPA rejects out-of-range dates with the real "published through" quarter end; remember it. */
function learnFromCampdError(error?: string): string | null {
  const parsed = error ? parseCampdQuarterEndFromError(error) : null;
  return parsed ? rememberPublishedThrough(parsed) : null;
}

export async function resolveCampdPublishedThrough(
  facilityId?: number,
): Promise<string> {
  if (publishedThroughCache && publishedThroughCache.expiresAt > Date.now()) {
    return publishedThroughCache.iso;
  }

  const fallback = toIsoDate(new Date());
  const probeId =
    facilityId ??
    (await db.select({ id: facilities.id }).from(facilities).limit(1))[0]?.id;
  if (!probeId || !env.CAMPD_API) return rememberPublishedThrough(fallback);

  // Probe with a full-year window; EPA's 400 names the latest published quarter.
  const year = new Date().getFullYear();
  const { error } = await fetchCampd(
    "/daily",
    new URLSearchParams({
      facilityId: String(probeId),
      beginDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      page: "1",
      perPage: "1",
    }),
  );
  return (
    learnFromCampdError(error) ??
    rememberPublishedThrough(error ? fallback : `${year}-12-31`)
  );
}

/** Runs `request`, retrying once if EPA reports a different published-through date. */
async function fetchWithPublishedRetry(
  publishedThrough: string,
  request: (publishedThrough: string) => Promise<CampdFetchResult>,
) {
  const result = await request(publishedThrough);
  const learned = learnFromCampdError(result.error);
  return learned && learned !== publishedThrough ? request(learned) : result;
}

type RoundedTotals = EmissionTotals & ReturnType<typeof deriveRates>;

export interface GranularEmissionsItem extends RoundedTotals {
  periodKey: string;
  periodLabel: string;
  subLabel?: string;
}

export interface GranularEmissionsResult {
  publishedThrough: string;
  source: "EPA_CAMPD_API" | "LOCAL_RECORDS" | "UNAVAILABLE";
  error?: string;
  summary: RoundedTotals;
  items: GranularEmissionsItem[];
}

const round = (n: number, decimals = 0) => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};

/** Decimal places for [operating hours, CO₂, SO₂/NOₓ] per resolution. */
const DECIMALS: Record<Granularity, readonly [number, number, number]> = {
  hourly: [1, 1, 2],
  daily: [1, 1, 1],
  weekly: [0, 0, 1],
  monthly: [0, 0, 1],
  yearly: [0, 0, 1],
};

function roundTotals(
  t: EmissionTotals,
  [hours, co2, pollutants]: readonly [number, number, number],
): RoundedTotals {
  return {
    operatingHours: round(t.operatingHours, hours),
    grossGenerationMWh: round(t.grossGenerationMWh),
    heatInputMMBtu: round(t.heatInputMMBtu),
    co2MassTons: round(t.co2MassTons, co2),
    so2MassTons: round(t.so2MassTons, pollutants),
    noxMassTons: round(t.noxMassTons, pollutants),
    ...deriveRates(t),
  };
}

interface Period {
  label: string;
  subLabel?: string;
}

/** How to fetch EPA rows for a resolution and assign each row to a period bucket. */
interface GranularPlan {
  request: (publishedThrough: string) => Promise<CampdFetchResult>;
  periods: (publishedThrough: string) => Period[];
  periodIndex: (row: CampdRow) => number;
  missingHours?: number;
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const rowDate = (row: CampdRow) => toStr(row.date ?? row.opDate) ?? "";
const monthName = (m: number) =>
  new Date(Date.UTC(2000, m - 1)).toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  });

function planGranularFetch(
  granularity: Exclude<Granularity, "yearly">,
  facilityId: number,
  year: number,
  date: string,
): GranularPlan {
  const dateWindow =
    (path: string, beginDate: string, endDate: string) => (pt: string) =>
      fetchAllCampdPages(
        path,
        new URLSearchParams({
          facilityId: String(facilityId),
          ...clampCampdDateRange(beginDate, endDate, pt),
        }),
      );

  switch (granularity) {
    case "hourly":
      return {
        request: dateWindow("/hourly", date, date),
        periods: () =>
          range(24).map((h) => ({
            label: `${pad2(h)}:00 - ${pad2(h)}:59`,
            subLabel: date,
          })),
        periodIndex: (row) => Number(row.hour),
        missingHours: 1,
      };

    case "daily": {
      const month = date.slice(0, 7);
      const daysInMonth = new Date(
        Date.UTC(year, Number(date.slice(5, 7)), 0),
      ).getUTCDate();
      const monthEnd = `${month}-${pad2(daysInMonth)}`;
      return {
        request: dateWindow("/daily", `${month}-01`, monthEnd),
        periods: (pt) => {
          const visibleEnd = clampIsoDateToCampdPublished(monthEnd, pt);
          const visibleDays = visibleEnd.startsWith(`${month}-`)
            ? Number(visibleEnd.slice(8, 10))
            : daysInMonth;
          return range(visibleDays).map((i) => ({
            label: `Day ${i + 1}`,
            subLabel: `${month.slice(5)}-${pad2(i + 1)}`,
          }));
        },
        periodIndex: (row) => Number(rowDate(row).slice(8, 10)) - 1,
        missingHours: 1,
      };
    }

    case "weekly": {
      const mmdd = (dayOfYear: number) =>
        new Date(Date.UTC(year, 0, dayOfYear)).toISOString().slice(5, 10);
      return {
        request: dateWindow("/daily", `${year}-01-01`, `${year}-12-31`),
        periods: () =>
          range(52).map((w) => ({
            label: `Week ${w + 1}`,
            subLabel: `${mmdd(w * 7 + 1)} - ${mmdd(Math.min(w * 7 + 7, 365))}`,
          })),
        periodIndex: (row) => {
          const day = Date.parse(rowDate(row).slice(0, 10));
          if (Number.isNaN(day)) return -1;
          const dayOfYear = Math.floor(
            (day - Date.UTC(year, 0, 1)) / 86_400_000,
          );
          return Math.min(51, Math.max(0, Math.floor(dayOfYear / 7)));
        },
      };
    }

    case "monthly":
      return {
        request: async (pt) => {
          const months = getCampdValidMonthsForYear(year, pt);
          if (months.length === 0) {
            return {
              items: [],
              error: `No published CAMPD months for ${year}.`,
            };
          }
          return fetchAllCampdPages(
            "/monthly",
            new URLSearchParams({
              facilityId: String(facilityId),
              year: String(year),
              month: months.join("|"),
            }),
          );
        },
        periods: (pt) =>
          getCampdValidMonthsForYear(year, pt).map((m) => ({
            label: monthName(m),
            subLabel: String(year),
          })),
        periodIndex: (row) => Number(row.month) - 1,
      };
  }
}

function buildResult(
  granularity: Granularity,
  source: GranularEmissionsResult["source"],
  publishedThrough: string,
  periods: Period[],
  totals: EmissionTotals[],
  error?: string,
): GranularEmissionsResult {
  return {
    publishedThrough,
    source,
    error,
    summary: roundTotals(sumTotals(totals), [
      granularity === "hourly" ? 1 : 0,
      0,
      1,
    ]),
    items: periods.map((period, i) => ({
      periodKey: `${granularity}_${i}`,
      periodLabel: period.label,
      subLabel: period.subLabel,
      ...roundTotals(totals[i]!, DECIMALS[granularity]),
    })),
  };
}

/**
 * Multi-resolution aggregator: yearly buckets come from local annual records;
 * hourly/daily/weekly/monthly are fetched live from the EPA CAMPD API.
 */
export async function fetchGranularEmissionsForFacility(options: {
  facilityId: number;
  granularity: Granularity;
  year?: number;
  date?: string;
  unitId?: string;
}): Promise<GranularEmissionsResult> {
  const { facilityId, granularity } = options;
  const publishedThrough = await resolveCampdPublishedThrough(facilityId);
  const publishedYear = getCampdPublishedYear(publishedThrough);
  const year = Math.min(options.year ?? publishedYear, publishedYear);
  const unitId =
    options.unitId && options.unitId !== "ALL" ? options.unitId : undefined;
  const current = () => publishedThroughCache?.iso ?? publishedThrough;

  if (granularity === "yearly") {
    const sum = (col: SQLiteColumn) => sql<number>`sum(${col})`;
    const rows = await db
      .select({
        year: annualRecords.year,
        operatingHours: sum(annualRecords.operatingHours),
        grossGenerationMWh: sum(annualRecords.grossGenerationMWh),
        heatInputMMBtu: sum(annualRecords.heatInputMMBtu),
        co2MassTons: sum(annualRecords.co2MassTons),
        so2MassTons: sum(annualRecords.so2MassTons),
        noxMassTons: sum(annualRecords.noxMassTons),
      })
      .from(annualRecords)
      .innerJoin(units, eq(annualRecords.unitInternalId, units.id))
      .where(
        and(
          eq(annualRecords.facilityId, facilityId),
          unitId ? eq(units.unitId, unitId) : undefined,
        ),
      )
      .groupBy(annualRecords.year)
      .orderBy(annualRecords.year);

    return buildResult(
      granularity,
      "LOCAL_RECORDS",
      current(),
      rows.map((r) => ({
        label: String(r.year),
        subLabel: "Annual Aggregate",
      })),
      rows,
    );
  }

  const date = clampDateToYear(
    options.date ?? getDefaultCampdDateForYear(year, publishedThrough),
    year,
    publishedThrough,
  );
  const plan = planGranularFetch(granularity, facilityId, year, date);
  const result = await fetchWithPublishedRetry(publishedThrough, plan.request);
  const rows = unitId
    ? result.items.filter(
        (row) =>
          toStr(row.unitId ?? row.unit_id)?.toLowerCase() ===
          unitId.toLowerCase(),
      )
    : result.items;

  if (rows.length === 0) {
    return buildResult(
      granularity,
      result.error ? "UNAVAILABLE" : "EPA_CAMPD_API",
      current(),
      [],
      [],
      result.error,
    );
  }

  const periods = plan.periods(current());
  const totals = periods.map(() => emptyTotals());
  for (const row of rows) {
    const bucket = totals[plan.periodIndex(row)];
    if (bucket) addTotals(bucket, readMetrics(row, plan.missingHours));
  }
  return buildResult(granularity, "EPA_CAMPD_API", current(), periods, totals);
}
