"use client";

import { TooltipCard } from "~/components/ui/chart";
import { colorRamp, HoverCard, useHover, useTokens, useWidth } from "./svg";

const TOKENS = ["chart-slate", "surface-2", "chart-rust"] as const;

/**
 * A labelled matrix of values from −1 to 1 (correlations): slate for negative, rust for
 * positive, the panel color at 0, with the value written in each cell.
 */
export function HeatGrid({
  labels,
  matrix,
  counts,
}: {
  labels: string[];
  matrix: (number | null)[][];
  /** Pairs behind each cell, for the hover card. */
  counts?: number[][];
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { hover, on } = useHover<{ i: number; j: number }>();
  const t = useTokens(TOKENS);
  const labelW = Math.min(
    170,
    Math.max(...labels.map((l) => l.length * 6.6)) + 12,
  );
  const top = 8;
  const n = labels.length;
  // Square cells, capped so the grid stays a compact panel on wide screens.
  const cell = width > 0 ? Math.min(46, Math.max(18, (width - labelW) / n)) : 0;
  const height = top + cell * n + labelW * 0.75;
  const color =
    t && colorRamp([t["chart-slate"], t["surface-2"], t["chart-rust"]]);
  return (
    <div
      ref={ref}
      className="relative w-full"
      style={{ height: height || 400 }}
    >
      {width > 0 && color && (
        <svg width={width} height={height}>
          {matrix.map((row, i) =>
            row.map((v, j) => (
              <g key={`${i}-${j}`} {...on({ i, j })}>
                <rect
                  x={labelW + j * cell}
                  y={top + i * cell}
                  width={cell - 2}
                  height={cell - 2}
                  rx={2}
                  fill={v === null ? "transparent" : color((v + 1) / 2)}
                  stroke={
                    hover?.item.i === i && hover.item.j === j
                      ? "var(--fg)"
                      : "none"
                  }
                />
                {v !== null && cell >= 30 && (
                  <text
                    x={labelW + j * cell + (cell - 2) / 2}
                    y={top + i * cell + (cell - 2) / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={11}
                    className="tabular-nums"
                    fill={Math.abs(v) > 0.55 ? "#fff" : "var(--fg-2)"}
                    pointerEvents="none"
                  >
                    {v.toFixed(2)}
                  </text>
                )}
              </g>
            )),
          )}
          {labels.map((l, i) => (
            <text
              key={`r${l}`}
              x={labelW - 8}
              y={top + i * cell + (cell - 2) / 2}
              textAnchor="end"
              dominantBaseline="central"
              fontSize={12}
              fill="var(--fg-muted)"
            >
              {l}
            </text>
          ))}
          {labels.map((l, j) => {
            const x = labelW + j * cell + (cell - 2) / 2;
            const y = top + n * cell + 8;
            return (
              <text
                key={`c${l}`}
                transform={`translate(${x},${y}) rotate(-40)`}
                textAnchor="end"
                dominantBaseline="central"
                fontSize={12}
                fill="var(--fg-muted)"
              >
                {l}
              </text>
            );
          })}
        </svg>
      )}
      <HoverCard at={hover} width={width}>
        {hover && (
          <TooltipCard
            title={`${labels[hover.item.i]} × ${labels[hover.item.j]}`}
            rows={[
              {
                label: "r",
                value: matrix[hover.item.i]?.[hover.item.j]?.toFixed(3) ?? "—",
              },
              ...(counts
                ? [
                    {
                      label: "Unit-years",
                      value: (
                        counts[hover.item.i]?.[hover.item.j] ?? 0
                      ).toLocaleString(),
                    },
                  ]
                : []),
            ]}
          />
        )}
      </HoverCard>
    </div>
  );
}
