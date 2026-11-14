"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ErrorBar,
  LabelList,
  Rectangle,
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

/** One bar of a BarList: its name, value, and optionally an interval, color, and tooltip extras. */
export interface BarRow {
  label: string;
  value: number | null;
  low?: number | null;
  high?: number | null;
  color?: string;
  /** Lighter: e.g. inputs outside the training data. */
  faded?: boolean;
  details?: TooltipRow[];
}

const ROW = 26;

/** Rough rendered width of the longest name, so the name column fits it (capped). */
const CHAR = 6.6;
const labelWidth = (rows: BarRow[]) =>
  Math.min(240, Math.max(48, ...rows.map((r) => r.label.length * CHAR + 8)));

/** A name cut to fit the name column, on one line. */
const fit = (label: string, width: number) => {
  // Glyphs run wider than the column estimate, so cut a little early to stay on one line.
  const max = Math.floor((width - 8) / (CHAR * 1.12));
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
};

/**
 * Horizontal bars in the given order, names on the left and values written at the bar ends, so
 * no value axis is needed. Negative values (coefficients) grow left from a zero line; intervals
 * draw as whiskers.
 */
export function BarList({
  rows,
  color = "var(--chart-slate)",
  unit = "",
  format = formatTick,
}: {
  rows: BarRow[];
  color?: string;
  /** For the hover card; the chart's subtitle names it, so bar labels leave it out. */
  unit?: string;
  /** Bar-end labels: compact by default ("232M"); the hover card gives the full value. */
  format?: (v: number) => string;
}) {
  const values = rows.flatMap((r) => [r.value, r.high ?? null, r.low ?? null]);
  const finite = values.filter((v): v is number => v != null);
  const max = Math.max(0, ...finite);
  const min = Math.min(0, ...finite);
  const diverging = min < 0;
  const span = Math.max(max, -min);
  // A fixed margin past the longest bar for its label, so it fits however narrow the chart is
  // (a share of the plot width runs out on a phone).
  const labelRoom =
    Math.max(...finite.map((v) => format(v).length), 1) * CHAR + 12;
  // Negative labels sit inside the 35 % of room left of zero; positive ones use the margin.
  const domain = diverging ? [-span * 1.35, span] : [0, max || 1];
  const data = rows.map((r) => ({
    ...r,
    err:
      r.value != null && r.low != null && r.high != null
        ? [r.value - r.low, r.high - r.value]
        : undefined,
  }));
  const hasErr = data.some((r) => r.err);
  const full = (v: number) => `${formatValue(v)}${unit ? ` ${unit}` : ""}`;
  const nameWidth = labelWidth(rows);

  return (
    <ChartContainer height={rows.length * ROW + 8}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{
          top: 0,
          right: labelRoom,
          bottom: 0,
          left: 0,
        }}
        barCategoryGap={5}
      >
        <XAxis type="number" hide domain={domain} />
        <YAxis
          type="category"
          dataKey="label"
          {...axisProps}
          tickFormatter={(l: string) => fit(l, nameWidth)}
          width={nameWidth}
          interval={0}
        />
        {diverging && (
          <ReferenceLine x={0} stroke="var(--fg-muted)" strokeOpacity={0.6} />
        )}
        <Tooltip
          cursor={{ fill: "var(--surface-2)", fillOpacity: 0.5 }}
          content={({ active, payload }) => {
            const r = payload?.[0]?.payload as BarRow | undefined;
            return active && r ? (
              <TooltipCard
                title={r.label}
                rows={[
                  {
                    label: "Value",
                    value: r.value == null ? "—" : full(r.value),
                    color: r.color ?? color,
                  },
                  ...(r.low != null && r.high != null
                    ? [
                        {
                          label: "95 % interval",
                          value: `${formatValue(r.low)}–${formatValue(r.high)}`,
                        },
                      ]
                    : []),
                  ...(r.details ?? []),
                ]}
              />
            ) : null;
          }}
        />
        <Bar
          dataKey="value"
          radius={3}
          maxBarSize={18}
          shape={(p) => {
            const r = data[p.index];
            return (
              <Rectangle
                {...p}
                fill={r?.color ?? color}
                fillOpacity={r?.faded ? 0.35 : 0.9}
              />
            );
          }}
          {...still}
        >
          {hasErr && (
            <ErrorBar
              dataKey="err"
              direction="x"
              width={6}
              stroke="var(--fg-2)"
              strokeWidth={1.25}
            />
          )}
          <LabelList
            dataKey="value"
            content={(p) => {
              const v = Number(p.value);
              if (!Number.isFinite(v)) return null;
              const x = Number(p.x);
              const w = Number(p.width);
              const y = Number(p.y) + Number(p.height) / 2;
              const row = data[Number(p.index)];
              // Past the bar end, or past the interval's end when there is one.
              const reach =
                row?.high != null && v !== 0 ? (w / v) * row.high : w;
              const left = v < 0;
              return (
                <text
                  x={left ? x + Math.min(0, w) - 6 : x + Math.max(reach, 0) + 6}
                  y={y}
                  dominantBaseline="central"
                  textAnchor={left ? "end" : "start"}
                  fontSize={12}
                  fill="var(--fg-2)"
                  className="tabular-nums"
                >
                  {format(v)}
                </text>
              );
            }}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/**
 * Vertical bars per category, one bar per series side by side (scenarios by model). Labels go
 * above the bars; faded bars mark a caveat.
 */
export function Columns({
  data,
  series,
  height = 320,
  unit = "",
  labels,
  faded,
}: {
  data: ({ label: string } & Record<string, number | string | null>)[];
  series: Series[];
  height?: number;
  unit?: string;
  /** The text above a bar, e.g. its change from the baseline. */
  labels?: (row: Record<string, unknown>, key: string) => string;
  faded?: (row: Record<string, unknown>, key: string) => boolean;
}) {
  return (
    <ChartContainer height={height}>
      <BarChart
        data={data}
        margin={{ top: 20, right: 8, bottom: 0, left: 0 }}
        barGap={2}
      >
        <CartesianGrid vertical={false} {...gridProps} />
        <XAxis
          dataKey="label"
          {...axisProps}
          tickFormatter={undefined}
          interval={0}
        />
        <YAxis {...axisProps} width={56} />
        <Tooltip
          cursor={{ fill: "var(--surface-2)", fillOpacity: 0.5 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipCard
                title={String(label)}
                rows={series.map((s) => {
                  const row = payload[0]!.payload as Record<string, unknown>;
                  const v = row[s.key];
                  const extra = labels?.(row, s.key);
                  return {
                    label: s.label,
                    value:
                      `${formatValue(v)} ${unit}${extra ? ` (${extra})` : ""}`.trim(),
                    color: s.color,
                  };
                })}
              />
            ) : null
          }
        />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color}
            radius={[3, 3, 0, 0]}
            maxBarSize={44}
            shape={(p) => (
              <Rectangle
                {...p}
                fillOpacity={faded?.(data[p.index] ?? {}, s.key) ? 0.35 : 0.9}
              />
            )}
            {...still}
          >
            {labels && (
              <LabelList
                dataKey={s.key}
                // Plain text over the bar: Recharts' own label wraps to the bar's width.
                content={(p) => {
                  const row = data[Number(p.index)];
                  const text = row ? labels(row, s.key) : "";
                  return text ? (
                    <text
                      x={Number(p.x) + Number(p.width) / 2}
                      y={Number(p.y) - 6}
                      textAnchor="middle"
                      fontSize={11}
                      fill="var(--fg-2)"
                      className="tabular-nums"
                    >
                      {text}
                    </text>
                  ) : null;
                }}
              />
            )}
          </Bar>
        ))}
      </BarChart>
    </ChartContainer>
  );
}
