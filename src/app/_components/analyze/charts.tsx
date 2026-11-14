"use client";

import { BarList } from "~/components/charts/bars";
import { BoxPlot, Histogram } from "~/components/charts/distribution";
import { HeatGrid } from "~/components/charts/heat-grid";
import { Lines } from "~/components/charts/lines";
import { ScatterPlot } from "~/components/charts/scatter";
import { StateMap } from "~/components/charts/state-map";
import {
  ChartFrame,
  queryStatus,
  seriesColor,
  type Series,
} from "~/components/ui/chart";
import { Field } from "~/components/ui/report";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { correlationSentence, strongestPairs } from "~/lib/takeaways";
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

/** Fuel classes keep the colors they have on the Map page; other groups take the palette in order. */
const groupColor = (dimension: string | undefined, group: string, i: number) =>
  dimension === "fuelClass" ? getFuelTheme(group).color : seriesColor(i);

/** "; the 8 largest of 15 groups" when a chart shows only part of its groups. */
const shownOf = (shown: number, total = 0, noun = "groups") =>
  total > shown
    ? `; the ${shown} largest of ${formatNumber(total)} ${noun}`
    : "";

/** "Total per year, short tons." */
const per = (info: ReturnType<typeof findInfo>, what: string) =>
  `${combinedLabel(info)} ${what}, ${info?.unit}`;

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
  const series: Series[] = names.map((name, i) => ({
    key: `s${i}`,
    label: name,
    color: seriesBy ? groupColor(seriesBy, name, i) : "var(--chart-slate)",
  }));
  const years = [...new Set(rows.map((r) => Number(r.group)))].sort();
  const data = years.map((x) => ({
    x,
    ...Object.fromEntries(
      names.map((name, i) => [
        `s${i}`,
        rows.find((r) => Number(r.group) === x && (r.series ?? "All") === name)
          ?.values[view.variable] ?? null,
      ]),
    ),
  }));
  return (
    <ChartFrame
      title={`${info?.label} by year${seriesBy ? ` and ${inSentence(dimensionLabel(catalog, seriesBy))}` : ""}`}
      subtitle={`${per(info, "per year")}${seriesBy ? shownOf(8, q.data?.total) : ""}.`}
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
      legend={series}
      filename={`trend-${view.variable}`}
      meta={{ variables: [info] }}
      height={320}
      {...queryStatus(q)}
      table={{
        head: ["year", "group", valueColumn(info), "unit_years"],
        rows: rows.map((r) => [
          r.group,
          r.series ?? "All",
          r.values[view.variable],
          r.n,
        ]),
      }}
    >
      <Lines
        data={data}
        series={series}
        integerX
        xFormat={String}
        unit={info?.unit}
      />
    </ChartFrame>
  );
}

/** Bars of the variable for every group of `by` (largest first), names beside the bars. */
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
  return (
    <ChartFrame
      title={`${info?.label} by ${inSentence(dimensionLabel(catalog, dimension))}`}
      subtitle={`${per(info, "over the selected years")}${shownOf(limit, q.data?.total)}.`}
      note={info?.definition}
      filename={`bars-${view.variable}-by-${dimension}`}
      meta={{ variables: [info] }}
      height={240}
      {...queryStatus(q)}
      table={{
        head: ["rank", dimension, valueColumn(info), "unit_years"],
        rows: rows.map((r, i) => [
          i + 1,
          r.group,
          r.values[view.variable],
          r.n,
        ]),
      }}
    >
      <BarList
        unit={info?.unit}
        rows={rows.map((r, i) => ({
          label: r.group,
          value: r.values[view.variable] ?? null,
          color:
            dimension === "fuelClass"
              ? groupColor(dimension, r.group, i)
              : undefined,
          details: [{ label: "Unit-years", value: r.n.toLocaleString() }],
        }))}
      />
    </ChartFrame>
  );
}

/** §4.4 rankings: the highest or lowest facilities or units, names beside the bars. */
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
  const noun = by === "unit" ? "units" : "facilities";
  return (
    <ChartFrame
      title={`${order === "desc" ? "Highest" : "Lowest"} ${limit} ${noun} by ${info?.label}`}
      subtitle={`${per(info, "over the selected years")}, of ${formatNumber(q.data?.total)} ${noun}.`}
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
      height={limit * 26}
      {...queryStatus(q)}
      table={{
        head: ["rank", by, valueColumn(info), "unit_years"],
        rows: rows.map((r, i) => [
          i + 1,
          r.group,
          r.values[view.variable],
          r.n,
        ]),
      }}
    >
      <BarList
        unit={info?.unit}
        rows={rows.map((r) => ({
          label: r.group,
          value: r.values[view.variable] ?? null,
          details: [{ label: "Unit-years", value: r.n.toLocaleString() }],
        }))}
      />
    </ChartFrame>
  );
}

/** Histogram (one line per group) or box plot of the unit-year values. */
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
  const groups = (q.data?.groups ?? []).map((g, i) => ({
    label: g.group,
    values: g.values,
    // Boxes stand apart by position, so only fuel (which has its own colors) gets color.
    color:
      by && (!box || by === "fuelClass")
        ? groupColor(by, g.group, i)
        : "var(--chart-slate)",
  }));
  // A log axis can't show zero or negative values: they are left out and counted in the note.
  const dropped = log
    ? groups.reduce((n, g) => n + g.values.filter((x) => x <= 0).length, 0)
    : 0;
  return (
    <ChartFrame
      title={`Distribution of ${info?.label}${by ? ` by ${inSentence(dimensionLabel(catalog, by))}` : ""}`}
      subtitle={`${formatNumber(q.data?.total)} unit-years with a value, ${info?.unit}${by ? "; the 12 largest groups" : ""}${box ? ". Box: middle half; line: median; whiskers: 1.5 × IQR" : ""}.`}
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
      legend={box ? undefined : groups.map((g) => ({ key: g.label, ...g }))}
      filename={`distribution-${view.variable}`}
      meta={{ variables: [info], sampled: q.data?.sampled }}
      height={340}
      {...queryStatus(q)}
      table={{
        head: ["group", valueColumn(info)],
        rows: groups.flatMap((g) => g.values.map((v) => [g.label, v])),
      }}
    >
      {box ? (
        <BoxPlot groups={groups} log={log} unit={info?.unit} />
      ) : (
        <Histogram groups={groups} log={log} unit={info?.unit} />
      )}
    </ChartFrame>
  );
}

/** Scatter of two variables over unit-years, colored by a dimension. */
export function ScatterChart(props: TabProps) {
  const { filters, view, setView, catalog } = props;
  const x = findInfo(catalog, view.x);
  const y = findInfo(catalog, view.y);
  const color = asDimension(view.color) ?? "fuelClass";
  const log = view.log === "1";
  const q = api.analysis.scatter.useQuery({
    filters,
    x: view.x,
    y: view.y,
    color,
  });
  const points = q.data?.points ?? [];
  const groups = [...new Set(points.map((p) => p.group))]
    .slice(0, 10)
    .map((group, i) => ({
      label: group,
      color: groupColor(color, group, i),
      points: points
        .filter((p) => p.group === group && (!log || (p.x > 0 && p.y > 0)))
        .map((p) => ({ x: p.x, y: p.y, label: p.label })),
    }));
  return (
    <div className="space-y-4">
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
      <ChartFrame
        title={`${y?.label} against ${x?.label}`}
        subtitle={`${correlationSentence(q.data?.r, x?.label ?? "", y?.label ?? "") ?? ""} ${formatNumber(q.data?.total)} unit-years with both values.`}
        note={[
          q.data &&
            q.data.total > points.length &&
            `An even sample of ${formatNumber(points.length)} is drawn; r uses all of them.`,
          log &&
            "Values of 0 or less can't be drawn on log scales and are left out.",
          "Correlation is association, not cause.",
        ]
          .filter(Boolean)
          .join(" ")}
        legend={groups.map((g) => ({ key: g.label, ...g }))}
        filename={`scatter-${view.y}-vs-${view.x}`}
        meta={{ variables: [x, y], pearsonR: q.data?.r, pairs: q.data?.total }}
        height={440}
        {...queryStatus(q)}
        table={{
          head: ["unit_year", color, valueColumn(x), valueColumn(y)],
          rows: points.map((p) => [p.label, p.group, p.x, p.y]),
        }}
      >
        <ScatterPlot
          groups={groups}
          log={log}
          height={440}
          x={{ title: variableLabel(x), unit: x?.unit ?? "" }}
          y={{ title: variableLabel(y), unit: y?.unit ?? "" }}
        />
      </ChartFrame>
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
  const pairs = strongestPairs(labels, matrix);
  return (
    <ChartFrame
      title={`${method === "pearson" ? "Pearson" : "Spearman"} correlation between variables`}
      subtitle={[
        pairs.strongest.length &&
          `Strongest: ${pairs.strongest.map((p) => `${p.a} with ${p.b} (${p.r.toFixed(2)})`).join("; ")}.`,
        pairs.negative &&
          `Most opposed: ${pairs.negative.a} with ${pairs.negative.b} (${pairs.negative.r.toFixed(2)}).`,
        "Rust: rise together; slate: one falls as the other rises; pale: no link.",
      ]
        .filter(Boolean)
        .join(" ")}
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
      height={440}
      {...queryStatus(q)}
      table={{
        head: ["variable", ...CORRELATION_VARIABLES],
        rows: matrix.map((row, i) => [CORRELATION_VARIABLES[i], ...row]),
      }}
    >
      <HeatGrid labels={labels} matrix={matrix} counts={q.data?.n} />
    </ChartFrame>
  );
}

/** State choropleth of the variable. */
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
    <ChartFrame
      title={`${info?.label} by state`}
      subtitle={`${per(info, "per state")}; outlined states have no value.`}
      note={<>{info?.definition} For facility locations, see the Map page.</>}
      filename={`map-${view.variable}`}
      meta={{ variables: [info] }}
      height={320}
      {...queryStatus(q)}
      table={{
        head: ["state", valueColumn(info), "unit_years"],
        rows: rows.map((r) => [r.group, r.values[view.variable], r.n]),
      }}
    >
      <StateMap
        unit={info?.unit ?? ""}
        values={Object.fromEntries(
          rows.map((r) => [r.group, r.values[view.variable] ?? null]),
        )}
        details={(code) => {
          const n = rows.find((r) => r.group === code)?.n;
          return n ? `${n.toLocaleString()} unit-years` : "";
        }}
      />
    </ChartFrame>
  );
}
