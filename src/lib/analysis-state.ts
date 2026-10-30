import {
  DEFAULT_FILTERS,
  filterSearchParams,
  type FacilityFilters,
} from "~/lib/facility-filters";

/**
 * Analyze page state (Phase 2 §4.1: reproducible through URL parameters): the Explore filters
 * plus the active tab and each tab's choices, all as strings so they round-trip through the URL.
 */

export const ANALYSIS_TABS = [
  "dataset",
  "statistics",
  "charts",
  "compare",
  "impacts",
] as const;
export type AnalysisTab = (typeof ANALYSIS_TABS)[number];

export const CHART_TYPES = [
  "trend",
  "bars",
  "distribution",
  "scatter",
  "correlation",
  "ranking",
  "map",
] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export const DEFAULT_VIEW = {
  tab: "dataset" as AnalysisTab,
  variable: "co2MassTons",
  by: "state", // "" = no grouping
  chart: "trend" as ChartType,
  series: "fuelClass",
  x: "heatInputMMBtu",
  y: "noxMassTons",
  color: "fuelClass",
  box: "", // "1" = box plot instead of histogram
  log: "", // "1" = log axis
  order: "desc",
  compareBy: "noxControl",
  groups: "SCR|None",
  impactBy: "state",
  perMWh: "", // "1" = impact per MWh
};
export type AnalysisView = typeof DEFAULT_VIEW;

/** The selection when the page opens with no parameters: the complete API years. */
export const DEFAULT_ANALYSIS_FILTERS: FacilityFilters = {
  ...DEFAULT_FILTERS,
  yearMin: "2015",
  yearMax: "2025",
};

type Params = Record<string, string | string[] | undefined>;

export function parseAnalysisParams(params: Params) {
  const get = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const empty = Object.keys(params).length === 0;
  const filters = { ...(empty ? DEFAULT_ANALYSIS_FILTERS : DEFAULT_FILTERS) };
  for (const key of Object.keys(DEFAULT_FILTERS) as (keyof FacilityFilters)[]) {
    filters[key] = get(key) ?? filters[key];
  }
  const view = { ...DEFAULT_VIEW };
  for (const key of Object.keys(DEFAULT_VIEW) as (keyof AnalysisView)[]) {
    const v = get(key);
    if (v !== undefined) (view as Record<string, string>)[key] = v;
  }
  if (!ANALYSIS_TABS.includes(view.tab)) view.tab = DEFAULT_VIEW.tab;
  if (!CHART_TYPES.includes(view.chart)) view.chart = DEFAULT_VIEW.chart;
  return { filters, view };
}

/** The inverse of parseAnalysisParams: active filters plus the non-default view choices. */
export function analysisSearchParams(
  filters: FacilityFilters,
  view: AnalysisView,
) {
  const params = filterSearchParams(filters);
  for (const key of Object.keys(DEFAULT_VIEW) as (keyof AnalysisView)[]) {
    if (view[key] !== DEFAULT_VIEW[key]) params.set(key, view[key]);
  }
  // With no filters left, keep the year range explicit so a reload doesn't restore the default.
  if (![...params.keys()].some((k) => k in DEFAULT_FILTERS)) {
    params.set("yearMin", "");
  }
  return params.toString();
}
