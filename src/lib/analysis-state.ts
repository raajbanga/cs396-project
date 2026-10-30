import {
  DEFAULT_FILTERS,
  filterSearchParams,
  type FacilityFilters,
} from "~/lib/facility-filters";

/**
 * Analyze page state (Phase 2 §4.1: reproducible through URL parameters): the Explore filters
 * plus the active tab and each tab's choices, all as strings so they round-trip through the URL.
 */

const ANALYSIS_TABS = [
  "dataset",
  "statistics",
  "charts",
  "compare",
  "impacts",
] as const;

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
  tab: "dataset" as (typeof ANALYSIS_TABS)[number],
  variable: "co2MassTons",
  by: "state", // "" = no grouping
  chart: "trend" as ChartType,
  series: "fuelClass",
  x: "heatInputMMBtu",
  y: "noxMassTons",
  color: "fuelClass",
  box: "", // "1" = box plot instead of histogram
  log: "", // "1" = log axis
  order: "desc", // ranking: "desc" = highest first
  rankBy: "facility",
  method: "pearson",
  compareBy: "noxControl",
  groups: "SCR|None",
  impactBy: "state",
  perMWh: "", // "1" = impact per MWh
};
export type AnalysisView = typeof DEFAULT_VIEW;

/** The selection when the page opens with no parameters: the complete API years. */
const DEFAULT_ANALYSIS_FILTERS: FacilityFilters = {
  ...DEFAULT_FILTERS,
  yearMin: "2015",
  yearMax: "2025",
};

type Params = Record<string, string | string[] | undefined>;

const first = (params: Params, key: string) => {
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
};

/** `defaults` overridden by the URL's values for the same keys. */
function readView<T extends Record<string, string>>(
  defaults: T,
  params: Params,
): T {
  const view = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T & string)[]) {
    const v = first(params, key);
    if (v !== undefined) view[key] = v as T[typeof key];
  }
  return view;
}

/** The view's non-default values written into `params`. */
export function writeView<T extends Record<string, string>>(
  defaults: T,
  view: T,
  params = new URLSearchParams(),
) {
  for (const key of Object.keys(defaults)) {
    if (view[key] !== defaults[key]) params.set(key, view[key]!);
  }
  return params;
}

export function parseAnalysisParams(params: Params) {
  // Without any filter in the URL (a tab link, say), start from the complete API years.
  const unfiltered = !Object.keys(params).some((k) => k in DEFAULT_FILTERS);
  const filters = readView(
    unfiltered ? DEFAULT_ANALYSIS_FILTERS : DEFAULT_FILTERS,
    params,
  );
  const view = readView(DEFAULT_VIEW, params);
  if (!ANALYSIS_TABS.includes(view.tab)) view.tab = DEFAULT_VIEW.tab;
  if (!CHART_TYPES.includes(view.chart)) view.chart = DEFAULT_VIEW.chart;
  return { filters, view };
}

/** The inverse of parseAnalysisParams: active filters plus the non-default view choices. */
export function analysisSearchParams(
  filters: FacilityFilters,
  view: AnalysisView,
) {
  const params = writeView(DEFAULT_VIEW, view, filterSearchParams(filters));
  // With no filters left, keep the year range explicit so a reload doesn't restore the default.
  if (![...params.keys()].some((k) => k in DEFAULT_FILTERS)) {
    params.set("yearMin", "");
  }
  return params.toString();
}

/** Predict page state (Phase 2 §5–§6): tab, model, baseline unit-year, and analysis inputs. */
export const DEFAULT_PREDICT_VIEW = {
  tab: "models" as "models" | "sensitivity" | "scenarios",
  model: "ridge",
  fid: "1356", // baseline: Ghent unit 2, 2024 (coal, no SCR)
  uid: "2",
  year: "2024",
  input: "heat_input_mmbtu",
  values: "", // "1" = sensitivity range in the input's own unit, else % of the baseline value
  from: "-50",
  to: "50",
  step: "5",
  load: "10", // scenarios: gross load +10 %
  heat: "-5", // heat input −5 %
};
export type PredictView = typeof DEFAULT_PREDICT_VIEW;

export function parsePredictParams(params: Params) {
  const view = readView(DEFAULT_PREDICT_VIEW, params);
  if (!["models", "sensitivity", "scenarios"].includes(view.tab)) {
    view.tab = DEFAULT_PREDICT_VIEW.tab;
  }
  return view;
}
