"use client";

import { useRef, type ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { InlineLoading, QueryError } from "~/components/ui/empty-state";
import { ExportButton } from "~/components/ui/export-button";
import type { ExportMetadata, ExportTable } from "~/lib/export-bundle";
import { cn } from "~/lib/utils";

/**
 * The chart system (shadcn/ui charts on Recharts): one palette, one axis style, one tooltip, and
 * one frame around every chart. Charts are quiet by default: horizontal gridlines only, no axis
 * lines or tick marks, no point markers, and color only where it means something (fuel, model,
 * sign).
 */

/** Earthy categorical palette (globals.css), in the order series take it. */
export const PALETTE = [
  "var(--chart-slate)",
  "var(--chart-ochre)",
  "var(--chart-teal)",
  "var(--chart-rust)",
  "var(--chart-plum)",
  "var(--chart-olive)",
  "var(--chart-clay)",
  "var(--chart-sand)",
] as const;

/** The color of series `i` when nothing more meaningful (a fuel, a model) applies. */
export const seriesColor = (i: number) => PALETTE[i % PALETTE.length]!;

/** One series: its key in the data rows, its label, and its color. */
export interface Series {
  key: string;
  label: string;
  color: string;
}

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumSignificantDigits: 3,
});
const plain = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 4 });

/** Axis ticks: "1.4B", "250K", "0.05". */
export const formatTick = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.abs(v) >= 1e4
      ? compact.format(v)
      : plain.format(v)
    : typeof v === "string"
      ? v
      : "";

/** Tooltip and label values: "1,234,567", "0.0123". */
export const formatValue = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v)
    ? v.toLocaleString("en-US", { maximumSignificantDigits: 4 })
    : "—";

const TICK = { fill: "var(--fg-muted)", fontSize: 12 };

/** Shared axis look: no line, no tick marks, muted labels. */
export const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: TICK,
  tickMargin: 8,
  tickFormatter: formatTick,
} as const;

/** Shared grid look: faint dashed lines along the value axis only. */
export const gridProps = {
  stroke: "var(--edge)",
  strokeDasharray: "3 3",
  strokeOpacity: 0.8,
} as const;

/** Recharts animates on every data change; the charts redraw often (filters), so don't. */
export const still = { isAnimationActive: false } as const;

/** A sized, responsive drawing area for a Recharts chart. */
export function ChartContainer({
  height,
  children,
  className,
}: {
  height: number;
  children: React.ReactElement;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full text-xs [&_.recharts-surface]:outline-none",
        className,
      )}
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

/** One tooltip row: swatch, label, value. */
export interface TooltipRow {
  label: ReactNode;
  value: ReactNode;
  color?: string;
}

/** The shadcn tooltip card: a title and aligned rows. */
export function TooltipCard({
  title,
  rows,
  footer,
}: {
  title?: ReactNode;
  rows: TooltipRow[];
  footer?: ReactNode;
}) {
  return (
    <div className="border-edge bg-surface text-fg min-w-36 rounded-md border px-2.5 py-1.5 text-xs shadow-md shadow-black/10">
      {title && <p className="mb-1 font-medium">{title}</p>}
      <div className="space-y-0.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            {r.color && (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: r.color }}
              />
            )}
            <span className="text-fg-muted flex-1">{r.label}</span>
            <span className="font-medium tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>
      {footer && <p className="text-fg-muted mt-1">{footer}</p>}
    </div>
  );
}

/** Small color chips naming the series, above a chart with more than one. */
export function SeriesLegend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="text-fg-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-[2px]"
            style={{ backgroundColor: s.color }}
          />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/** SVG presentation properties a standalone image needs, read from the live chart. */
const INLINE_STYLES = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
];

/**
 * The chart's SVG as a PNG (2×): computed styles are inlined, since CSS variables and classes
 * don't travel with the image, and the panel color fills the background.
 */
async function chartPng(root: HTMLElement | null) {
  const svg = [...(root?.querySelectorAll("svg") ?? [])].sort(
    (a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight,
  )[0];
  if (!svg) return undefined;
  const { width, height } = svg.getBoundingClientRect();
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const live = [svg, ...svg.querySelectorAll("*")];
  const cloned = [copy, ...copy.querySelectorAll("*")];
  live.forEach((el, i) => {
    const css = getComputedStyle(el);
    const target = cloned[i] as SVGElement;
    for (const prop of INLINE_STYLES)
      target.style.setProperty(prop, css.getPropertyValue(prop));
  });
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", String(width));
  copy.setAttribute("height", String(height));
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute(
    "fill",
    getComputedStyle(document.documentElement).getPropertyValue("--surface"),
  );
  copy.insertBefore(bg, copy.firstChild);

  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  ctx.scale(2, 2);
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((r) =>
    canvas.toBlob(r, "image/png"),
  );
  return blob ? new Uint8Array(await blob.arrayBuffer()) : undefined;
}

/** A query's state as ChartFrame props: loading, error, and retry. */
export const queryStatus = (q: {
  isLoading: boolean;
  error: { message: string } | null;
  refetch: () => unknown;
}) => ({
  isLoading: q.isLoading,
  error: q.error,
  onRetry: () => void q.refetch(),
});

/**
 * Every chart's frame (Phase 2 §4.4): title and one-line subtitle, the chart's own controls, a
 * download (CSV + PNG + metadata in a ZIP, §7), an optional legend, and "About this chart" for the
 * method and caveats. No box: a hairline above separates charts.
 */
export function ChartFrame({
  title,
  subtitle,
  note,
  actions,
  legend,
  table,
  meta,
  filename,
  isLoading,
  error,
  onRetry,
  height,
  children,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  /** Method, definitions, and caveats, under "About this chart". */
  note?: ReactNode;
  actions?: ReactNode;
  legend?: Series[];
  table?: ExportTable;
  /** Added to the export's metadata.json, e.g. the definitions of the variables shown. */
  meta?: ExportMetadata;
  filename: string;
  isLoading?: boolean;
  /** A failed query: shown in place of the chart, with a retry. */
  error?: { message: string } | null;
  onRetry?: () => void;
  /** Reserved while loading, so the page doesn't jump. */
  height: number;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <figure
      className={cn("border-edge min-w-0 space-y-3 border-t pt-4", className)}
    >
      <header className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          <h3 className="text-fg text-[15px] font-semibold text-balance">
            {title}
          </h3>
          {subtitle && (
            <p className="text-fg-muted max-w-[80ch] text-xs text-pretty">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
          {table && (
            <ExportButton
              variant="ghost"
              label="Download"
              name={filename}
              title={title}
              table={table}
              meta={meta}
              png={() => chartPng(ref.current)}
            />
          )}
        </div>
      </header>
      {legend && <SeriesLegend series={legend} />}
      {/* The height is held only while there's no chart yet; charts size themselves. */}
      <div
        ref={ref}
        style={{ minHeight: isLoading || error ? height : undefined }}
      >
        {error ? (
          <QueryError error={error} onRetry={onRetry} />
        ) : isLoading ? (
          <InlineLoading title="Loading…" />
        ) : (
          children
        )}
      </div>
      {note && (
        <details className="text-fg-muted text-xs">
          <summary className="hover:text-fg-2 w-fit cursor-pointer">
            About this chart
          </summary>
          <div className="mt-1 max-w-[80ch] space-y-1 text-pretty">{note}</div>
        </details>
      )}
    </figure>
  );
}
