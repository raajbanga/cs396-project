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
type UnitMetric = (typeof UNIT_METRICS)[number]["key"];
type RangeKey = `${UnitMetric}${"Min" | "Max"}`;
const RANGE_KEYS = UNIT_METRICS.flatMap(
  ({ key }) => [`${key}Min`, `${key}Max`] as const,
);

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

/** Top-N choices; "ALL" = no limit. With rankGroup "state", N applies within each state. */
export const TOP_N_OPTIONS = [5, 10, 20, 50, 100] as const;

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
  topN: text,
  rankGroup: text, // "state" = rank within each state
  origin: text, // "API" | "UPLOAD": where the unit-year record came from
  ...(Object.fromEntries(RANGE_KEYS.map((k) => [k, text])) as Record<
    RangeKey,
    typeof text
  >),
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
  topN: "ALL",
  rankGroup: "ALL",
  origin: "ALL",
  ...(Object.fromEntries(RANGE_KEYS.map((k) => [k, ""])) as Record<
    RangeKey,
    string
  >),
};
export type FacilityFilters = typeof DEFAULT_FILTERS;

/** Filters beyond the toolbar's search + state/grid/fuel selects (shown under "More filters"). */
export const ADVANCED_FILTER_KEYS = (
  Object.keys(DEFAULT_FILTERS) as (keyof FacilityFilters)[]
).filter(
  (k) => !["search", "stateCode", "primaryFuel", "nercRegion"].includes(k),
);

export const isFilterActive = (
  filters: FacilityFilters,
  key: keyof FacilityFilters,
) => filters[key].trim() !== DEFAULT_FILTERS[key];

export const DEFAULT_TABLE_STATE = {
  page: 1,
  pageSize: 10,
  sortBy: "name" as SortField,
  sortDir: "asc" as SortDirection,
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
export const campdFilterSchema = facilityFilterSchema
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

const EXPLORER_TABS = ["explorer", "units", "map", "audit"] as const;
export type ExplorerTab = (typeof EXPLORER_TABS)[number];

export interface ExplorerState {
  tab: ExplorerTab;
  filters: FacilityFilters;
  table: typeof DEFAULT_TABLE_STATE;
  unitTable: typeof DEFAULT_UNIT_TABLE_STATE;
}

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
  const paging = {
    page: positive(get("page")) ?? 1,
    pageSize:
      [10, 25, 50, 100].find((n) => n === positive(get("size"))) ??
      DEFAULT_TABLE_STATE.pageSize,
  };
  const sortDir = oneOf(["asc", "desc"] as const, get("dir"));
  const sortBy = get("sort");
  const table = { ...DEFAULT_TABLE_STATE };
  const unitTable = { ...DEFAULT_UNIT_TABLE_STATE };
  if (tab === "units") {
    Object.assign(unitTable, paging, {
      sortBy: oneOf(UNIT_SORT_FIELDS, sortBy) ?? unitTable.sortBy,
      sortDir: sortDir ?? unitTable.sortDir,
    });
  } else {
    Object.assign(table, paging, {
      sortBy: oneOf(SORT_FIELDS, sortBy) ?? table.sortBy,
      sortDir: sortDir ?? table.sortDir,
    });
  }
  return { tab, filters, table, unitTable };
}

/** Query string for the explorer state, keeping only non-default values (the inverse of parseExplorerParams). */
export function explorerSearchParams({
  tab,
  filters,
  table,
  unitTable,
}: ExplorerState) {
  const params = new URLSearchParams();
  if (tab !== "explorer") params.set("tab", tab);
  for (const key of Object.keys(DEFAULT_FILTERS) as (keyof FacilityFilters)[]) {
    if (isFilterActive(filters, key)) params.set(key, filters[key].trim());
  }
  if (tab === "explorer" || tab === "units") {
    const [current, defaults] =
      tab === "units"
        ? [unitTable, DEFAULT_UNIT_TABLE_STATE]
        : [table, DEFAULT_TABLE_STATE];
    if (current.sortBy !== defaults.sortBy) params.set("sort", current.sortBy);
    if (current.sortDir !== defaults.sortDir)
      params.set("dir", current.sortDir);
    if (current.page !== 1) params.set("page", String(current.page));
    if (current.pageSize !== defaults.pageSize) {
      params.set("size", String(current.pageSize));
    }
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
