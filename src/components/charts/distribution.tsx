"use client";

import { bin, scaleBand, scaleLinear, scaleLog } from "d3";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  axisProps,
  ChartContainer,
  formatTick,
  formatValue,
  gridProps,
  still,
  TooltipCard,
  type Series,
} from "~/components/ui/chart";
import { quantile } from "~/lib/stats";
import { HoverCard, powersOfTen, useHover, useWidth, YGrid } from "./svg";

/** One group's values and color. */
export interface ValueGroup {
  label: string;
  values: number[];
  color: string;
}

/** On a log scale only positive values can be drawn. */
const usable = (values: number[], log?: boolean) =>
  log ? values.filter((v) => v > 0) : values;

/**
 * Histogram: bars for one group; for several, one line per group over the same bins (overlaid
 * bars hide each other). Log bins evenly in log10, labelled in the original units.
 */
export function Histogram({
  groups,
  log,
  height = 320,
  unit = "",
}: {
  groups: ValueGroup[];
  log?: boolean;
  height?: number;
  unit?: string;
}) {
  const t = (v: number) => (log ? Math.log10(v) : v);
  const shown = groups.map((g) => usable(g.values, log).map(t));
  const all = shown.flat();
  const thresholds = bin()
    .thresholds(40)(all)
    .map((b) => b.x0!);
  const binner = bin()
    .domain([Math.min(...all), Math.max(...all)])
    .thresholds(thresholds);
  const binned = shown.map((values) => binner(values));
  const data = (binned[0] ?? []).map((b, i) => ({
    x0: b.x0!,
    x1: b.x1!,
    ...Object.fromEntries(binned.map((g, j) => [`g${j}`, g[i]?.length ?? 0])),
  }));
  const fromLog = (v: number) => (log ? 10 ** v : v);
  const series: Series[] = groups.map((g, j) => ({
    key: `g${j}`,
    label: g.label,
    color: g.color,
  }));
  const one = groups.length === 1;
  const Chart = one ? BarChart : LineChart;
  return (
    <ChartContainer height={height}>
      <Chart
        data={data}
        margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
        barCategoryGap={1}
      >
        <CartesianGrid vertical={false} {...gridProps} />
        <XAxis
          dataKey="x0"
          {...axisProps}
          tickFormatter={(v: number) => formatTick(fromLog(v))}
          minTickGap={24}
        />
        <YAxis {...axisProps} width={48} allowDecimals={false} />
        <Tooltip
          cursor={{
            fill: "var(--surface-2)",
            fillOpacity: 0.5,
            stroke: "var(--edge)",
          }}
          content={({ active, payload }) => {
            const row = payload?.[0]?.payload as
              (typeof data)[number] | undefined;
            return active && row ? (
              <TooltipCard
                title={`${formatValue(fromLog(row.x0))}–${formatValue(fromLog(row.x1))} ${unit}`}
                rows={series.map((s) => ({
                  label: s.label,
                  value: `${(row as Record<string, number>)[s.key]} unit-years`,
                  color: s.color,
                }))}
              />
            ) : null;
          }}
        />
        {series.map((s) =>
          one ? (
            <Bar
              key={s.key}
              dataKey={s.key}
              fill={s.color}
              fillOpacity={0.85}
              radius={[2, 2, 0, 0]}
              {...still}
            />
          ) : (
            <Line
              key={s.key}
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={1.75}
              dot={false}
              type="step"
              {...still}
            />
          ),
        )}
      </Chart>
    </ChartContainer>
  );
}

interface Box {
  group: ValueGroup;
  n: number;
  lo: number;
  q1: number;
  median: number;
  q3: number;
  hi: number;
}

/** Quartiles, and whiskers to the furthest values within 1.5 IQR of the box (Tukey). */
function boxOf(group: ValueGroup, log?: boolean): Box | null {
  const sorted = usable(group.values, log).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const q1 = quantile(sorted, 0.25)!;
  const q3 = quantile(sorted, 0.75)!;
  const fence = 1.5 * (q3 - q1);
  return {
    group,
    n: sorted.length,
    q1,
    q3,
    median: quantile(sorted, 0.5)!,
    lo: sorted.find((v) => v >= q1 - fence)!,
    hi: [...sorted].reverse().find((v) => v <= q3 + fence)!,
  };
}

const MARGIN = { top: 8, right: 8, bottom: 28, left: 56 };

/** Box plots side by side: the middle half as a box, the median as a line, Tukey whiskers. */
export function BoxPlot({
  groups,
  log,
  height = 340,
  unit = "",
}: {
  groups: ValueGroup[];
  log?: boolean;
  height?: number;
  unit?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { hover, on } = useHover<Box>();
  const boxes = groups.map((g) => boxOf(g, log)).filter((b) => b !== null);
  const lo = Math.min(...boxes.map((b) => b.lo));
  const hi = Math.max(...boxes.map((b) => b.hi));
  const bottom = height - MARGIN.bottom;
  const y = (
    log
      ? scaleLog().domain([lo, hi])
      : scaleLinear().domain([Math.min(0, lo), hi])
  )
    .range([bottom, MARGIN.top])
    .nice();
  const x = scaleBand<string>()
    .domain(boxes.map((b) => b.group.label))
    .range([MARGIN.left, width - MARGIN.right])
    .padding(0.45);
  const [d0, d1] = y.domain() as [number, number];
  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} className="overflow-visible">
          <YGrid
            scale={y}
            left={MARGIN.left}
            right={width - MARGIN.right}
            values={log ? powersOfTen(d0, d1) : undefined}
          />
          {boxes.map((b) => {
            const cx = x(b.group.label)! + x.bandwidth() / 2;
            const w = Math.min(x.bandwidth(), 40);
            return (
              <g key={b.group.label} {...on(b)} className="cursor-default">
                <rect
                  x={cx - x.step() / 2}
                  width={x.step()}
                  y={MARGIN.top}
                  height={bottom - MARGIN.top}
                  fill={hover?.item === b ? "var(--surface-2)" : "transparent"}
                  fillOpacity={0.5}
                />
                <line
                  x1={cx}
                  x2={cx}
                  y1={y(b.lo)}
                  y2={y(b.hi)}
                  stroke={b.group.color}
                  strokeWidth={1.25}
                />
                <rect
                  x={cx - w / 2}
                  width={w}
                  y={y(b.q3)}
                  height={Math.max(1, y(b.q1) - y(b.q3))}
                  rx={2}
                  fill={b.group.color}
                  fillOpacity={0.22}
                  stroke={b.group.color}
                  strokeWidth={1.25}
                />
                <line
                  x1={cx - w / 2}
                  x2={cx + w / 2}
                  y1={y(b.median)}
                  y2={y(b.median)}
                  stroke={b.group.color}
                  strokeWidth={2.5}
                />
                <text
                  x={cx}
                  y={bottom + 18}
                  textAnchor="middle"
                  fontSize={12}
                  fill="var(--fg-muted)"
                >
                  {b.group.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      <HoverCard at={hover} width={width}>
        {hover && (
          <TooltipCard
            title={hover.item.group.label}
            rows={(
              [
                ["Upper whisker", hover.item.hi],
                ["Q3 (75th percentile)", hover.item.q3],
                ["Median", hover.item.median],
                ["Q1 (25th percentile)", hover.item.q1],
                ["Lower whisker", hover.item.lo],
              ] as const
            ).map(([label, v]) => ({
              label,
              value: `${formatValue(v)} ${unit}`,
            }))}
            footer={`${hover.item.n.toLocaleString()} unit-years`}
          />
        )}
      </HoverCard>
    </div>
  );
}
