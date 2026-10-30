"use client";

import type { Data } from "plotly.js";
import { Chart } from "~/components/ui/chart";
import { Field } from "~/components/ui/report";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Select } from "~/components/ui/select";
import { AGGREGATION_LABELS, formatStat } from "~/lib/analysis";
import { CHART_TYPES, type ChartType } from "~/lib/analysis-state";
import { getFuelTheme } from "~/lib/map-utils";
import { formatNumber } from "~/lib/utils";
import { api } from "~/trpc/react";
import {
  asDimension,
  Controls,
  DimensionField,
  dimensionLabel,
  findInfo,
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

const toggle = (on: boolean) => (on ? "1" : "");

/** Fuel classes keep the colors they have on the Map page; other groups use the chart palette. */
const groupColor = (dimension: string | undefined, group: string) =>
  dimension === "fuelClass" ? getFuelTheme(group).color : undefined;

/** An on/off choice as a two-way segmented control. */
function Toggle({
  label,
  value,
  onChange,
  off,
  on,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  off: string;
  on: string;
}) {
  return (
    <Field label={label}>
      <SegmentedControl
        value={value || "0"}
        onChange={(v) => onChange(v === "1" ? "1" : "")}
        options={[
          { value: "0", label: off },
          { value: "1", label: on },
        ]}
      />
    </Field>
  );
}

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
function TrendChart({ filters, view, setView, catalog }: TabProps) {
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
  const traces: Data[] = names.map((name) => {
    const points = rows.filter((r) => (r.series ?? "All") === name);
    return {
      type: "scatter",
      mode: "lines+markers",
      name,
      line: { color: groupColor(seriesBy, name) },
      marker: { color: groupColor(seriesBy, name) },
      x: points.map((r) => Number(r.group)),
      y: points.map((r) => r.values[view.variable] ?? null),
      hovertemplate: `%{x}: %{y:,.4~g} ${info?.unit}<extra>${name}</extra>`,
    };
  });
  const combined = info ? AGGREGATION_LABELS[info.aggregation] : "";
  return (
    <>
      <Controls>
        <VariableField
          value={view.variable}
          onChange={(variable) => setView({ variable })}
          catalog={catalog}
        />
        <DimensionField
          label="One line per"
          value={view.series}
          onChange={(series) => setView({ series })}
          catalog={catalog}
          none="Whole selection"
          exclude={["year"]}
        />
      </Controls>
      <Chart
        title={`${info?.label} by year${seriesBy ? ` and ${dimensionLabel(catalog, seriesBy).toLowerCase()}` : ""}`}
        subtitle={`${combined} per year${seriesBy && data && data.total > 8 ? `; the 8 largest of ${data.total} groups` : ""}. ${info?.definition}`}
        filename={`trend-${view.variable}`}
        meta={{ variables: [info] }}
        isLoading={isLoading}
        data={traces}
        layout={{
          xaxis: { title: { text: "Reporting year" }, dtick: 1 },
          yaxis: { title: { text: variableLabel(info) } },
        }}
        table={{
          head: [
            "year",
            "group",
            `${view.variable} (${info?.unit})`,
            "unit_years",
          ],
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

/** Bar chart of a variable per group, largest first. */
function BarsChart({ filters, view, setView, catalog }: TabProps) {
  const info = findInfo(catalog, view.variable);
  const by = asDimension(view.by) ?? "state";
  const { data, isLoading } = api.analysis.aggregate.useQuery({
    filters,
    variables: [view.variable],
    by,
    limit: 30,
  });
  const rows = data?.rows ?? [];
  return (
    <>
      <Controls>
        <VariableField
          value={view.variable}
          onChange={(variable) => setView({ variable })}
          catalog={catalog}
        />
        <DimensionField
          value={by}
          onChange={(v) => setView({ by: v })}
          catalog={catalog}
          exclude={["unit", "facility"]}
        />
      </Controls>
      <Chart
        title={`${info?.label} by ${dimensionLabel(catalog, by).toLowerCase()}`}
        subtitle={`${info ? AGGREGATION_LABELS[info.aggregation] : ""} per group${data && data.total > 30 ? `; the 30 largest of ${data.total}` : ""}. ${info?.definition}`}
        filename={`bars-${view.variable}-by-${by}`}
        meta={{ variables: [info] }}
        isLoading={isLoading}
        data={[
          {
            type: "bar",
            x: rows.map((r) => r.group),
            y: rows.map((r) => r.values[view.variable] ?? null),
            customdata: rows.map((r) => r.n),
            hovertemplate: `%{x}: %{y:,.4~g} ${info?.unit}<br>%{customdata:,} unit-years<extra></extra>`,
          },
        ]}
        layout={{
          xaxis: {
            title: { text: dimensionLabel(catalog, by) },
            type: by === "year" ? "category" : undefined,
          },
          yaxis: { title: { text: variableLabel(info) } },
        }}
        table={{
          head: [by, `${view.variable} (${info?.unit})`, "unit_years"],
          rows: rows.map((r) => [r.group, r.values[view.variable], r.n]),
        }}
      />
    </>
  );
}

/** Histogram (overlaid per group) or box plot of the unit-year values. */
function DistributionChart({ filters, view, setView, catalog }: TabProps) {
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
  const traces: Data[] = groups.map((g) =>
    box
      ? {
          type: "box",
          name: g.group,
          y: shown(g.values),
          boxpoints: false,
          marker: { color: groupColor(by, g.group) },
        }
      : {
          type: "histogram",
          name: g.group,
          marker: { color: groupColor(by, g.group) },
          x: log ? shown(g.values).map(Math.log10) : g.values,
          opacity: groups.length > 1 ? 0.6 : 1,
          nbinsx: 60,
        },
  );
  const axis = variableLabel(info);
  return (
    <>
      <Controls>
        <VariableField
          value={view.variable}
          onChange={(variable) => setView({ variable })}
          catalog={catalog}
        />
        <DimensionField
          label="Split by"
          value={view.by}
          onChange={(v) => setView({ by: v })}
          catalog={catalog}
          none="No split"
          exclude={["unit", "facility"]}
        />
        <Toggle
          label="Chart"
          value={view.box}
          onChange={(box) => setView({ box })}
          off="Histogram"
          on="Box plot"
        />
        <Toggle
          label="Scale"
          value={view.log}
          onChange={(log) => setView({ log })}
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
        data={traces}
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
          head: ["group", `${view.variable} (${info?.unit})`],
          rows: groups.flatMap((g) => g.values.map((v) => [g.group, v])),
        }}
      />
    </>
  );
}

/** Scatter of two variables over unit-years, colored by a dimension. */
function ScatterChart({ filters, view, setView, catalog }: TabProps) {
  const x = findInfo(catalog, view.x);
  const y = findInfo(catalog, view.y);
  const color = asDimension(view.color) ?? "fuelClass";
  const log = view.log === "1";
  const { data, isLoading } = api.analysis.scatter.useQuery({
    filters,
    x: view.x,
    y: view.y,
    color,
  });
  const points = data?.points ?? [];
  const groups = [...new Set(points.map((p) => p.group))].slice(0, 10);
  const traces: Data[] = groups.map((group) => {
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
  });
  return (
    <>
      <Controls>
        <VariableField
          label="X axis"
          value={view.x}
          onChange={(v) => setView({ x: v })}
          catalog={catalog}
          className="w-64"
        />
        <VariableField
          label="Y axis"
          value={view.y}
          onChange={(v) => setView({ y: v })}
          catalog={catalog}
          className="w-64"
        />
        <DimensionField
          label="Color by"
          value={color}
          onChange={(v) => setView({ color: v })}
          catalog={catalog}
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
        data={traces}
        height={460}
        layout={{
          xaxis: {
            title: { text: variableLabel(x) },
            type: log ? "log" : undefined,
          },
          yaxis: {
            title: { text: variableLabel(y) },
            type: log ? "log" : undefined,
          },
        }}
        table={{
          head: [
            "unit_year",
            color,
            `${view.x} (${x?.unit})`,
            `${view.y} (${y?.unit})`,
          ],
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
  const labels = CORRELATION_VARIABLES.map(
    (k) => findInfo(catalog, k)?.label ?? k,
  );
  return (
    <>
      <Controls>
        <Field label="Method">
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
        meta={{
          variables: CORRELATION_VARIABLES.map((k) => findInfo(catalog, k)),
          method,
          pairCounts: data?.n,
        }}
        isLoading={isLoading}
        height={560}
        data={[
          {
            type: "heatmap",
            x: labels,
            y: labels,
            z: data?.matrix ?? [],
            customdata: (data?.n ?? []) as never,
            zmin: -1,
            zmax: 1,
            colorscale: "RdBu",
            text: (data?.matrix ?? []).map((row) =>
              row.map((v) => (v === null ? "" : v.toFixed(2))),
            ) as never,
            texttemplate: "%{text}",
            hovertemplate:
              "%{y} × %{x}<br>r = %{z:.3f}<br>n = %{customdata:,}<extra></extra>",
          },
        ]}
        layout={{
          yaxis: { autorange: "reversed" },
          margin: { l: 140, b: 120, t: 16, r: 16 },
        }}
        table={{
          head: ["variable", ...CORRELATION_VARIABLES],
          rows: (data?.matrix ?? []).map((row, i) => [
            CORRELATION_VARIABLES[i],
            ...row,
          ]),
        }}
      />
    </>
  );
}

/** Top or bottom 20 facilities or units by a variable, as horizontal bars. */
function RankingChart({ filters, view, setView, catalog }: TabProps) {
  const info = findInfo(catalog, view.variable);
  const by = view.rankBy === "unit" ? "unit" : "facility";
  const order = view.order === "asc" ? "asc" : "desc";
  const { data, isLoading } = api.analysis.aggregate.useQuery({
    filters,
    variables: [view.variable],
    by,
    order,
    limit: 20,
  });
  const rows = data?.rows ?? [];
  return (
    <>
      <Controls>
        <VariableField
          value={view.variable}
          onChange={(variable) => setView({ variable })}
          catalog={catalog}
        />
        <Field label="Rank">
          <Select
            value={by}
            onValueChange={(rankBy) => setView({ rankBy })}
            className="w-32"
            options={[
              { value: "facility", label: "Facilities" },
              { value: "unit", label: "Units" },
            ]}
          />
        </Field>
        <Toggle
          label="Order"
          value={toggle(order === "asc")}
          onChange={(v) => setView({ order: v ? "asc" : "desc" })}
          off="Highest"
          on="Lowest"
        />
      </Controls>
      <Chart
        title={`${order === "desc" ? "Highest" : "Lowest"} 20 ${by === "unit" ? "units" : "facilities"} by ${info?.label}`}
        subtitle={`${info ? AGGREGATION_LABELS[info.aggregation] : ""} over the selected years, among ${formatNumber(data?.total)} ${by === "unit" ? "units" : "facilities"}. ${info?.definition}`}
        filename={`ranking-${by}-${view.variable}-${order}`}
        meta={{ variables: [info] }}
        isLoading={isLoading}
        height={560}
        data={[
          {
            type: "bar",
            orientation: "h",
            y: rows.map((r) => r.group),
            x: rows.map((r) => r.values[view.variable] ?? null),
            customdata: rows.map((r) => r.n),
            hovertemplate: `%{y}<br>%{x:,.4~g} ${info?.unit}<br>%{customdata} unit-years<extra></extra>`,
          },
        ]}
        layout={{
          yaxis: { autorange: "reversed", automargin: true },
          xaxis: { title: { text: variableLabel(info) } },
          margin: { l: 16, r: 16, t: 16, b: 48 },
        }}
        table={{
          head: ["rank", by, `${view.variable} (${info?.unit})`, "unit_years"],
          rows: rows.map((r, i) => [
            i + 1,
            r.group,
            r.values[view.variable],
            r.n,
          ]),
        }}
      />
    </>
  );
}

/** State choropleth of a variable (Plotly's built-in U.S. state shapes). */
function MapChart({ filters, view, setView, catalog }: TabProps) {
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
        <VariableField
          value={view.variable}
          onChange={(variable) => setView({ variable })}
          catalog={catalog}
        />
      </Controls>
      <Chart
        title={`${info?.label} by state`}
        subtitle={`${info ? AGGREGATION_LABELS[info.aggregation] : ""} per state. States with no value are blank. For facility locations, see the Map page.`}
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
            colorbar: { title: { text: info?.unit } },
            hovertemplate: `%{location}: %{z:,.4~g} ${info?.unit}<br>%{customdata:,} unit-years<extra></extra>`,
          },
        ]}
        layout={{
          geo: { scope: "usa", bgcolor: "rgba(0,0,0,0)", showlakes: false },
          margin: { t: 8, r: 8, b: 8, l: 8 },
        }}
        table={{
          head: ["state", `${view.variable} (${info?.unit})`, "unit_years"],
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
  ranking: RankingChart,
  map: MapChart,
};
