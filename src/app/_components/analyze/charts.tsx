"use client";

import type { Data } from "plotly.js";
import { Chart } from "~/components/ui/chart";
import { Field } from "~/components/ui/report";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { formatStat } from "~/lib/analysis";
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
  inSentence,
  Toggle,
  valueColumn,
  variableLabel,
  VariableField,
  type TabProps,
} from "./shared";

/**
 * The §4.4 charts. Each one draws the tab's selection; the variable picker sits at the top of the
 * tab (shared by its charts), and each chart keeps only its own controls.
 */

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
  total > shown
    ? `; the ${shown} largest of ${formatNumber(total)} ${noun}`
    : "";

/** WebGL draws thousands of points fast; without it (old GPUs, some VMs) Plotly shows an error, so use SVG. */
let webgl: boolean | undefined;
const hasWebGL = () => {
  if (webgl === undefined && typeof document !== "undefined") {
    try {
      webgl = Boolean(document.createElement("canvas").getContext("webgl"));
    } catch {
      webgl = false;
    }
  }
  return webgl ?? true;
};

/** A query's state as Chart props: loading, error, and retry. */
const status = (q: {
  isLoading: boolean;
  error: { message: string } | null;
  refetch: () => unknown;
}) => ({
  isLoading: q.isLoading,
  error: q.error,
  onRetry: () => void q.refetch(),
});

/** Line chart of the variable per year, one line per group. */
export function TrendChart(props: TabProps) {
  const { filters, view, catalog } = props;
  const info = findInfo(catalog, view.variable);
  const seriesBy = asDimension(view.series);
  const q = api.analysis.aggregate.useQuery({
    filters,
    variables: [view.variable],
    by: "year",
    seriesBy,
    limit: 8,
  });
  const rows = q.data?.rows ?? [];
  const names = [...new Set(rows.map((r) => r.series ?? "All"))];
  return (
    <Chart
      title={`${info?.label} by year${seriesBy ? ` and ${inSentence(dimensionLabel(catalog, seriesBy))}` : ""}`}
      subtitle={`${combinedLabel(info)} per year${seriesBy ? shownOf(8, q.data?.total) : ""}.`}
      note={info?.definition}
      actions={
        <DimensionField
          {...bind(props, "series")}
          label=""
          none="One line"
          exclude={["year", "facility", "unit"]}
          className="h-8 w-40"
        />
      }
      filename={`trend-${view.variable}`}
      meta={{ variables: [info] }}
      {...status(q)}
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
  );
}

/** Bars of the variable for every group of `by` (largest first). */
export function BarsChart({
  by,
  limit = 30,
  ...props
}: TabProps & { by: string; limit?: number }) {
  const { filters, view, catalog } = props;
  const info = findInfo(catalog, view.variable);
  const dimension = asDimension(by) ?? "state";
  const q = api.analysis.aggregate.useQuery({
    filters,
    variables: [view.variable],
    by: dimension,
    limit,
  });
  const rows = q.data?.rows ?? [];
  const values = rows.map((r) => r.values[view.variable] ?? null);
  const name = dimensionLabel(catalog, dimension);
  // Many or long names (facilities, units) read better as horizontal bars.
  const horizontal = rows.length > 12 || /facility|unit/.test(dimension);
  return (
    <Chart
      title={`${info?.label} by ${inSentence(name)}`}
      subtitle={`${combinedLabel(info)} over the selected years${shownOf(limit, q.data?.total)}.`}
      note={info?.definition}
      filename={`bars-${view.variable}-by-${dimension}`}
      meta={{ variables: [info] }}
      {...status(q)}
      height={horizontal ? Math.max(360, rows.length * 18 + 80) : 380}
      data={[
        {
          type: "bar",
          orientation: horizontal ? "h" : "v",
          [horizontal ? "y" : "x"]: rows.map((r) => r.group),
          [horizontal ? "x" : "y"]: values,
          marker:
            dimension === "fuelClass"
              ? { color: rows.map((r) => getFuelTheme(r.group).color) }
              : {},
          customdata: rows.map((r) => r.n),
          hovertemplate: `%{${horizontal ? "y" : "x"}}<br>%{${horizontal ? "x" : "y"}:,.4~g} ${info?.unit}<br>%{customdata:,} unit-years<extra></extra>`,
        },
      ]}
      layout={
        horizontal
          ? {
              yaxis: {
                autorange: "reversed",
                automargin: true,
                type: "category",
              },
              xaxis: { title: { text: variableLabel(info) } },
              margin: { l: 16, r: 16, t: 8, b: 48 },
            }
          : {
              xaxis: { title: { text: name }, type: "category" },
              yaxis: { title: { text: variableLabel(info) } },
            }
      }
      table={{
        head: ["rank", dimension, valueColumn(info), "unit_years"],
        rows: rows.map((r, i) => [i + 1, r.group, values[i], r.n]),
      }}
    />
  );
}

/** §4.4 rankings: the highest or lowest facilities or units, horizontal so names stay readable. */
export function RankingChart({
  limit = 15,
  ...props
}: TabProps & { limit?: number }) {
  const { filters, view, setView, catalog } = props;
  const info = findInfo(catalog, view.variable);
  const by = view.rankBy === "unit" ? "unit" : "facility";
  const order = view.order === "asc" ? "asc" : "desc";
  const q = api.analysis.aggregate.useQuery({
    filters,
    variables: [view.variable],
    by,
    order,
    limit,
  });
  const rows = q.data?.rows ?? [];
  const values = rows.map((r) => r.values[view.variable] ?? null);
  const noun = by === "unit" ? "units" : "facilities";
  return (
    <Chart
      title={`${order === "desc" ? "Highest" : "Lowest"} ${limit} ${noun} by ${info?.label}`}
      subtitle={`${combinedLabel(info)} over the selected years, of ${formatNumber(q.data?.total)} ${noun}.`}
      note={info?.definition}
      actions={
        <>
          <SegmentedControl
            value={by}
            onChange={(rankBy) => setView({ rankBy })}
            options={[
              { value: "facility", label: "Facilities" },
              { value: "unit", label: "Units" },
            ]}
          />
          <SegmentedControl
            value={order}
            onChange={(o) => setView({ order: o })}
            options={[
              { value: "desc", label: "Highest" },
              { value: "asc", label: "Lowest" },
            ]}
          />
        </>
      }
      filename={`ranking-${view.variable}-${by}-${order}`}
      meta={{ variables: [info] }}
      {...status(q)}
      height={460}
      data={[
        {
          type: "bar",
          orientation: "h",
          y: rows.map((r) => r.group),
          x: values,
          customdata: rows.map((r) => r.n),
          hovertemplate: `%{y}<br>%{x:,.4~g} ${info?.unit}<br>%{customdata:,} unit-years<extra></extra>`,
        },
      ]}
      layout={{
        yaxis: { autorange: "reversed", automargin: true, type: "category" },
        xaxis: { title: { text: variableLabel(info) } },
        margin: { l: 16, r: 16, t: 8, b: 48 },
      }}
      table={{
        head: ["rank", by, valueColumn(info), "unit_years"],
        rows: rows.map((r, i) => [i + 1, r.group, values[i], r.n]),
      }}
    />
  );
}

/** Histogram (overlaid per group) or box plot of the unit-year values. */
export function DistributionChart(props: TabProps) {
  const { filters, view, setView, catalog } = props;
  const info = findInfo(catalog, view.variable);
  // Facilities and units are too many to draw one shape each.
  const by = /facility|unit/.test(view.by) ? undefined : asDimension(view.by);
  // Overlaid histograms of many groups are unreadable: grouped views default to box plots.
  const box = view.box === "1" || (view.box === "" && Boolean(by));
  const log = view.log === "1";
  const q = api.analysis.distribution.useQuery({
    filters,
    variable: view.variable,
    by,
  });
  const groups = q.data?.groups ?? [];
  // A log axis can't show zero or negative values: they are left out and counted in the note.
  const shown = (xs: number[]) => (log ? xs.filter((x) => x > 0) : xs);
  const dropped = log
    ? groups.reduce((n, g) => n + g.values.filter((x) => x <= 0).length, 0)
    : 0;
  const axis = variableLabel(info);
  return (
    <Chart
      title={`Distribution of ${info?.label}${by ? ` by ${inSentence(dimensionLabel(catalog, by))}` : ""}`}
      subtitle={`${formatNumber(q.data?.total)} unit-years with a value${by ? "; the 12 largest groups" : ""}.`}
      note={[
        q.data?.sampled && "An even sample of 20,000 unit-years is drawn.",
        dropped &&
          `${formatNumber(dropped)} values ≤ 0 are left out on the log scale.`,
        info?.definition,
      ]
        .filter(Boolean)
        .join(" ")}
      actions={
        <>
          <SegmentedControl
            value={box ? "box" : "histogram"}
            onChange={(v) => setView({ box: v === "box" ? "1" : "0" })}
            options={[
              { value: "histogram", label: "Histogram" },
              { value: "box", label: "Box plot" },
            ]}
          />
          <Toggle {...bind(props, "log")} label="" off="Linear" on="Log" />
        </>
      }
      filename={`distribution-${view.variable}`}
      meta={{ variables: [info], sampled: q.data?.sampled }}
      {...status(q)}
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
  );
}

/** Scatter of two variables over unit-years, colored by a dimension. */
export function ScatterChart(props: TabProps) {
  const { filters, view, setView, catalog } = props;
  const x = findInfo(catalog, view.x);
  const y = findInfo(catalog, view.y);
  const color = asDimension(view.color) ?? "fuelClass";
  const axisType = view.log === "1" ? "log" : undefined;
  const q = api.analysis.scatter.useQuery({
    filters,
    x: view.x,
    y: view.y,
    color,
  });
  const points = q.data?.points ?? [];
  const groups = [...new Set(points.map((p) => p.group))].slice(0, 10);
  return (
    <div className="space-y-3">
      <Controls>
        <VariableField {...bind(props, "x")} label="X axis" className="w-72" />
        <VariableField {...bind(props, "y")} label="Y axis" className="w-72" />
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
        subtitle={`${formatNumber(q.data?.total)} unit-years with both values; Pearson r = ${formatStat(q.data?.r)}.`}
        note={[
          q.data &&
            q.data.total > points.length &&
            `An even sample of ${formatNumber(points.length)} is drawn; r uses all of them.`,
          "Correlation is association, not cause.",
        ]
          .filter(Boolean)
          .join(" ")}
        filename={`scatter-${view.y}-vs-${view.x}`}
        meta={{ variables: [x, y], pearsonR: q.data?.r, pairs: q.data?.total }}
        {...status(q)}
        height={460}
        data={groups.map((group): Data => {
          const pts = points.filter((p) => p.group === group);
          return {
            type: hasWebGL() ? "scattergl" : "scatter",
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
    </div>
  );
}

/** Correlation heat map over the main variables. */
export function CorrelationChart({
  filters,
  view,
  setView,
  catalog,
}: TabProps) {
  const method = view.method === "spearman" ? "spearman" : "pearson";
  const q = api.analysis.correlation.useQuery({
    filters,
    variables: CORRELATION_VARIABLES,
    method,
  });
  const infos = CORRELATION_VARIABLES.map((k) => findInfo(catalog, k));
  const labels = infos.map((v, i) => v?.label ?? CORRELATION_VARIABLES[i]!);
  const matrix = q.data?.matrix ?? [];
  return (
    <Chart
      title={`${method === "pearson" ? "Pearson" : "Spearman"} correlation between variables`}
      subtitle="1 = rise together, −1 = one falls as the other rises, 0 = no linear (or rank) link."
      note="Each cell uses the unit-years that report both variables (n on hover). Pearson measures straight-line association; Spearman uses ranks, so a few huge plants matter less. Correlation is association, not cause."
      actions={
        <Field group label="Method">
          <SegmentedControl
            value={method}
            onChange={(m) => setView({ method: m })}
            options={[
              { value: "pearson", label: "Pearson" },
              { value: "spearman", label: "Spearman" },
            ]}
          />
        </Field>
      }
      filename={`correlation-${method}`}
      meta={{ variables: infos, method, pairCounts: q.data?.n }}
      {...status(q)}
      height={560}
      data={[
        {
          type: "heatmap",
          x: labels,
          y: labels,
          z: matrix,
          customdata: (q.data?.n ?? []) as never,
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
  );
}

/** State choropleth of the variable (Plotly's built-in U.S. state shapes). */
export function MapChart(props: TabProps) {
  const { filters, view, catalog } = props;
  const info = findInfo(catalog, view.variable);
  const q = api.analysis.aggregate.useQuery({
    filters,
    variables: [view.variable],
    by: "state",
    limit: 60,
  });
  const rows = q.data?.rows ?? [];
  return (
    <Chart
      title={`${info?.label} by state`}
      subtitle={`${combinedLabel(info)} per state; blank states have no value.`}
      note={<>{info?.definition} For facility locations, see the Map page.</>}
      filename={`map-${view.variable}`}
      meta={{ variables: [info] }}
      {...status(q)}
      height={460}
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
  );
}
