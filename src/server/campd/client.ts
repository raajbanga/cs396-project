import { and, eq, sql } from "drizzle-orm";
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
  type ReportedTotals,
} from "~/lib/emissions-metrics";
import {
  activeCampdFilters,
  describeCampdFilters,
  type CampdFilters,
} from "~/lib/facility-filters";
import {
  countDiff,
  diffRecord,
  emptyDiffCounts,
  recordKey,
  RECORD_ATTRIBUTE_KEYS,
  type DiffStatus,
  type FieldChange,
  type RecordAttributes,
} from "~/lib/record-diff";
import { uniqueStrings } from "~/lib/utils";
import { db } from "~/server/db";
import { annualRecords, datasets, facilities, units } from "~/server/db/schema";
import {
  insertImportIssues,
  insertMissingFacilities,
  storedRecords,
  upsertAnnualRecords,
  upsertUnits,
  type Executor,
} from "~/server/ingest";

const CAMPD_BASE_URL =
  "https://api.epa.gov/easey/emissions-mgmt/emissions/apportioned";
const CAMPD_MASTER_DATA_URL = "https://api.epa.gov/easey/master-data-mgmt";
/** Safety cap per paged request: 100 pages × 500 = 50,000 rows (an annual sync is ~4,700 today). */
const MAX_CAMPD_PAGES = 100;
const CAMPD_PAGE_SIZE = 500;

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

/** CAMPD apportioned-emissions fields per metric (annual/daily/monthly report sumOpTime, hourly opTime). */
const METRIC_FIELDS: Record<keyof EmissionTotals, string[]> = {
  operatingHours: ["sumOpTime", "opTime"],
  grossGenerationMWh: ["grossLoad"],
  heatInputMMBtu: ["heatInput"],
  steamLoadKlb: ["steamLoad"],
  co2MassTons: ["co2Mass"],
  so2MassTons: ["so2Mass"],
  noxMassTons: ["noxMass"],
};

/** CAMPD fields of the unit attributes reported with each row. */
const UNIT_FIELDS = {
  unitType: "unitType",
  primaryFuel: "primaryFuelInfo",
  secondaryFuel: "secondaryFuelInfo",
  so2Controls: "so2ControlInfo",
  noxControls: "noxControlInfo",
  pmControls: "pmControlInfo",
  hgControls: "hgControlInfo",
  programCode: "programCodeInfo",
};

/** A row's metrics; null where CAMPD left the value out (`missingHours` stands in for absent hours). */
function readMetrics(
  row: CampdRow,
  missingHours: number | null = null,
): ReportedTotals {
  const totals: ReportedTotals = { ...emptyTotals() };
  for (const key of TOTAL_KEYS) {
    const n = parseNum(pick(row, ...METRIC_FIELDS[key]), Number.NaN);
    totals[key] = Number.isNaN(n)
      ? key === "operatingHours"
        ? missingHours
        : null
      : n;
  }
  return totals;
}

const rawCampdRecordSchema = z.record(z.unknown()).transform((raw, ctx) => {
  const facilityId = Math.round(parseNum(raw.facilityId));
  const unitId = toStr(raw.unitId);
  const year = Math.round(parseNum(raw.year));

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
    facilityName: toStr(raw.facilityName) ?? `Facility #${facilityId}`,
    stateCode: (toStr(raw.stateCode) ?? "US").toUpperCase().slice(0, 2),
    metrics: readMetrics(raw),
    unit: Object.fromEntries(
      Object.entries(UNIT_FIELDS).map(([field, key]) => [
        field,
        toStr(raw[key]),
      ]),
    ) as Record<keyof typeof UNIT_FIELDS, string | null>,
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
  baseUrl = CAMPD_BASE_URL,
): Promise<CampdFetchResult> {
  if (!env.CAMPD_API) {
    return { items: [], error: "CAMPD_API key is not configured." };
  }
  try {
    const res = await fetch(`${baseUrl}${path}?${query.toString()}`, {
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

/** Yields each page of a CAMPD endpoint until a short page; throws the API's error, or past the page cap. */
async function* campdPages(path: string, query: URLSearchParams) {
  for (let page = 1; page <= MAX_CAMPD_PAGES; page++) {
    const pageQuery = new URLSearchParams(query);
    pageQuery.set("page", String(page));
    pageQuery.set("perPage", String(CAMPD_PAGE_SIZE));
    const { items, error } = await fetchCampd(path, pageQuery);
    if (error) throw new Error(error);
    if (page === MAX_CAMPD_PAGES && items.length === CAMPD_PAGE_SIZE) {
      throw new Error(
        `CAMPD returned more than ${MAX_CAMPD_PAGES * CAMPD_PAGE_SIZE} rows; raise MAX_CAMPD_PAGES.`,
      );
    }
    if (items.length > 0) yield items;
    if (items.length < CAMPD_PAGE_SIZE) return;
  }
}

/** Every page of a CAMPD endpoint; on an error, the rows fetched so far plus the error. */
async function fetchAllCampdPages(
  path: string,
  query: URLSearchParams,
): Promise<CampdFetchResult> {
  const items: CampdRow[] = [];
  try {
    for await (const page of campdPages(path, query)) items.push(...page);
    return { items };
  } catch (err) {
    return { items, error: err instanceof Error ? err.message : String(err) };
  }
}

/** A CAMPD row that wasn't stored: it failed validation or repeated a facility-unit-year. */
interface DroppedCampdRow {
  rowNumber: number;
  kind: "REJECTED" | "DUPLICATE";
  reason: string;
  data: Record<string, string>;
}

const stringifyRow = (row: CampdRow) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, toStr(v) ?? ""]));

/** CAMPD /annual query for one year and the active filters (multi-valued filters joined with "|"). */
function annualQuery(year: number, filters: CampdFilters) {
  const query = new URLSearchParams({ year: String(year) });
  for (const [key, value] of Object.entries(activeCampdFilters(filters))) {
    query.set(key, Array.isArray(value) ? value.join("|") : String(value));
  }
  return query;
}

/**
 * Fetches and validates one year of CAMPD annual emissions without writing anything. Rows that fail
 * validation, or repeat a facility-unit-year already seen in this run (the first is kept, as with
 * uploads), come back in `dropped` so they can be reported instead of silently discarded.
 */
async function fetchCampdAnnual(year: number, filters: CampdFilters) {
  const records = new Map<
    string,
    NormalizedCampdRecord & { rowNumber: number }
  >();
  const dropped: DroppedCampdRow[] = [];
  let received = 0;
  for await (const items of campdPages("/annual", annualQuery(year, filters))) {
    for (const item of items) {
      const rowNumber = ++received;
      const res = rawCampdRecordSchema.safeParse(item);
      if (!res.success) {
        dropped.push({
          rowNumber,
          kind: "REJECTED",
          reason: res.error.issues.map((i) => i.message).join("; "),
          data: stringifyRow(item),
        });
        continue;
      }
      const key = recordKey(res.data.facilityId, res.data.unitId, year);
      const first = records.get(key);
      if (first) {
        dropped.push({
          rowNumber,
          kind: "DUPLICATE",
          reason: `Same facility-unit-year as row ${first.rowNumber}; skipped`,
          data: stringifyRow(item),
        });
      } else {
        records.set(key, { ...res.data, rowNumber });
      }
    }
  }
  return { received, records: [...records.values()], dropped };
}

type FetchedCampdYear = Awaited<ReturnType<typeof fetchCampdAnnual>>;

const PREVIEW_ROWS = 50;

interface CampdPreviewRow {
  year: number;
  facilityId: number;
  facilityName: string;
  unitId: string;
  grossGenerationMWh: number | null;
  co2MassTons: number | null;
  changes: FieldChange[];
}

/** One year of a retrieval preview: CAMPD's rows compared with the stored unit-years (§5, DB vs API). */
export async function previewCampdAnnual(year: number, filters: CampdFilters) {
  const fetched = await fetchCampdAnnual(year, filters);
  const stored = await storedRecords(
    [year],
    activeCampdFilters(filters).facilityId,
  );
  const counts = emptyDiffCounts();
  const rows: Record<DiffStatus, CampdPreviewRow[]> = {
    new: [],
    changed: [],
    unchanged: [],
  };
  for (const r of fetched.records) {
    const { status, changes } = diffRecord(
      { ...r.metrics, ...recordAttributes(r.unit) },
      stored.get(recordKey(r.facilityId, r.unitId, year)),
    );
    countDiff(counts, status);
    if (rows[status].length < PREVIEW_ROWS) {
      rows[status].push({
        year,
        facilityId: r.facilityId,
        facilityName: r.facilityName,
        unitId: r.unitId,
        grossGenerationMWh: r.metrics.grossGenerationMWh,
        co2MassTons: r.metrics.co2MassTons,
        changes,
      });
    }
  }
  return {
    year,
    received: fetched.received,
    ...counts,
    dropped: fetched.dropped.length,
    rows,
    droppedRows: fetched.dropped.slice(0, PREVIEW_ROWS),
  };
}

/** The year's control and program information, as stored on each annual record (§7). */
const recordAttributes = (unit: Record<string, string | null>) =>
  Object.fromEntries(
    RECORD_ATTRIBUTE_KEYS.map((k) => [k, unit[k] ?? null]),
  ) as RecordAttributes;

/** Writes one fetched year into `datasetId`: dropped rows to import_issues, records via the shared upsert. */
async function storeCampdAnnual(
  tx: Executor,
  datasetId: string,
  year: number,
  { records, dropped }: FetchedCampdYear,
) {
  await insertImportIssues(tx, datasetId, dropped);
  await insertMissingFacilities(
    records.map((r) => ({
      id: r.facilityId,
      name: r.facilityName,
      stateCode: r.stateCode,
    })),
    tx,
  );
  const unitIds = await upsertUnits(
    records.map(({ facilityId, unitId, unit }) => ({
      facilityId,
      unitId,
      ...unit,
    })),
    tx,
  );
  return upsertAnnualRecords(
    datasetId,
    records.map((r) => ({
      ...r.metrics,
      ...recordAttributes(r.unit),
      facilityId: r.facilityId,
      unitInternalId: unitIds.get(`${r.facilityId}:${r.unitId}`)!,
      year,
    })),
    tx,
  );
}

/**
 * Ingestion engine: fetches and validates one year of CAMPD annual records, then stores them as a new
 * dataset with physical-sanity flags and derived rates. `filters` narrow the request (CAMPD matches
 * them against unit attributes) and are stored with the year in `datasets.query_params`; the dataset
 * also records how its records compared with the database and how many rows were dropped. The year
 * is fetched completely, then written in one transaction; a failed attempt is kept in the history as
 * a dataset with no records and the error in `notes`.
 */
export async function syncCampdAnnualEmissions({
  year,
  filters = {},
}: {
  year: number;
  filters?: CampdFilters;
}) {
  const active = activeCampdFilters(filters);
  const label = describeCampdFilters(active);
  const dataset = {
    id: crypto.randomUUID(),
    name: `CAMPD API ${year}${label ? ` [${label}]` : ""} Ingestion Batch`,
    source: "API",
    reportingYear: year,
    queryParams: {
      endpoint: "/annual",
      year,
      perPage: CAMPD_PAGE_SIZE,
      ...active,
    },
  };

  try {
    const fetched = await fetchCampdAnnual(year, active);
    const stored = await db.transaction(async (tx) => {
      await tx.insert(datasets).values(dataset);
      const stored = await storeCampdAnnual(tx, dataset.id, year, fetched);
      await tx
        .update(datasets)
        .set({
          rawRecordCount: fetched.received,
          validRecords: fetched.records.length,
          flaggedRecords: stored.flaggedRecords,
          insertedRecords: stored.inserted,
          updatedRecords: stored.updated,
          unchangedRecords: stored.unchanged,
          droppedRecords: fetched.dropped.length,
          notes: fetched.dropped.length
            ? `${fetched.dropped.length} CAMPD rows dropped (see the invalid-records report)`
            : null,
        })
        .where(eq(datasets.id, dataset.id));
      return stored;
    });
    return {
      datasetId: dataset.id,
      year,
      rawRecordCount: fetched.received,
      validRecords: fetched.records.length,
      flaggedRecords: stored.flaggedRecords,
      inserted: stored.inserted,
      updated: stored.updated,
      unchanged: stored.unchanged,
      dropped: fetched.dropped.length,
      anomalyCount: stored.anomalyCount,
    };
  } catch (err) {
    const message = `CAMPD API error: ${err instanceof Error ? err.message : String(err)}`;
    await db
      .insert(datasets)
      .values({ ...dataset, notes: `Error: ${message}` });
    throw new Error(message);
  }
}

async function fetchMasterDataList(path: string, field: string) {
  const { items } = await fetchCampd(
    path,
    new URLSearchParams(),
    CAMPD_MASTER_DATA_URL,
  );
  return uniqueStrings(items.map((row) => toStr(row[field]))).sort();
}

let retrievalOptionsCache: Record<
  "fuels" | "unitTypes" | "controls",
  string[]
> | null = null;

/** Values CAMPD accepts for the fuel, unit-type, and control filters (master-data descriptions). */
export async function getCampdRetrievalOptions() {
  if (retrievalOptionsCache) return retrievalOptionsCache;
  const [fuels, unitTypes, controls] = await Promise.all([
    fetchMasterDataList("/fuel-type-codes", "fuelTypeDescription"),
    fetchMasterDataList("/unit-type-codes", "unitTypeDescription"),
    fetchMasterDataList("/control-codes", "controlDescription"),
  ]);
  const options = { fuels, unitTypes, controls };
  // Master data rarely changes; cache only complete answers so an outage is retried.
  if (fuels.length && unitTypes.length && controls.length) {
    retrievalOptionsCache = options;
  }
  return options;
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

interface GranularEmissionsItem extends RoundedTotals {
  periodKey: string;
  periodLabel: string;
  subLabel?: string;
}

interface GranularEmissionsResult {
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
    steamLoadKlb: round(t.steamLoadKlb),
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
const rowDate = (row: CampdRow) => toStr(row.date) ?? "";
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
        steamLoadKlb: sum(annualRecords.steamLoadKlb),
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
        (row) => toStr(row.unitId)?.toLowerCase() === unitId.toLowerCase(),
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
