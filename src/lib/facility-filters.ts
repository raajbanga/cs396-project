import { z } from "zod";

export const SORT_FIELDS = ["name", "id", "capacity", "co2"] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = "asc" | "desc";

/** §8.2 range-searchable unit-year metrics; keys are `annual_records` columns. */
export const UNIT_METRICS = [
  { key: "operatingHours", label: "Operating time", unit: "hr" },
  { key: "grossGenerationMWh", label: "Gross load", unit: "MWh" },
  { key: "heatInputMMBtu", label: "Heat input", unit: "MMBtu" },
  { key: "co2MassTons", label: "CO₂", unit: "tons" },
  { key: "so2MassTons", label: "SO₂", unit: "tons" },
  { key: "noxMassTons", label: "NOₓ", unit: "tons" },
] as const;
/** §8.2 min/max filters: the reporting year (for 2015–2025 style history), every metric, and the unit's nameplate capacity. */
export const RANGE_FIELDS = [
  { key: "year", label: "Reporting year", unit: "yr" },
  ...UNIT_METRICS,
  { key: "capacity", label: "Capacity", unit: "MW" },
] as const;
/** Range fields a description can bind a number to ("over 1000 MW", "CO2 above 1M"). */
export type RangeMetric = Exclude<(typeof RANGE_FIELDS)[number]["key"], "year">;
type RangeField = (typeof RANGE_FIELDS)[number]["key"];
type RangeKey = `${RangeField}${"Min" | "Max"}`;
const RANGE_KEYS = RANGE_FIELDS.flatMap(
  ({ key }) => [`${key}Min`, `${key}Max`] as const,
);
/** Rubric §5 greater-than/less-than: "1" makes the bound strict (> / <) instead of inclusive (≥ / ≤). */
type StrictKey = `${RangeKey}Strict`;
const STRICT_KEYS = RANGE_KEYS.map((k) => `${k}Strict` as const);
/** A strict flag only modifies its bound; it is not a filter of its own. */
export const isStrictKey = (key: string): key is StrictKey =>
  key.endsWith("Strict");

/** Unit-year (Units view) sort keys: identity columns, every metric, and the derived rates. */
export const UNIT_SORT_FIELDS = [
  "facility",
  "unitId",
  "state",
  "year",
  "capacity",
  ...UNIT_METRICS.map((m) => m.key),
  "co2Intensity",
  "heatRate",
] as const;
export type UnitSortField = (typeof UNIT_SORT_FIELDS)[number];
export const isUnitSortField = (v: string): v is UnitSortField =>
  (UNIT_SORT_FIELDS as readonly string[]).includes(v);

/** Top-N choices; "ALL" = no limit. With rankGroup "state", N applies within each state. */
export const TOP_N_OPTIONS = [5, 10, 20, 50, 100] as const;

/**
 * §8.3 ranking measures (`topBy`). A unit-year ranks by its own value; a facility by its matching
 * unit-years added up (rates: the ratio of the sums; capacity: the plant's nameplate total).
 */
export const RANK_METRICS = [
  ...UNIT_METRICS,
  { key: "capacity", label: "Capacity", unit: "MW" },
  { key: "co2Intensity", label: "CO₂ intensity", unit: "lb/MWh" },
  { key: "heatRate", label: "Heat rate", unit: "MMBtu/MWh" },
  { key: "noxRate", label: "NOₓ rate", unit: "lb/MMBtu" },
] as const;
export type RankMetric = (typeof RANK_METRICS)[number]["key"];
export const isRankMetric = (v: string): v is RankMetric =>
  RANK_METRICS.some((m) => m.key === v);
/** Ranking keys that only mean something while `topN` is set. */
const RANK_KEYS = ["topBy", "topDir", "topLevel", "rankGroup"] as const;

const text = z.string().optional();

/**
 * Explorer filters shared by the Facilities, Units, and Map views. Every value is a string
 * ("ALL"/empty = off) so state, URL params, and the filter handler stay uniform.
 */
export const facilityFilterSchema = z.object({
  search: text,
  stateCode: text,
  primaryFuel: text,
  nercRegion: text,
  facilityId: text,
  unitId: text,
  county: text,
  year: text,
  secondaryFuel: text,
  unitType: text,
  so2Control: text,
  noxControl: text,
  pmControl: text,
  programCode: text, // emissions program as reported that year, e.g. "ARP", "CSNOX"
  operatingStatus: text,
  topN: text, // keep only the first N facilities or unit-years by `topBy`
  topBy: text, // a RANK_METRICS key
  topDir: text, // "desc" = highest first, "asc" = lowest first
  topLevel: text, // "facility" | "unit": what is ranked
  rankGroup: text, // "state" = rank within each state
  origin: text, // "API" | "UPLOAD": where the unit-year record came from
  auditFlag: text, // physical-sanity rule (flag_type) the unit-year was flagged with
  auditSeverity: text, // "ERROR" | "WARN"
  ...(Object.fromEntries(
    [...RANGE_KEYS, ...STRICT_KEYS].map((k) => [k, text]),
  ) as Record<RangeKey | StrictKey, typeof text>),
});
export type FilterInput = z.infer<typeof facilityFilterSchema>;

export const DEFAULT_FILTERS = {
  search: "",
  stateCode: "ALL",
  primaryFuel: "ALL",
  nercRegion: "ALL",
  facilityId: "",
  unitId: "",
  county: "ALL",
  year: "ALL",
  secondaryFuel: "ALL",
  unitType: "ALL",
  so2Control: "ALL",
  noxControl: "ALL",
  pmControl: "ALL",
  programCode: "ALL",
  operatingStatus: "ALL",
  topN: "ALL",
  topBy: "co2MassTons",
  topDir: "desc",
  topLevel: "facility",
  rankGroup: "ALL",
  origin: "ALL",
  auditFlag: "ALL",
  auditSeverity: "ALL",
  ...(Object.fromEntries(
    [...RANGE_KEYS, ...STRICT_KEYS].map((k) => [k, ""]),
  ) as Record<RangeKey | StrictKey, string>),
};
export type FacilityFilters = typeof DEFAULT_FILTERS;

/** §8.1 basic search fields, always visible in the explorer toolbar. */
const BASIC_FILTER_KEYS = [
  "search",
  "stateCode",
  "year",
  "primaryFuel",
  "unitType",
] as const satisfies readonly (keyof FacilityFilters)[];

/** Everything else (grid, controls, ranges, ranking, …), shown under "Advanced". */
export const ADVANCED_FILTER_KEYS = (
  Object.keys(DEFAULT_FILTERS) as (keyof FacilityFilters)[]
).filter(
  (k) =>
    !(BASIC_FILTER_KEYS as readonly string[]).includes(k) && !isStrictKey(k),
);

/**
 * Set to a non-default value; a strict flag counts only while its bound is set, and the ranking
 * measure, order, level, and grouping only while Top N is set.
 */
export const isFilterActive = (
  filters: FacilityFilters,
  key: keyof FacilityFilters,
): boolean =>
  filters[key].trim() !== DEFAULT_FILTERS[key] &&
  (!isStrictKey(key) ||
    isFilterActive(filters, key.slice(0, -"Strict".length) as RangeKey)) &&
  (!(RANK_KEYS as readonly string[]).includes(key) ||
    isFilterActive(filters, "topN"));

/** The page's `defaults` with a description search's filters on top (only the ones it set). A search
 * that names no year keeps the page's year range; one that does replaces it. */
export function applyDescribed(
  defaults: FacilityFilters,
  described: FacilityFilters,
  { yearRange = false } = {},
): FacilityFilters {
  const set = (
    Object.keys(DEFAULT_FILTERS) as (keyof FacilityFilters)[]
  ).filter((k) => described[k] !== DEFAULT_FILTERS[k]);
  const base = set.some((k) => k.startsWith("year"))
    ? { ...defaults, year: "ALL", yearMin: "", yearMax: "" }
    : defaults;
  const next = {
    ...base,
    ...Object.fromEntries(set.map((k) => [k, described[k]])),
  };
  // Pages that pick years as a range (Analyze) show "in 2025" as 2025–2025.
  if (yearRange && next.year !== "ALL") {
    return { ...next, yearMin: next.year, yearMax: next.year, year: "ALL" };
  }
  return next;
}

/** "Top 10 facilities by CO₂", "Lowest 5 unit-years by heat rate per state"; undefined without Top N. */
export function describeRanking(filters: FacilityFilters) {
  if (!isFilterActive(filters, "topN")) return undefined;
  const { label } =
    RANK_METRICS.find((m) => m.key === filters.topBy) ??
    RANK_METRICS.find((m) => m.key === DEFAULT_FILTERS.topBy)!;
  const n = Number(filters.topN);
  const what =
    filters.topLevel === "unit"
      ? n === 1
        ? "unit-year"
        : "unit-years"
      : n === 1
        ? "facility"
        : "facilities";
  // "heat rate", but "CO₂ intensity": formulas keep their capitals.
  const measure = /^[A-Z]{2}/.test(label)
    ? label
    : label[0]!.toLowerCase() + label.slice(1);
  return `${filters.topDir === "asc" ? "Lowest" : "Top"} ${n} ${what} by ${measure}${
    filters.rankGroup === "state" ? " per state" : ""
  }`;
}

export const DEFAULT_TABLE_STATE = {
  page: 1,
  pageSize: 10,
  sortBy: "name" as SortField,
  sortDir: "asc" as SortDirection,
};

/** Audits tab sort keys (server-side, the table is paged). */
export const AUDIT_SORT_FIELDS = [
  "year",
  "severity",
  "rule",
  "facility",
  "source",
] as const;
export type AuditSortField = (typeof AUDIT_SORT_FIELDS)[number];

export const DEFAULT_AUDIT_TABLE_STATE = {
  page: 1,
  pageSize: 25,
  sortBy: "year" as AuditSortField,
  sortDir: "desc" as SortDirection,
};

export const DEFAULT_UNIT_TABLE_STATE = {
  ...DEFAULT_TABLE_STATE,
  sortBy: "co2MassTons" as UnitSortField,
  sortDir: "desc" as SortDirection,
};

/** Table state after clicking a sortable header: flip on the same field, else that field's default direction. */
export function nextSort<T extends { sortBy: string; sortDir: SortDirection }>(
  table: T,
  field: T["sortBy"],
  descByDefault: (field: T["sortBy"]) => boolean,
): T {
  return {
    ...table,
    page: 1,
    sortBy: field,
    sortDir:
      table.sortBy === field
        ? table.sortDir === "asc"
          ? "desc"
          : "asc"
        : descByDefault(field)
          ? "desc"
          : "asc",
  };
}

export type FilterChangeHandler = (
  key: keyof FacilityFilters,
  value: string,
) => void;

/** §5 CAMPD retrieval: a year range plus the annual endpoint's filters ("ALL"/empty = no filter). */
const campdFilterSchema = facilityFilterSchema
  .pick({ stateCode: true })
  .extend({
    facilityId: z.array(z.number().int().positive()).max(50).optional(),
    unitFuelType: z.string().optional(),
    unitType: z.string().optional(),
    controlTechnologies: z.string().optional(),
  });
export type CampdFilters = z.infer<typeof campdFilterSchema>;

export const campdRetrievalSchema = campdFilterSchema
  .extend({
    fromYear: z.number().int().min(1995),
    toYear: z.number().int().min(1995),
  })
  .refine((r) => r.fromYear <= r.toYear, {
    message: "From year must not be after To year.",
  });
export type CampdRetrieval = z.infer<typeof campdRetrievalSchema>;

const EXPLORER_TABS = ["explorer", "units", "audit"] as const;
type ExplorerTab = (typeof EXPLORER_TABS)[number];

export interface ExplorerState {
  tab: ExplorerTab;
  /** The last description-search text (display only; the filters it produced are in `filters`). */
  q: string;
  filters: FacilityFilters;
  table: typeof DEFAULT_TABLE_STATE;
  unitTable: typeof DEFAULT_UNIT_TABLE_STATE;
  auditTable: typeof DEFAULT_AUDIT_TABLE_STATE;
}

/** The paged table behind each tab: its state key, defaults, and valid sort keys (shared by parse and serialize). */
const TAB_TABLES = {
  explorer: { key: "table", defaults: DEFAULT_TABLE_STATE, sorts: SORT_FIELDS },
  units: {
    key: "unitTable",
    defaults: DEFAULT_UNIT_TABLE_STATE,
    sorts: UNIT_SORT_FIELDS,
  },
  audit: {
    key: "auditTable",
    defaults: DEFAULT_AUDIT_TABLE_STATE,
    sorts: AUDIT_SORT_FIELDS,
  },
} as const;

type Params = Record<string, string | string[] | undefined>;

/** Rebuilds explorer state from URL query params, ignoring unknown keys and invalid values. */
export function parseExplorerParams(params: Params): ExplorerState {
  const get = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const oneOf = <T extends string>(values: readonly T[], v?: string) =>
    values.find((x) => x === v);
  const positive = (v?: string) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };

  const filters = { ...DEFAULT_FILTERS };
  for (const key of Object.keys(DEFAULT_FILTERS) as (keyof FacilityFilters)[]) {
    const v = get(key);
    if (v !== undefined) filters[key] = v;
  }
  const tab = oneOf(EXPLORER_TABS, get("tab")) ?? "explorer";
  const state: ExplorerState = {
    tab,
    q: get("q") ?? "",
    filters,
    table: { ...DEFAULT_TABLE_STATE },
    unitTable: { ...DEFAULT_UNIT_TABLE_STATE },
    auditTable: { ...DEFAULT_AUDIT_TABLE_STATE },
  };
  // Paging and sort params belong to the active tab's table.
  const { key, defaults, sorts } = TAB_TABLES[tab];
  Object.assign(state[key], {
    page: positive(get("page")) ?? 1,
    pageSize:
      [10, 25, 50, 100].find((n) => n === positive(get("size"))) ??
      defaults.pageSize,
    sortBy: oneOf(sorts, get("sort")) ?? defaults.sortBy,
    sortDir: oneOf(["asc", "desc"] as const, get("dir")) ?? defaults.sortDir,
  });
  // Links from before the ranking was part of the filters ranked by the table's sort.
  if (get("topN") !== undefined && get("topBy") === undefined) {
    const { sortBy, sortDir } = state[key];
    const by = sortBy === "co2" ? "co2MassTons" : sortBy;
    if ((tab === "explorer" || tab === "units") && isRankMetric(by)) {
      Object.assign(filters, {
        topBy: by,
        topDir: sortDir,
        topLevel: tab === "units" ? "unit" : "facility",
      });
    }
  }
  return state;
}

/** The active (non-default) filters as URL params (the Map page's whole query). */
export function filterSearchParams(
  filters: FacilityFilters,
  params = new URLSearchParams(),
) {
  for (const key of Object.keys(DEFAULT_FILTERS) as (keyof FacilityFilters)[]) {
    if (isFilterActive(filters, key)) params.set(key, filters[key].trim());
  }
  return params;
}

/** Query string for the explorer state, keeping only non-default values (the inverse of parseExplorerParams). */
export function explorerSearchParams(state: ExplorerState) {
  const { tab, q, filters } = state;
  const params = new URLSearchParams();
  if (tab !== "explorer") params.set("tab", tab);
  if (q.trim()) params.set("q", q.trim());
  filterSearchParams(filters, params);
  const { key, defaults } = TAB_TABLES[tab];
  const current = state[key];
  if (current.sortBy !== defaults.sortBy) params.set("sort", current.sortBy);
  if (current.sortDir !== defaults.sortDir) params.set("dir", current.sortDir);
  if (current.page !== 1) params.set("page", String(current.page));
  if (current.pageSize !== defaults.pageSize) {
    params.set("size", String(current.pageSize));
  }
  return params.toString();
}

export const DEFAULT_RETRIEVAL = {
  stateCode: "ALL",
  facilityIds: "",
  unitFuelType: "ALL",
  unitType: "ALL",
  controlTechnologies: "ALL",
};

/** "3, 7 10" → [3, 7, 10]; null if any entry isn't a positive integer. */
export function parseFacilityIds(text: string): number[] | null {
  const parts = text.split(/[\s,|]+/).filter(Boolean);
  const ids = parts.map(Number);
  return ids.every((n) => Number.isInteger(n) && n > 0) ? ids : null;
}

/** The filters that narrow a CAMPD request, dropping "ALL"/empty ones. */
export const activeCampdFilters = (filters: CampdFilters) =>
  Object.fromEntries(
    Object.entries(filters).filter(([, v]) =>
      Array.isArray(v) ? v.length > 0 : v && v !== "ALL",
    ),
  ) as CampdFilters;

/** Short label for a retrieval's filters, e.g. "KY · Coal · Facility 3, 7"; "" when unfiltered. */
export const describeCampdFilters = ({
  stateCode,
  facilityId,
  unitFuelType,
  unitType,
  controlTechnologies,
}: CampdFilters) =>
  [
    stateCode,
    facilityId?.length && `Facility ${facilityId.join(", ")}`,
    unitFuelType,
    unitType,
    controlTechnologies,
  ]
    .filter((v) => v && v !== "ALL")
    .join(" · ");

/**
 * Distinct single values from multi-valued unit columns, sorted: "Wet Lime FGD|Wet Limestone" and
 * "Diesel Oil, Pipeline Natural Gas" split apart, "(Began Oct 28, 2025)" notes dropped.
 */
export const multiValueOptions = (values: string[]) =>
  [
    ...new Set(
      values.flatMap((v) =>
        v
          .replace(/\s*\([^)]*\)/g, "")
          .split(/[|,]/)
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    ),
  ].sort((a, b) => a.localeCompare(b));
