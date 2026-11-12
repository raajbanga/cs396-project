"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useTheme } from "next-themes";
import type { Config, Data, Layout } from "plotly.js";
import { DataPanel } from "~/components/ui/data-panel";
import { InlineLoading, QueryError } from "~/components/ui/empty-state";
import { ExportButton } from "~/components/ui/export-button";
import type { ExportMetadata, ExportTable } from "~/lib/export-bundle";

/** Series colors per theme, led by the app's own accent and status tokens. */
const COLORWAY = {
  light: [
    "#1d4ed8",
    "#b45309",
    "#15803d",
    "#b91c1c",
    "#0369a1",
    "#7c3aed",
    "#0f766e",
    "#be185d",
    "#92400e",
    "#475569",
  ],
  dark: [
    "#7ea6ff",
    "#fbbf24",
    "#4ade80",
    "#f87171",
    "#38bdf8",
    "#c4b5fd",
    "#5eead4",
    "#f9a8d4",
    "#fdba74",
    "#cbd5e1",
  ],
};

const token = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** The theme's tokens as a Plotly layout: transparent paper, app fonts, hairline grid. */
function themeLayout(dark: boolean): Partial<Layout> {
  const axis = {
    gridcolor: token("--edge"),
    linecolor: token("--edge"),
    zerolinecolor: token("--edge"),
    automargin: true,
  };
  return {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: {
      family: getComputedStyle(document.body).fontFamily,
      size: 12,
      color: token("--fg-2"),
    },
    colorway: COLORWAY[dark ? "dark" : "light"],
    margin: { t: 16, r: 16, b: 48, l: 56 },
    hoverlabel: {
      bgcolor: token("--surface"),
      bordercolor: token("--edge"),
      font: { color: token("--fg") },
    },
    legend: { orientation: "h", y: -0.18 },
    xaxis: axis,
    yaxis: axis,
  };
}

/** Shallow-merges each axis so callers set titles without losing the theme's grid colors. */
function mergeLayout(base: Partial<Layout>, layout: Partial<Layout>) {
  const merged: Record<string, unknown> = { ...base, ...layout };
  for (const key of ["xaxis", "yaxis"] as const) {
    merged[key] = { ...base[key], ...layout[key] };
  }
  return merged as Partial<Layout>;
}

/** Error bars default to Plotly's near-black, invisible on the dark theme; give them the text color. */
function themeData(data: Data[]): Data[] {
  const color = token("--fg-2");
  return data.map((trace) => {
    const t = { ...trace } as Record<string, unknown>;
    for (const key of ["error_x", "error_y"]) {
      const bars = t[key] as Record<string, unknown> | undefined;
      if (bars && bars.color === undefined) t[key] = { color, ...bars };
    }
    return t;
  });
}

/** WebGL draws thousands of points fast; without it (old GPUs, some VMs) Plotly shows an error, so use SVG. */
let webgl: boolean | undefined;
/** "scattergl" when the browser has WebGL, else "scatter". */
export const pointsType = (): "scattergl" | "scatter" => {
  if (webgl === undefined && typeof document !== "undefined") {
    try {
      webgl = Boolean(document.createElement("canvas").getContext("webgl"));
    } catch {
      webgl = false;
    }
  }
  return (webgl ?? true) ? "scattergl" : "scatter";
};

/**
 * A titled Plotly chart in a panel (Phase 2 §4.4): zoom, hover tooltips, and PNG export from the
 * mode bar, plus a "Data" button that saves `table`, the image, and metadata as a ZIP (§7). Plotly loads only when a chart mounts.
 */
export function Chart({
  title,
  subtitle,
  data,
  layout = {},
  table,
  meta,
  filename,
  isLoading,
  error,
  onRetry,
  note,
  height = 380,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  data: Data[];
  layout?: Partial<Layout>;
  table?: ExportTable;
  /** Added to the export's metadata.json, e.g. the definitions of the variables shown. */
  meta?: ExportMetadata;
  filename: string;
  isLoading?: boolean;
  /** A failed query: shown in place of the chart, with a retry. */
  error?: { message: string } | null;
  onRetry?: () => void;
  /** Method, definitions, and caveats, under "About this chart", so the subtitle stays one line. */
  note?: ReactNode;
  height?: number;
  actions?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const el = ref.current;
    if (!el || isLoading || error) return;
    let cancelled = false;
    void import("plotly.js-dist-min").then(({ default: Plotly }) => {
      if (cancelled) return;
      const config: Partial<Config> = {
        responsive: true,
        displaylogo: false,
        toImageButtonOptions: { filename, format: "png", scale: 2 },
        modeBarButtonsToRemove: ["lasso2d", "select2d"],
      };
      void Plotly.react(
        el,
        themeData(data),
        mergeLayout(themeLayout(resolvedTheme === "dark"), {
          height,
          ...layout,
        }),
        config,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [data, layout, resolvedTheme, height, filename, isLoading, error]);

  useEffect(() => {
    const el = ref.current;
    return () => {
      if (el)
        void import("plotly.js-dist-min").then(({ default: P }) => P.purge(el));
    };
  }, []);

  return (
    <DataPanel className="p-4">
      <div className="mb-2 flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <h3 className="text-fg text-sm font-semibold text-balance">
            {title}
          </h3>
          {subtitle && (
            <p className="text-fg-muted max-w-[90ch] text-xs text-pretty">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {table && (
            <ExportButton
              variant="ghost"
              label="Download"
              name={filename}
              title={title}
              table={table}
              meta={meta}
              png={async () => {
                const el = ref.current;
                if (!el) return undefined;
                const { default: Plotly } = await import("plotly.js-dist-min");
                const url = await Plotly.toImage(el, {
                  format: "png",
                  scale: 2,
                  width: el.clientWidth,
                  height,
                });
                return new Uint8Array(await (await fetch(url)).arrayBuffer());
              }}
            />
          )}
        </div>
      </div>
      {error ? (
        <QueryError error={error} onRetry={onRetry} />
      ) : isLoading ? (
        <InlineLoading title="Loading…" />
      ) : (
        <div ref={ref} style={{ minHeight: height }} />
      )}
      {note && (
        <details className="text-fg-muted mt-2 text-xs">
          <summary className="hover:text-fg-2 w-fit cursor-pointer">
            About this chart
          </summary>
          <div className="mt-1 max-w-[90ch] space-y-1 text-pretty">{note}</div>
        </details>
      )}
    </DataPanel>
  );
}
