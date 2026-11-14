"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
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
  type TooltipRow,
} from "~/components/ui/chart";
import { useZoom, ZoomHint } from "./zoom";

type Row = { x: number } & Record<string, number | null>;

/**
 * Lines over a numeric x (years, an input's values): no point markers, a dot on hover, optional
 * reference lines, shaded bands, and marked points (e.g. a baseline).
 */
export function Lines({
  data,
  series,
  height = 320,
  xFormat = formatTick,
  integerX,
  xTitle,
  unit = "",
  fromZero = true,
  refLines = [],
  bands = [],
  markers = [],
  tooltipRows,
}: {
  data: Row[];
  series: Series[];
  height?: number;
  xFormat?: (x: number) => string;
  /** Years: whole-number ticks only. */
  integerX?: boolean;
  xTitle?: string;
  /** Appended to tooltip values: "t", "short tons". */
  unit?: string;
  fromZero?: boolean;
  refLines?: { axis: "x" | "y"; value: number; color?: string }[];
  bands?: { from: number; to: number }[];
  markers?: { x: number; y: number; color: string }[];
  /** Extra tooltip rows for a hovered x, after each series' value. */
  tooltipRows?: (row: Row, s: Series) => TooltipRow[];
}) {
  const { zoom, reset, handlers, layer } = useZoom("x");
  const yearTicks = integerX
    ? data
        .map((d) => d.x)
        .filter((x) => !zoom || (x >= zoom.x[0] && x <= zoom.x[1]))
        .filter((x, i, xs) => xs.length <= 12 || i % 2 === 0)
    : undefined;
  return (
    <div>
      <div className="flex h-4 justify-end">
        <ZoomHint zoomed={zoom !== null} reset={reset} />
      </div>
      <div {...handlers} className="select-none">
        <ChartContainer height={height - 16}>
          <LineChart
            data={data}
            margin={{ top: 8, right: 16, bottom: xTitle ? 16 : 0, left: 0 }}
          >
            <CartesianGrid vertical={false} {...gridProps} />
            <XAxis
              dataKey="x"
              type="number"
              domain={zoom?.x ?? ["dataMin", "dataMax"]}
              allowDataOverflow={zoom !== null}
              allowDecimals={!integerX}
              // Years: one tick per year when they fit, else every other year.
              ticks={yearTicks}
              {...axisProps}
              tickFormatter={xFormat}
              label={
                xTitle
                  ? {
                      value: xTitle,
                      position: "insideBottom",
                      offset: -12,
                      fill: "var(--fg-muted)",
                    }
                  : undefined
              }
            />
            <YAxis
              {...axisProps}
              width={56}
              domain={fromZero ? [0, "auto"] : ["auto", "auto"]}
            />
            {bands.map((b) => (
              <ReferenceArea
                key={`${b.from}-${b.to}`}
                x1={b.from}
                x2={b.to}
                fill="var(--fg-muted)"
                fillOpacity={0.08}
                strokeOpacity={0}
              />
            ))}
            {refLines.map((r) => (
              <ReferenceLine
                key={`${r.axis}${r.value}${r.color}`}
                {...{ [r.axis]: r.value }}
                stroke={r.color ?? "var(--fg-muted)"}
                strokeDasharray="4 4"
                strokeOpacity={0.8}
              />
            ))}
            <Tooltip
              cursor={{ stroke: "var(--edge)" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipCard
                    title={xFormat(Number(label))}
                    rows={series.flatMap((s) => {
                      const row = payload[0]!.payload as Row;
                      const v = row[s.key];
                      if (v == null) return [];
                      return [
                        {
                          label: s.label,
                          value: `${formatValue(v)} ${unit}`.trim(),
                          color: s.color,
                        },
                        ...(tooltipRows?.(row, s) ?? []),
                      ];
                    })}
                  />
                ) : null
              }
            />
            {series.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: s.color }}
                connectNulls
                {...still}
              />
            ))}
            {markers.map((m) => (
              <ReferenceDot
                key={`${m.x}-${m.y}-${m.color}`}
                x={m.x}
                y={m.y}
                r={5}
                fill={m.color}
                stroke="var(--surface)"
                strokeWidth={2}
              />
            ))}
            {layer}
          </LineChart>
        </ChartContainer>
      </div>
    </div>
  );
}
