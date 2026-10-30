"use client";

import type { Data } from "plotly.js";
import { Chart } from "~/components/ui/chart";
import { Field } from "~/components/ui/report";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { formatStat } from "~/lib/analysis";
import { CHART_TYPES, type ChartType } from "~/lib/analysis-state";
import { getFuelTheme } from "~/lib/map-utils";
import { formatNumber } from "~/lib/utils";
import { api } from "~/trpc/react";
import {
  asDimension,
  bind,
  combinedLabel,
  Controls,
  DimensionField,
  dimensionLabel,
  findInfo,
  Toggle,
  valueColumn,
  variableLabel,
  VariableField,
  type TabProps,
} from "./shared";

const CHART_LABELS: Record<ChartType, string> = {
  trend: "Trend",
  bars: "Bars",
  distribution: "Distribution",
  scatter: "Scatter",
  correlation: "Correlation",
  ranking: "Ranking",
  map: "State map",
};

/** Variables in the correlation heat map: the measured values and the main rates. */
const CORRELATION_VARIABLES = [
  "grossGenerationMWh",
  "heatInputMMBtu",
  "operatingHours",
  "nameplateCapacityMW",
  "co2MassTons",
  "so2MassTons",
  "noxMassTons",
  "co2Intensity",
  "noxRate",
  "heatRate",
  "capacityFactor",
];

/** Fuel classes keep the colors they have on the Map page; other groups use the chart palette. */
const groupColor = (dimension: string | undefined, group: string) =>
  dimension === "fuelClass" ? getFuelTheme(group).color : undefined;

/** "; the 8 largest of 15 groups" when a chart shows only part of its groups. */
const shownOf = (shown: number, total = 0, noun = "groups") =>
  total > shown ? `; the ${shown} largest of ${total} ${noun}` : "";

/** §4.4 dashboard: one chart at a time over the selection, chosen by type. */
export function ChartsTab(props: TabProps) {
  const { view, setView } = props;
  const Body = CHARTS[view.chart];
  return (
    <div className="space-y-4">
      <SegmentedControl
        value={view.chart}
        onChange={(chart) => setView({ chart })}
        options={CHART_TYPES.map((value) => ({
          value,
          label: CHART_LABELS[value],
        }))}
        className="w-fit max-w-full overflow-x-auto"
      />
      <Body {...props} />
    </div>
  );
}

/** Line chart of a variable per year, one line per group. */
function TrendChart(props: TabProps) {
  const { filters, view, catalog } = props;
  const info = findInfo(catalog, view.variable);
  const seriesBy = asDimension(view.series);
  const { data, isLoading } = api.analysis.aggregate.useQuery({
    filters,
    variables: [view.variable],
    by: "year",
    seriesBy,
    limit: 8,
  });
  const rows = data?.rows ?? [];
  const names = [...new Set(rows.map((r) => r.series ?? "All"))];
  return (
    <>
      <Controls>
        <VariableField {...bind(props, "variable")} />
        <DimensionField
          {...bind(props, "series")}
          label="One line per"
          none="Whole selection"
          exclude={["year"]}
        />
      </Controls>
      <Chart
        title={`${info?.label} by year${seriesBy ? ` and ${dimensionLabel(catalog, seriesBy).toLowerCase()}` : ""}`}
        subtitle={`${combinedLabel(info)} per year${seriesBy ? shownOf(8, data?.total) : ""}. ${info?.definition}`}
        filename={`trend-${view.variable}`}
        meta={{ variables: [info] }}
        isLoading={isLoading}
        data={names.map((name): Data => {
          const points = rows.filter((r) => (r.series ?? "All") === name);
          const color = groupColor(seriesBy, name);
          return {
            type: "scatter",
            mode: "lines+markers",
            name,
            line: { color, width: 2 },
            marker: { color, size: 6 },
            x: points.map((r) => Number(r.group)),
            y: points.map((r) => r.values[view.variable] ?? null),
            hovertemplate: `%{x}: %{y:,.4~g} ${info?.unit}<extra>${name}</extra>`,
          };
        })}
        layout={{
          xaxis: { title: { text: "Reporting year" }, dtick: 1 },
          yaxis: { title: { text: variableLabel(info) }, rangemode: "tozero" },
        }}
        table={{
          head: ["year", "group", valueColumn(info), "unit_years"],
          rows: rows.map((r) => [
            r.group,
            r.series ?? "All",
            r.values[view.variable],
            r.n,
          ]),
        }}
      />
    </>
  );
}

/**
 * Bars per group (any grouping field), or, as a ranking, the highest or lowest 20 facilities or
 * units drawn horizontally so their names stay readable.
 */
function BarsChart({ ranking, ...props }: TabProps & { ranking?: boolean }) {
  const { filters, view, setView, catalog } = props;
  const info = findInfo(catalog, view.variable);
  const by = ranking
    ? view.rankBy === "unit"
      ? "unit"
      : "facility"
    : (asDimension(view.by) ?? "state");
  const order = ranking && view.order === "asc" ? "asc" : "desc";
  const limit = ranking ? 20 : 30;
  const { data, isLoading } = api.analysis.aggregate.useQuery({
    filters,
    variables: [view.variable],
    by,
    order,
    limit,
  });
  const rows = data?.rows ?? [];
  const values = rows.map((r) => r.values[view.variable] ?? null);
  const groupName = dimensionLabel(catalog, by).toLowerCase();
  return (
    <>
      <Controls>
        <VariableField {...bind(props, "variable")} />
        {ranking ? (
          <>
            <Toggle
              label="Rank"
              value={view.rankBy === "unit" ? "1" : ""}
              onChange={(v) => setView({ rankBy: v ? "unit" : "facility" })}
              off="Facilities"
              on="Units"
            />
            <Toggle
              label="Order"
              value={order === "asc" ? "1" : ""}
              onChange={(v) => setView({ order: v ? "asc" : "desc" })}
              off="Highest"
              on="Lowest"
            />
          </>
        ) : (
          <DimensionField
            value={by}
            onChange={(v) => setView({ by: v })}
            catalog={catalog}
            exclude={["unit", "facility"]}
          />
        )}
      </Controls>
      <Chart
        title={
          ranking
            ? `${order === "desc" ? "Highest" : "Lowest"} ${limit} ${groupName === "unit" ? "units" : "facilities"} by ${info?.label}`
            : `${info?.label} by ${groupName}`
        }
        subtitle={`${combinedLabel(info)} over the selected years${shownOf(limit, data?.total, ranking ? `${groupName === "unit" ? "units" : "facilities"}` : "groups")}. ${info?.definition}`}
        filename={`${ranking ? "ranking" : "bars"}-${view.variable}-by-${by}-${order}`}
        meta={{ variables: [info] }}
        isLoading={isLoading}
        height={ranking ? 560 : 400}
        data={[
          {
            type: "bar",
            orientation: ranking ? "h" : "v",
            [ranking ? "y" : "x"]: rows.map((r) => r.group),
            [ranking ? "x" : "y"]: values,
            customdata: rows.map((r) => r.n),
            hovertemplate: `%{${ranking ? "y" : "x"}}<br>%{${ranking ? "x" : "y"}:,.4~g} ${info?.unit}<br>%{customdata:,} unit-years<extra></extra>`,
          },
        ]}
        layout={
          ranking
            ? {
                yaxis: { autorange: "reversed", automargin: true },
                xaxis: { title: { text: variableLabel(info) } },
                margin: { l: 16, r: 16, t: 8, b: 48 },
              }
            : {
                xaxis: {
                  title: { text: dimensionLabel(catalog, by) },
                  type: "category",
                },
                yaxis: { title: { text: variableLabel(info) } },
              }
        }
        table={{
          head: ["rank", by, valueColumn(info), "unit_years"],
          rows: rows.map((r, i) => [i + 1, r.group, values[i], r.n]),
        }}
      />
    </>
  );
}

/** Histogram (overlaid per group) or box plot of the unit-year values. */
function DistributionChart(props: TabProps) {
  const { filters, view, setView, catalog } = props;
  const info = findInfo(catalog, view.variable);
  const by = asDimension(view.by);
  const box = view.box === "1";
  const log = view.log === "1";
  const { data, isLoading } = api.analysis.distribution.useQuery({
    filters,
    variable: view.variable,
    by,
  });
  const groups = data?.groups ?? [];
  // A log axis can't show zero or negative values: they are left out and counted in the subtitle.
  const shown = (xs: number[]) => (log ? xs.filter((x) => x > 0) : xs);
  const dropped = log
    ? groups.reduce((n, g) => n + g.values.filter((x) => x <= 0).length, 0)
    : 0;
  const axis = variableLabel(info);
  return (
    <>
      <Controls>
        <VariableField {...bind(props, "variable")} />
        <DimensionField
          {...bind(props, "by")}
          label="Split by"
          none="No split"
          exclude={["unit", "facility"]}
        />
        <Toggle
          {...bind(props, "box")}
          label="Chart"
          off="Histogram"
          on="Box plot"
        />
        <Toggle
          label="Scale"
          value={view.log}
          onChange={(v) => setView({ log: v })}
          off="Linear"
          on="Log"
        />
      </Controls>
      <Chart
        title={`Distribution of ${info?.label}${by ? ` by ${dimensionLabel(catalog, by).toLowerCase()}` : ""}`}
        subtitle={[
          `${formatNumber(data?.total)} unit-years with a value`,
          data?.sampled && "an even sample of 20,000 is drawn",
          by && "the 12 largest groups",
          dropped &&
            `${formatNumber(dropped)} values ≤ 0 are left out on the log scale`,
        ]
          .filter(Boolean)
          .join("; ")}
        filename={`distribution-${view.variable}`}
        meta={{ variables: [info], sampled: data?.sampled }}
        isLoading={isLoading}
        data={groups.map((g): Data =>
          box
            ? {
                type: "box",
                name: g.group,
                y: shown(g.values),
                boxpoints: false,
                marker: { color: groupColor(by, g.group) },
              }
            : ({
                type: "histogram",
                name: g.group,
                x: log ? shown(g.values).map(Math.log10) : g.values,
                marker: { color: groupColor(by, g.group) },
                opacity: groups.length > 1 ? 0.6 : 0.9,
                nbinsx: 60, // a valid histogram key missing from @types/plotly.js
              } as Data),
        )}
        layout={
          box
            ? {
                yaxis: { title: { text: axis }, type: log ? "log" : undefined },
                showlegend: false,
              }
            : {
                barmode: "overlay",
                xaxis: { title: { text: log ? `log₁₀ ${axis}` : axis } },
                yaxis: { title: { text: "Unit-years" } },
              }
        }
        table={{
          head: ["group", valueColumn(info)],
          rows: groups.flatMap((g) => g.values.map((v) => [g.group, v])),
        }}
      />
    </>
  );
}

/** Scatter of two variables over unit-years, colored by a dimension. */
function ScatterChart(props: TabProps) {
  const { filters, view, setView, catalog } = props;
  const x = findInfo(catalog, view.x);
  const y = findInfo(catalog, view.y);
  const color = asDimension(view.color) ?? "fuelClass";
  const axisType = view.log === "1" ? "log" : undefined;
  const { data, isLoading } = api.analysis.scatter.useQuery({
    filters,
    x: view.x,
    y: view.y,
    color,
  });
  const points = data?.points ?? [];
  const groups = [...new Set(points.map((p) => p.group))].slice(0, 10);
  return (
    <>
      <Controls>
        <VariableField {...bind(props, "x")} label="X axis" />
        <VariableField {...bind(props, "y")} label="Y axis" />
        <DimensionField
          {...bind(props, "color")}
          label="Color by"
          exclude={["unit", "facility", "state"]}
        />
        <Toggle
          label="Scale"
          value={view.log}
          onChange={(v) => setView({ log: v })}
          off="Linear"
          on="Log–log"
        />
      </Controls>
      <Chart
        title={`${y?.label} against ${x?.label}`}
        subtitle={`${formatNumber(data?.total)} unit-years with both values${data && data.total > points.length ? `; an even sample of ${formatNumber(points.length)} is drawn` : ""}. Pearson r = ${formatStat(data?.r)} over all of them.`}
        filename={`scatter-${view.y}-vs-${view.x}`}
        meta={{ variables: [x, y], pearsonR: data?.r, pairs: data?.total }}
        isLoading={isLoading}
        height={460}
        data={groups.map((group): Data => {
          const pts = points.filter((p) => p.group === group);
          return {
            type: "scattergl",
            mode: "markers",
            name: group,
            x: pts.map((p) => p.x),
            y: pts.map((p) => p.y),
            text: pts.map((p) => p.label),
            marker: { size: 5, opacity: 0.6, color: groupColor(color, group) },
            hovertemplate: `%{text}<br>${x?.label}: %{x:,.4~g} ${x?.unit}<br>${y?.label}: %{y:,.4~g} ${y?.unit}<extra>${group}</extra>`,
          };
        })}
        layout={{
          xaxis: { title: { text: variableLabel(x) }, type: axisType },
          yaxis: { title: { text: variableLabel(y) }, type: axisType },
        }}
        table={{
          head: ["unit_year", color, valueColumn(x), valueColumn(y)],
          rows: points.map((p) => [p.label, p.group, p.x, p.y]),
        }}
      />
    </>
  );
}

/** Correlation heat map over the main variables. */
function CorrelationChart({ filters, view, setView, catalog }: TabProps) {
  const method = view.method === "spearman" ? "spearman" : "pearson";
  const { data, isLoading } = api.analysis.correlation.useQuery({
    filters,
    variables: CORRELATION_VARIABLES,
    method,
  });
  const infos = CORRELATION_VARIABLES.map((k) => findInfo(catalog, k));
  const labels = infos.map((v, i) => v?.label ?? CORRELATION_VARIABLES[i]!);
  const matrix = data?.matrix ?? [];
  return (
    <>
      <Controls>
        <Field group label="Method">
          <SegmentedControl
            value={method}
            onChange={(m) => setView({ method: m })}
            options={[
              { value: "pearson", label: "Pearson (linear)" },
              { value: "spearman", label: "Spearman (rank)" },
            ]}
          />
        </Field>
      </Controls>
      <Chart
        title={`${method === "pearson" ? "Pearson" : "Spearman"} correlation between variables`}
        subtitle="Each cell uses the unit-years that report both variables (n on hover). Correlation is association, not cause."
        filename={`correlation-${method}`}
        meta={{ variables: infos, method, pairCounts: data?.n }}
        isLoading={isLoading}
        height={560}
        data={[
          {
            type: "heatmap",
            x: labels,
            y: labels,
            z: matrix,
            customdata: (data?.n ?? []) as never,
            zmin: -1,
            zmax: 1,
            colorscale: "RdBu",
            text: matrix.map((row) =>
              row.map((v) => (v === null ? "" : v.toFixed(2))),
            ) as never,
            texttemplate: "%{text}",
            hovertemplate:
              "%{y} × %{x}<br>r = %{z:.3f}<br>n = %{customdata:,}<extra></extra>",
          },
        ]}
        layout={{
          yaxis: { autorange: "reversed" },
          margin: { l: 140, b: 120, t: 8, r: 16 },
        }}
        table={{
          head: ["variable", ...CORRELATION_VARIABLES],
          rows: matrix.map((row, i) => [CORRELATION_VARIABLES[i], ...row]),
        }}
      />
    </>
  );
}

/** State choropleth of a variable (Plotly's built-in U.S. state shapes). */
function MapChart(props: TabProps) {
  const { filters, view, catalog } = props;
  const info = findInfo(catalog, view.variable);
  const { data, isLoading } = api.analysis.aggregate.useQuery({
    filters,
    variables: [view.variable],
    by: "state",
    limit: 60,
  });
  const rows = data?.rows ?? [];
  return (
    <>
      <Controls>
        <VariableField {...bind(props, "variable")} />
      </Controls>
      <Chart
        title={`${info?.label} by state`}
        subtitle={`${combinedLabel(info)} per state. States with no value are blank. For facility locations, see the Map page.`}
        filename={`map-${view.variable}`}
        meta={{ variables: [info] }}
        isLoading={isLoading}
        height={480}
        data={[
          {
            type: "choropleth",
            locationmode: "USA-states",
            locations: rows.map((r) => r.group),
            z: rows.map((r) => r.values[view.variable] ?? null) as number[],
            customdata: rows.map((r) => r.n) as never,
            colorscale: "YlOrRd",
            reversescale: true,
            marker: { line: { width: 0.5, color: "rgba(128,128,128,0.5)" } },
            colorbar: { title: { text: info?.unit }, thickness: 12 },
            hovertemplate: `%{location}: %{z:,.4~g} ${info?.unit}<br>%{customdata:,} unit-years<extra></extra>`,
          },
        ]}
        layout={{
          geo: {
            scope: "usa",
            bgcolor: "rgba(0,0,0,0)",
            showlakes: false,
            showland: true,
            landcolor: "rgba(128,128,128,0.12)",
          },
          margin: { t: 8, r: 8, b: 8, l: 8 },
        }}
        table={{
          head: ["state", valueColumn(info), "unit_years"],
          rows: rows.map((r) => [r.group, r.values[view.variable], r.n]),
        }}
      />
    </>
  );
}

const CHARTS: Record<ChartType, (props: TabProps) => React.ReactNode> = {
  trend: TrendChart,
  bars: BarsChart,
  distribution: DistributionChart,
  scatter: ScatterChart,
  correlation: CorrelationChart,
  ranking: (props) => <BarsChart {...props} ranking />,
  map: MapChart,
};
