"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useTheme } from "next-themes";
import type { Config, Data, Layout } from "plotly.js";
import { DataPanel } from "~/components/ui/data-panel";
import { InlineLoading } from "~/components/ui/empty-state";
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
  height?: number;
  actions?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const el = ref.current;
    if (!el || isLoading) return;
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
        data,
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
  }, [data, layout, resolvedTheme, height, filename, isLoading]);

  useEffect(() => {
    const el = ref.current;
    return () => {
      if (el)
        void import("plotly.js-dist-min").then(({ default: P }) => P.purge(el));
    };
  }, []);

  return (
    <DataPanel className="p-3">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-fg text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-fg-muted text-xs">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {table && (
            <ExportButton
              variant="ghost"
              label="Data"
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
      {isLoading ? (
        <InlineLoading title="Loading…" />
      ) : (
        <div ref={ref} style={{ minHeight: height }} />
      )}
    </DataPanel>
  );
}
