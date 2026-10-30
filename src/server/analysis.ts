import { and, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import {
  aggregate,
  buildVariables,
  dimension,
  DIMENSIONS,
  groupRows,
  variableInfo,
  type AnalysisRow,
  type DimensionKey,
  type Variable,
} from "~/lib/analysis";
import type { FilterInput } from "~/lib/facility-filters";
import {
  anova,
  describe,
  kruskalWallis,
  mannWhitney,
  meanCi,
  pearson,
  spearman,
  welchT,
} from "~/lib/stats";
import type { TraciFactor } from "~/lib/traci";
import { unitYearConditions } from "~/server/api/routers/facilities";
import { db } from "~/server/db";
import {
  annualRecords,
  facilities,
  traciFactors,
  units,
} from "~/server/db/schema";

/**
 * Phase 2 analyses over the unit-years matching the Explore filters. Each request loads the
 * matching rows once (cached briefly, since a page asks for several views of the same
 * selection) and computes in memory; the browser receives only the results.
 */

const prev = alias(annualRecords, "prev");

/** Async so the cache holds a settled promise: a Drizzle query re-runs on every `await`. */
async function selectRows(filters: FilterInput): Promise<AnalysisRow[]> {
  return db
    .select({
      facilityId: annualRecords.facilityId,
      facilityName: facilities.name,
      stateCode: facilities.stateCode,
      unitInternalId: annualRecords.unitInternalId,
      unitId: units.unitId,
      unitType: units.unitType,
      primaryFuel: units.primaryFuel,
      noxControls: annualRecords.noxControls,
      so2Controls: annualRecords.so2Controls,
      year: annualRecords.year,
      nameplateCapacityMW: units.nameplateCapacityMW,
      operatingHours: annualRecords.operatingHours,
      grossGenerationMWh: annualRecords.grossGenerationMWh,
      heatInputMMBtu: annualRecords.heatInputMMBtu,
      co2MassTons: annualRecords.co2MassTons,
      so2MassTons: annualRecords.so2MassTons,
      noxMassTons: annualRecords.noxMassTons,
      prevGrossGenerationMWh: prev.grossGenerationMWh,
      prevCo2MassTons: prev.co2MassTons,
      prevSo2MassTons: prev.so2MassTons,
      prevNoxMassTons: prev.noxMassTons,
    })
    .from(annualRecords)
    .innerJoin(units, eq(annualRecords.unitInternalId, units.id))
    .innerJoin(facilities, eq(annualRecords.facilityId, facilities.id))
    .leftJoin(
      prev,
      and(
        eq(prev.unitInternalId, annualRecords.unitInternalId),
        eq(prev.year, sql`${annualRecords.year} - 1`),
      ),
    )
    .where(and(...unitYearConditions(filters)));
}

/** Ranking (Top N) is an Explore view, not a selection: analyses ignore it. */
const selection = ({ topN: _n, rankGroup: _g, ...filters }: FilterInput) =>
  filters;

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; rows: Promise<AnalysisRow[]> }>();

export function analysisRows(filters: FilterInput) {
  const key = JSON.stringify(selection(filters));
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.rows;
  if (cache.size > 20) cache.clear();
  const rows = selectRows(selection(filters));
  cache.set(key, { at: Date.now(), rows });
  rows.catch(() => cache.delete(key));
  return rows;
}

export const loadFactors = (): Promise<TraciFactor[]> =>
  db.select().from(traciFactors).orderBy(traciFactors.id);

export async function loadVariables() {
  return buildVariables(await loadFactors());
}

export function findVariable(variables: Variable[], key: string) {
  const v = variables.find((x) => x.key === key);
  if (!v) throw new Error(`Unknown variable: ${key}`);
  return v;
}

/** Variables, dimensions, and TRACI factors for the page's pickers and notes. */
export async function catalog() {
  const factors = await loadFactors();
  return {
    variables: buildVariables(factors).map(variableInfo),
    dimensions: DIMENSIONS.map(({ key, label }) => ({ key, label })),
    factors,
  };
}

/** §4.1: how much was selected, and how much of each variable is missing. */
export function datasetSummary(rows: AnalysisRow[], variables: Variable[]) {
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b);
  return {
    records: rows.length,
    facilities: new Set(rows.map((r) => r.facilityId)).size,
    units: new Set(rows.map((r) => r.unitInternalId)).size,
    years,
    distinct: DIMENSIONS.map((d) => ({
      key: d.key,
      count: new Set(rows.map(d.value)).size,
    })),
    missing: variables.map((v) => ({
      key: v.key,
      missing: rows.reduce((n, r) => n + (v.value(r) === null ? 1 : 0), 0),
    })),
  };
}

/** Groups ordered by their aggregate (desc) or label, keeping the first `limit`. */
function rankedGroups(
  rows: AnalysisRow[],
  by: DimensionKey,
  v: Variable,
  order: "desc" | "asc" | "label",
  limit: number,
) {
  const groups = [...groupRows(rows, by)].map(([group, list]) => ({
    group,
    rows: list,
    value: aggregate(v, list),
  }));
  groups.sort((a, b) =>
    order === "label"
      ? a.group.localeCompare(b.group, undefined, { numeric: true })
      : a.value === null
        ? 1
        : b.value === null
          ? -1
          : order === "desc"
            ? b.value - a.value
            : a.value - b.value,
  );
  return { groups: groups.slice(0, limit), total: groups.length };
}

/** §4.2: a variable's summary statistics overall and, with `by`, per group. */
export function describeVariable(
  rows: AnalysisRow[],
  v: Variable,
  by?: DimensionKey,
  limit = 100,
) {
  const overall = { ...describe(rows.map(v.value)), value: aggregate(v, rows) };
  if (!by) return { overall, groups: [], totalGroups: 0 };
  const { groups, total } = rankedGroups(
    rows,
    by,
    v,
    by === "year" ? "label" : "desc",
    limit,
  );
  return {
    overall,
    groups: groups.map((g) => ({
      group: g.group,
      value: g.value,
      ...describe(g.rows.map(v.value)),
    })),
    totalGroups: total,
  };
}

/**
 * Aggregates of several variables per group (bar charts, rankings, maps, impact tables). With
 * `seriesBy`, each `by` group is split into series, keeping the `limit` largest series by the
 * first variable (line charts: by year, one line per fuel).
 */
export function aggregateTable(
  rows: AnalysisRow[],
  variables: Variable[],
  by: DimensionKey,
  opts: {
    seriesBy?: DimensionKey;
    order?: "desc" | "asc" | "label";
    limit?: number;
  },
) {
  const { seriesBy, limit = 25 } = opts;
  const order = opts.order ?? (by === "year" ? "label" : "desc");
  const lead = variables[0]!;
  const cells = (list: AnalysisRow[]) => ({
    n: list.length,
    values: Object.fromEntries(
      variables.map((v) => [v.key, aggregate(v, list)]),
    ),
  });
  if (!seriesBy) {
    const { groups, total } = rankedGroups(rows, by, lead, order, limit);
    return {
      total,
      rows: groups.map((g) => ({
        group: g.group,
        series: null,
        ...cells(g.rows),
      })),
    };
  }
  const series = rankedGroups(rows, seriesBy, lead, "desc", limit);
  return {
    total: series.total,
    rows: series.groups.flatMap((s) =>
      [...groupRows(s.rows, by)]
        .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
        .map(([group, list]) => ({ group, series: s.group, ...cells(list) })),
    ),
  };
}

/** Every k-th item so at most `max` remain (deterministic, keeps order). */
export function sample<T>(items: T[], max: number) {
  if (items.length <= max) return items;
  const step = items.length / max;
  return Array.from({ length: max }, (_, i) => items[Math.floor(i * step)]!);
}

/** §4.4 histograms and box plots: reported values per group (largest groups by count). */
export function distribution(
  rows: AnalysisRow[],
  v: Variable,
  by?: DimensionKey,
  max = 20_000,
) {
  const groups = by
    ? [...groupRows(rows, by)]
        .sort(([, a], [, b]) => b.length - a.length)
        .slice(0, 12)
    : [["All", rows] as const];
  const all = groups.map(([group, list]) => ({
    group,
    values: list.map(v.value).filter((x): x is number => x !== null),
  }));
  const total = all.reduce((n, g) => n + g.values.length, 0);
  const share = Math.min(1, max / Math.max(total, 1));
  return {
    sampled: share < 1,
    total,
    groups: all.map((g) => ({
      group: g.group,
      values: sample(g.values, Math.ceil(g.values.length * share)),
    })),
  };
}

/** §4.4 scatter plots: complete (x, y) pairs colored by `color`, sampled to `max`. */
export function scatterPoints(
  rows: AnalysisRow[],
  x: Variable,
  y: Variable,
  color: DimensionKey,
  max = 4000,
) {
  const label = dimension("unit").value;
  const colorOf = dimension(color).value;
  const points = rows.flatMap((r) => {
    const px = x.value(r);
    const py = y.value(r);
    return px === null || py === null
      ? []
      : [{ x: px, y: py, group: colorOf(r), label: `${label(r)}, ${r.year}` }];
  });
  return {
    total: points.length,
    points: sample(points, max),
    r: pearson(
      points.map((p) => p.x),
      points.map((p) => p.y),
    ),
  };
}

/** §4.4 correlation heat map: Pearson or Spearman over pairwise-complete unit-years. */
export function correlationMatrix(
  rows: AnalysisRow[],
  variables: Variable[],
  method: "pearson" | "spearman",
) {
  const columns = variables.map((v) => rows.map(v.value));
  const fn = method === "pearson" ? pearson : spearman;
  return {
    keys: variables.map((v) => v.key),
    matrix: columns.map((a, i) =>
      columns.map((b, j) => (i === j ? 1 : fn(a, b))),
    ),
    n: columns.map((a) =>
      columns.map(
        (b) => a.filter((x, k) => x !== null && b[k] !== null).length,
      ),
    ),
  };
}

/**
 * §4.5 comparison of groups along one dimension (states, fuels, with vs without a control,
 * period vs period): per-group statistics with a 95 % CI, differences from the first group,
 * and tests. Values are unit-years, so a test compares unit-year distributions.
 */
export function compareGroups(
  rows: AnalysisRow[],
  v: Variable,
  by: DimensionKey,
  groups: string[],
) {
  const grouped = groupRows(rows, by);
  const sides = groups.map((group) => {
    const list = grouped.get(group) ?? [];
    const values = list.map(v.value).filter((x): x is number => x !== null);
    return {
      group,
      value: aggregate(v, list),
      ...describe(list.map(v.value)),
      ci: meanCi(values),
      values,
    };
  });
  const base = sides[0];
  const withDiffs = sides.map(({ values: _values, ...s }) => ({
    ...s,
    diff: base?.value != null && s.value !== null ? s.value - base.value : null,
    diffPct:
      base?.value && s.value !== null
        ? ((s.value - base.value) / Math.abs(base.value)) * 100
        : null,
  }));
  const samples = sides.map((s) => s.values).filter((xs) => xs.length > 1);
  const two = samples.length === 2 && sides.length === 2;
  return {
    groups: withDiffs,
    tests: {
      welch: two ? welchT(samples[0]!, samples[1]!) : null,
      mannWhitney: two ? mannWhitney(samples[0]!, samples[1]!) : null,
      anova: samples.length >= 2 ? anova(samples) : null,
      kruskal: samples.length >= 2 ? kruskalWallis(samples) : null,
    },
  };
}
