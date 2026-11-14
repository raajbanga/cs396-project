"use client";

import {
  CartesianGrid,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  axisProps,
  ChartContainer,
  formatValue,
  gridProps,
  still,
  TooltipCard,
} from "~/components/ui/chart";
import { powersOfTen } from "./svg";
import { useZoom, ZoomHint, type Zoom } from "./zoom";

export interface PointGroup {
  label: string;
  color: string;
  points: { x: number; y: number; label: string }[];
}

const xTitle = (value: string) => ({
  value,
  position: "insideBottom" as const,
  offset: -12,
  fill: "var(--fg-muted)",
});

/**
 * Points colored by group, small and translucent so dense areas read as density. Log scales for
 * values spanning orders of magnitude; `diagonal` draws y = x (predicted = actual).
 */
export function ScatterPlot({
  groups,
  x,
  y,
  log,
  diagonal,
  height = 420,
}: {
  groups: PointGroup[];
  x: { title: string; unit: string };
  y: { title: string; unit: string };
  log?: boolean;
  diagonal?: [number, number];
  height?: number;
}) {
  const scale = log ? ("log" as const) : ("auto" as const);
  // Log axes span whole powers of ten, ticked at each one (Recharts' own log ticks are arbitrary).
  const all = groups.flatMap((g) => g.points);
  const decades = (vs: number[]) => {
    const pos = vs.filter((v) => v > 0);
    const lo = 10 ** Math.floor(Math.log10(Math.min(...pos)));
    const hi = 10 ** Math.ceil(Math.log10(Math.max(...pos)));
    return { domain: [lo, hi] as [number, number], ticks: powersOfTen(lo, hi) };
  };
  const linear = [(min: number) => Math.min(0, min), "auto"] as const;
  const xs = log && all.length ? decades(all.map((p) => p.x)) : undefined;
  const ys = log && all.length ? decades(all.map((p) => p.y)) : undefined;
  const { zoom, reset, handlers, layer } = useZoom("xy");
  // Zoomed: the dragged box, keeping the power-of-ten ticks inside it (or Recharts' own when
  // fewer than two fit).
  const axis = (
    range: Zoom["x"] | undefined,
    d: ReturnType<typeof decades> | undefined,
  ) => {
    if (!range) return { domain: d?.domain ?? linear, ticks: d?.ticks };
    const inside = d?.ticks.filter((t) => t >= range[0] && t <= range[1]);
    return {
      domain: range,
      ticks: inside && inside.length >= 2 ? inside : undefined,
      allowDataOverflow: true,
    };
  };
  return (
    <div>
      {/* The y title reads across, above its axis, instead of rotated beside the ticks. */}
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <p className="text-fg-muted text-xs">↑ {y.title}</p>
        <ZoomHint zoomed={zoom !== null} reset={reset} />
      </div>
      <div {...handlers} className="select-none">
        <ChartContainer height={height - 20}>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 20, left: 0 }}>
            <CartesianGrid vertical={false} {...gridProps} />
            <XAxis
              type="number"
              dataKey="x"
              scale={scale}
              {...axis(zoom?.x, xs)}
              {...axisProps}
              label={xTitle(x.title)}
            />
            <YAxis
              type="number"
              dataKey="y"
              scale={scale}
              {...axis(zoom?.y, ys)}
              width={56}
              {...axisProps}
            />
            <ZAxis range={[14, 14]} />
            {diagonal && (
              <ReferenceLine
                segment={[
                  { x: diagonal[0], y: diagonal[0] },
                  { x: diagonal[1], y: diagonal[1] },
                ]}
                stroke="var(--fg-muted)"
                strokeDasharray="4 4"
                ifOverflow="hidden"
              />
            )}
            <Tooltip
              cursor={{ stroke: "var(--edge)", strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as
                  | (PointGroup["points"][number] & {
                      group: string;
                      color: string;
                    })
                  | undefined;
                return active && p ? (
                  <TooltipCard
                    title={p.label}
                    rows={[
                      {
                        label: x.title,
                        value: `${formatValue(p.x)} ${x.unit}`,
                      },
                      {
                        label: y.title,
                        value: `${formatValue(p.y)} ${y.unit}`,
                      },
                    ]}
                    footer={p.group}
                  />
                ) : null;
              }}
            />
            {groups.map((g) => (
              <Scatter
                key={g.label}
                name={g.label}
                data={g.points.map((p) => ({
                  ...p,
                  group: g.label,
                  color: g.color,
                }))}
                fill={g.color}
                fillOpacity={0.55}
                {...still}
              />
            ))}
            {layer}
          </ScatterChart>
        </ChartContainer>
      </div>
    </div>
  );
}
