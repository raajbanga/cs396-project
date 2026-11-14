"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  usePlotArea,
  useXAxisInverseScale,
  useYAxisInverseScale,
} from "recharts";

type Range = [number, number];
export interface Zoom {
  x: Range;
  y?: Range;
}
type Box = { x0: number; y0: number; x1: number; y1: number };
type Invert = (px: number, py: number) => [number, number] | null;

/** Smallest drag, in pixels, that counts as a zoom rather than a click. */
const MIN_DRAG = 8;

/**
 * Drag-to-zoom for the Recharts charts (§4.4 lists zooming among Plotly's reasons): drag a box
 * across the plot with a mouse to zoom into it; "Reset zoom" undoes it. Touch is left alone so
 * a finger still scrolls the page. `axes: "x"` zooms the x range only (lines over time or an
 * input); "xy" zooms both (scatter plots).
 */
export function useZoom(axes: "x" | "xy" = "xy") {
  const [zoom, setZoom] = useState<Zoom | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const invert = useRef<Invert | null>(null);

  const at = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const handlers = {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      const p = at(e);
      setBox({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      if (!box) return;
      const p = at(e);
      setBox({ ...box, x1: p.x, y1: p.y });
    },
    onPointerUp: () => {
      const b = box;
      setBox(null);
      if (!b || !invert.current) return;
      const wide = Math.abs(b.x1 - b.x0) >= MIN_DRAG;
      const tall = Math.abs(b.y1 - b.y0) >= MIN_DRAG;
      if (!wide || (axes === "xy" && !tall)) return;
      const a = invert.current(b.x0, b.y0);
      const c = invert.current(b.x1, b.y1);
      if (!a || !c) return;
      const sort = (p: number, q: number): Range => [
        Math.min(p, q),
        Math.max(p, q),
      ];
      setZoom({
        x: sort(a[0], c[0]),
        y: axes === "xy" ? sort(a[1], c[1]) : undefined,
      });
    },
    onPointerLeave: () => setBox(null),
  };

  return {
    zoom,
    reset: () => setZoom(null),
    handlers,
    /** Goes inside the chart: draws the box being dragged and reads the axes' scales. */
    layer: <ZoomLayer box={box} axes={axes} invert={invert} />,
  };
}

function ZoomLayer({
  box,
  axes,
  invert,
}: {
  box: Box | null;
  axes: "x" | "xy";
  invert: React.RefObject<Invert | null>;
}) {
  const xi = useXAxisInverseScale();
  const yi = useYAxisInverseScale();
  const area = usePlotArea();
  useEffect(() => {
    invert.current =
      xi && yi
        ? (px, py) => {
            const x = Number(xi(px));
            const y = Number(yi(py));
            return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
          }
        : null;
  }, [xi, yi, invert]);
  if (!box || !area) return null;
  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v));
  const x0 = clamp(Math.min(box.x0, box.x1), area.x, area.x + area.width);
  const x1 = clamp(Math.max(box.x0, box.x1), area.x, area.x + area.width);
  const y0 =
    axes === "x"
      ? area.y
      : clamp(Math.min(box.y0, box.y1), area.y, area.y + area.height);
  const y1 =
    axes === "x"
      ? area.y + area.height
      : clamp(Math.max(box.y0, box.y1), area.y, area.y + area.height);
  return (
    <rect
      x={x0}
      y={y0}
      width={x1 - x0}
      height={y1 - y0}
      fill="var(--fg)"
      fillOpacity={0.06}
      stroke="var(--fg-muted)"
      strokeDasharray="3 3"
      pointerEvents="none"
    />
  );
}

/** "Drag to zoom" until zoomed, then a button that undoes it. */
export function ZoomHint({
  zoomed,
  reset,
}: {
  zoomed: boolean;
  reset: () => void;
}) {
  return zoomed ? (
    <button
      type="button"
      onClick={reset}
      className="text-fg-muted hover:text-fg text-xs underline underline-offset-2"
    >
      Reset zoom
    </button>
  ) : (
    <span className="text-fg-muted hidden text-xs opacity-70 [@media(pointer:fine)]:inline">
      Drag to zoom
    </span>
  );
}
