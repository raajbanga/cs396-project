"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { interpolateRgb, type ScaleContinuousNumeric } from "d3";
import { useTheme } from "next-themes";
import { formatTick } from "~/components/ui/chart";

/**
 * Helpers for the charts Recharts has no shape for (box plot, heat grid, state map): drawn as
 * plain SVG in the same style as the Recharts ones.
 */

/** A container's width, kept current with a ResizeObserver (0 before the first layout). */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry!.contentRect.width)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** What the pointer is over, and where (relative to the chart), for a hover card. */
export function useHover<T>() {
  const [hover, setHover] = useState<{ item: T; x: number; y: number } | null>(
    null,
  );
  /** Pointer handlers for one item: position the card near the pointer. */
  const on = (item: T) => ({
    onPointerMove: (e: React.PointerEvent<SVGElement>) => {
      const box = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
      setHover({ item, x: e.clientX - box.left, y: e.clientY - box.top });
    },
    onPointerLeave: () => setHover(null),
  });
  return { hover, on };
}

/** The hover card, kept inside the chart's width. */
export function HoverCard({
  at,
  width,
  children,
}: {
  at: { x: number; y: number } | null;
  width: number;
  children: ReactNode;
}) {
  if (!at) return null;
  const left = at.x > width - 200 ? at.x - 12 : at.x + 12;
  return (
    <div
      className="pointer-events-none absolute z-10"
      style={{
        left,
        top: at.y + 12,
        transform: at.x > width - 200 ? "translateX(-100%)" : undefined,
      }}
    >
      {children}
    </div>
  );
}

/** Value-axis gridlines and labels, as the Recharts charts draw them. */
export function YGrid({
  scale,
  left,
  right,
  ticks = 5,
  values,
  format = formatTick,
}: {
  scale: ScaleContinuousNumeric<number, number>;
  left: number;
  right: number;
  ticks?: number;
  /** Explicit tick values (log scales: the powers of ten). */
  values?: number[];
  format?: (v: number) => string;
}) {
  return (
    <g>
      {(values ?? scale.ticks(ticks)).map((t) => (
        <g key={t} transform={`translate(0,${scale(t)})`}>
          <line
            x1={left}
            x2={right}
            stroke="var(--edge)"
            strokeDasharray="3 3"
            strokeOpacity={0.8}
          />
          <text
            x={left - 8}
            dominantBaseline="central"
            textAnchor="end"
            fontSize={12}
            fill="var(--fg-muted)"
          >
            {format(t)}
          </text>
        </g>
      ))}
    </g>
  );
}

/** Powers of ten within [lo, hi], for log-axis ticks. */
export const powersOfTen = (lo: number, hi: number) => {
  const out: number[] = [];
  for (let e = Math.ceil(Math.log10(lo)); e <= Math.floor(Math.log10(hi)); e++)
    out.push(10 ** e);
  return out;
};

/** Theme tokens' current values ("--surface-2" → "#e5d9c9"), re-read when the theme changes. */
export function useTokens<K extends string>(names: readonly K[]) {
  const { resolvedTheme } = useTheme();
  const [values, setValues] = useState<Record<K, string> | null>(null);
  useEffect(() => {
    const css = getComputedStyle(document.documentElement);
    setValues(
      Object.fromEntries(
        names.map((n) => [n, css.getPropertyValue(`--${n}`).trim()]),
      ) as Record<K, string>,
    );
  }, [resolvedTheme, names.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  return values;
}

/** A color ramp through `stops` evenly, for t in [0, 1]. */
export const colorRamp = (stops: string[]) => (t: number) => {
  const n = stops.length - 1;
  const x = Math.max(0, Math.min(1, t)) * n;
  const i = Math.min(n - 1, Math.floor(x));
  return interpolateRgb(stops[i]!, stops[i + 1]!)(x - i);
};
