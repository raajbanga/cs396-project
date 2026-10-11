"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import {
  Compass,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import { useTheme } from "next-themes";
import * as topojson from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { Button } from "~/components/ui/button";
import {
  getFuelTheme,
  getMarkerRadius,
  MAP_FRAME,
  readThemeColors,
  withAlpha,
  type MapFacility,
  type MetricMode,
} from "~/lib/map-utils";
import { cn } from "~/lib/utils";
import { MapHoverCard } from "./map-hover-card";

type Rotation = [number, number, number];
type Projection = ReturnType<typeof createProjection>;

interface GeoLayers {
  land: d3.GeoPermissibleObjects;
  states: d3.GeoPermissibleObjects;
  nation: d3.GeoPermissibleObjects;
}

const MIN_SCALE = 160;
const MAX_SCALE = 10000;
const clampScale = (scale: number) =>
  Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
const HOME_VIEW = { yaw: 98, pitch: -38, scale: 380 };
const PRESETS = [
  { label: "US", ...HOME_VIEW },
  { label: "East", yaw: 78, pitch: -38, scale: 560 },
  { label: "Texas", yaw: 99, pitch: -31, scale: 720 },
  { label: "West", yaw: 118, pitch: -38, scale: 560 },
];
const HUD_BUTTON = "text-fg-2 hover:text-fg hover:bg-surface-2/60 h-7 px-2";
const HUD_PANEL =
  "border-edge bg-surface pointer-events-auto flex items-center gap-1 rounded-md border p-1";

/** Canvas colors, derived from the theme tokens at draw time. */
function globePalette() {
  const t = readThemeColors();
  const ink = (alpha: number) => withAlpha(t.fg, alpha);
  return {
    rim: [ink(0), ink(0.02), ink(0.06)],
    sphere: [t.surface, t.canvas, t.surface2],
    sphereEdge: ink(0.18),
    graticule: ink(0.07),
    equator: ink(0.12),
    landFill: t.surface2,
    landEdge: ink(0.25),
    states: ink(0.2),
    nation: ink(0.5),
    hoverHalo: ink(0.25),
    dotEdge: t.canvas,
    hoverRing: t.fg,
  };
}

export function MapSpinner({ label }: { label: string }) {
  return (
    <div className="text-fg-muted flex items-center gap-2 text-xs">
      <div className="border-fg-muted h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
      {label}
    </div>
  );
}

function createProjection(
  width: number,
  height: number,
  scale: number,
  rotation: Rotation,
) {
  return d3
    .geoOrthographic()
    .scale(scale)
    .translate([width / 2, height / 2])
    .rotate(rotation)
    .clipAngle(90);
}

/** Screen position of a plant, or null when it sits on the far side of the globe. */
function projectVisible(
  projection: Projection,
  rotation: Rotation,
  plant: MapFacility,
) {
  const lonLat: [number, number] = [plant.longitude, plant.latitude];
  if (d3.geoDistance(lonLat, [-rotation[0], -rotation[1]]) > Math.PI / 2)
    return null;
  return projection(lonLat);
}

function findPlantAt(
  facilities: MapFacility[],
  projection: Projection,
  rotation: Rotation,
  x: number,
  y: number,
  tolerance: number,
) {
  let closest: MapFacility | null = null;
  let minDistance = tolerance;
  for (const plant of facilities) {
    const point = projectVisible(projection, rotation, plant);
    const distance = point ? Math.hypot(point[0] - x, point[1] - y) : Infinity;
    if (distance < minDistance) {
      minDistance = distance;
      closest = plant;
    }
  }
  return closest;
}

async function loadGeoLayers(): Promise<GeoLayers> {
  const [landTopo, statesTopo] = (await Promise.all(
    ["/geo/world-land-110m.json", "/geo/us-states-10m.json"].map(
      async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load ${url}`);
        return res.json() as Promise<unknown>;
      },
    ),
  )) as [
    Topology<{ land: GeometryCollection }>,
    Topology<{ states: GeometryCollection; nation: GeometryCollection }>,
  ];
  const toGeo = (topo: Topology, obj: GeometryCollection) =>
    topojson.feature(topo, obj) as unknown as d3.GeoPermissibleObjects;
  return {
    land: toGeo(landTopo, landTopo.objects.land),
    states: toGeo(statesTopo, statesTopo.objects.states),
    nation: toGeo(statesTopo, statesTopo.objects.nation),
  };
}

export function D3Globe({
  facilities,
  onInspectFacility,
  metricMode,
}: {
  facilities: MapFacility[];
  onInspectFacility: (id: number) => void;
  metricMode: MetricMode;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // The canvas is painted in effects (client-only), so the resolved theme is safe to read directly.
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  const [geo, setGeo] = useState<GeoLayers | null>(null);
  const [isLoadingGeo, setIsLoadingGeo] = useState(true);
  const [rotation, setRotation] = useState<Rotation>([
    HOME_VIEW.yaw,
    HOME_VIEW.pitch,
    0,
  ]);
  const [scale, setScale] = useState(HOME_VIEW.scale);
  const [autoRotate, setAutoRotate] = useState(false);
  const [hoveredPlant, setHoveredPlant] = useState<MapFacility | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(
    null,
  );

  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const downPosRef = useRef({ x: 0, y: 0 });
  const dragMovedRef = useRef(false);

  useEffect(() => {
    let active = true;
    loadGeoLayers()
      .then((layers) => active && setGeo(layers))
      .catch((err) => console.error("Error loading geo topology:", err))
      .finally(() => active && setIsLoadingGeo(false));
    return () => {
      active = false;
    };
  }, []);

  const renderGlobe = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const cx = width / 2;
    const cy = height / 2;
    const palette = globePalette();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const projection = createProjection(
      width,
      height,
      scale,
      rotation,
    ).precision(0.3);
    const path = d3.geoPath(projection, ctx);
    const strokePath = (
      obj: d3.GeoPermissibleObjects,
      lineWidth: number,
      strokeStyle: string,
      fillStyle?: string,
    ) => {
      ctx.beginPath();
      path(obj);
      if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.fill();
      }
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = strokeStyle;
      ctx.stroke();
    };

    // Atmosphere rim glow
    const rim = ctx.createRadialGradient(
      cx,
      cy,
      scale * 0.85,
      cx,
      cy,
      scale * 1.06,
    );
    [0, 0.7, 0.95, 1].forEach((stop, i) =>
      rim.addColorStop(stop, palette.rim[i % 3]!),
    );
    ctx.beginPath();
    ctx.arc(cx, cy, scale * 1.06, 0, Math.PI * 2);
    ctx.fillStyle = rim;
    ctx.fill();

    // Sphere, graticule, and equator
    const sphere = ctx.createRadialGradient(
      cx - scale * 0.25,
      cy - scale * 0.25,
      scale * 0.1,
      cx,
      cy,
      scale,
    );
    palette.sphere.forEach((stop, i) =>
      sphere.addColorStop([0, 0.8, 1][i]!, stop),
    );
    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.fillStyle = sphere;
    ctx.fill();
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = palette.sphereEdge;
    ctx.stroke();
    strokePath(d3.geoGraticule10(), 0.5, palette.graticule);
    strokePath(
      {
        type: "LineString",
        coordinates: [
          [-180, 0],
          [180, 0],
        ],
      },
      0.75,
      palette.equator,
    );

    // Land, US states, and the US national outline
    if (geo) {
      strokePath(geo.land, 0.75, palette.landEdge, palette.landFill);
      strokePath(geo.states, 0.6, palette.states);
      strokePath(geo.nation, 1.4, palette.nation);
    }

    // Facilities (back-face culled)
    const zoomBonus = Math.min(3.5, Math.max(0, (scale - 400) / 1200));
    for (const plant of facilities) {
      const point = projectVisible(projection, rotation, plant);
      if (!point) continue;
      const [px, py] = point;
      const fuelTheme = getFuelTheme(plant.primaryFuel);
      const r = getMarkerRadius(plant, metricMode, {
        min: 2.5,
        max: 10,
        capacityScale: 0.12,
        co2Scale: 0.003,
        uniformBase: 3,
        zoomBonus,
      });
      const isHovered = hoveredPlant?.id === plant.id;

      ctx.beginPath();
      ctx.arc(px, py, r + (isHovered ? 3 : 1), 0, Math.PI * 2);
      ctx.fillStyle = isHovered ? palette.hoverHalo : fuelTheme.glow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py, isHovered ? r + 1.5 : r, 0, Math.PI * 2);
      ctx.fillStyle = fuelTheme.color;
      ctx.fill();
      ctx.lineWidth = isDark ? 0.75 : 1;
      ctx.strokeStyle = palette.dotEdge;
      ctx.stroke();

      if (isHovered) {
        ctx.beginPath();
        ctx.arc(px, py, r + 5, 0, Math.PI * 2);
        ctx.lineWidth = 1.75;
        ctx.strokeStyle = palette.hoverRing;
        ctx.stroke();
      }
    }
  }, [facilities, scale, rotation, geo, isDark, hoveredPlant, metricMode]);

  // Size the canvas pixel buffer to its container
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      renderGlobe();
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize();
    return () => resizeObserver.disconnect();
  }, [renderGlobe]);

  useEffect(() => {
    if (!autoRotate) return;
    let frame = requestAnimationFrame(function step() {
      if (!isDraggingRef.current) {
        setRotation((prev) => [(prev[0] + 0.12) % 360, prev[1], prev[2]]);
      }
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [autoRotate]);

  // React attaches wheel listeners as passive, so zoom needs a native listener to block page scroll.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((s) => clampScale(s * Math.exp(-e.deltaY * 0.0015)));
    };
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, []);

  const plantAt = (
    e: React.PointerEvent<HTMLCanvasElement>,
    tolerance: number,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const projection = createProjection(
      rect.width,
      rect.height,
      scale,
      rotation,
    );
    return {
      x,
      y,
      plant: findPlantAt(facilities, projection, rotation, x, y, tolerance),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    dragMovedRef.current = false;
    downPosRef.current = { x: e.clientX, y: e.clientY };
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      if (
        Math.hypot(
          e.clientX - downPosRef.current.x,
          e.clientY - downPosRef.current.y,
        ) > 7
      ) {
        dragMovedRef.current = true;
      }
      // Drag sensitivity shrinks as the globe zooms in; pitch is clamped to avoid flipping.
      const sensitivity = (180 / (scale * Math.PI)) * 0.85;
      setRotation((prev) => [
        (prev[0] + dx * sensitivity) % 360,
        Math.max(-85, Math.min(85, prev[1] - dy * sensitivity)),
        prev[2],
      ]);
      return;
    }

    const { x, y, plant } = plantAt(e, 16);
    setHoveredPlant(plant);
    setHoverPos(plant ? { x, y } : null);
    e.currentTarget.style.cursor = plant ? "pointer" : "grab";
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    isDraggingRef.current = false;
    const tapDistance = Math.hypot(
      e.clientX - downPosRef.current.x,
      e.clientY - downPosRef.current.y,
    );
    if (dragMovedRef.current || tapDistance > 8) return;
    // Taps use a touch-friendly 22px hit radius.
    const target = hoveredPlant ?? plantAt(e, 22).plant;
    if (target) onInspectFacility(target.id);
  };

  const zoomBy = (factor: number) => setScale((s) => clampScale(s * factor));

  const goTo = ({ yaw, pitch, scale }: typeof HOME_VIEW) => {
    setRotation([yaw, pitch, 0]);
    setScale(scale);
  };

  const container = containerRef.current;

  return (
    <div
      ref={containerRef}
      className={cn(
        MAP_FRAME,
        "bg-canvas flex flex-col transition-colors select-none",
      )}
    >
      {isLoadingGeo && (
        <div className="bg-canvas/80 absolute inset-0 z-20 flex items-center justify-center backdrop-blur-xs">
          <MapSpinner label="Loading the globe…" />
        </div>
      )}

      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="h-full w-full touch-none"
      />

      <div className="pointer-events-none absolute top-3 right-3 left-3 flex items-center justify-between gap-2">
        <div className={HUD_PANEL}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoRotate(!autoRotate)}
            className={cn(HUD_BUTTON, autoRotate && "bg-surface-2 text-fg")}
          >
            {autoRotate ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            <span className="hidden sm:inline">
              {autoRotate ? "Stop" : "Rotate"}
            </span>
          </Button>
          <div className="bg-edge h-3.5 w-px" />
          {PRESETS.map((preset, i) => (
            <Button
              key={preset.label}
              variant="ghost"
              size="sm"
              onClick={() => goTo(preset)}
              className={cn(HUD_BUTTON, i > 0 && "hidden md:inline-flex")}
            >
              {i === 0 && <Compass className="h-3 w-3" />}
              {preset.label}
            </Button>
          ))}
        </div>

        <div className={HUD_PANEL}>
          {[
            {
              title: "Zoom in",
              icon: <Maximize2 className="h-3.5 w-3.5" />,
              onClick: () => zoomBy(1.35),
            },
            {
              title: "Zoom out",
              icon: <Minimize2 className="h-3.5 w-3.5" />,
              onClick: () => zoomBy(0.72),
            },
            {
              title: "Reset position",
              icon: <RotateCcw className="h-3 w-3" />,
              onClick: () => goTo(HOME_VIEW),
            },
          ].map(({ title, icon, onClick }) => (
            <Button
              key={title}
              variant="ghost"
              size="icon"
              onClick={onClick}
              title={title}
              className="hover:bg-surface-2/60 h-7 w-7"
            >
              {icon}
            </Button>
          ))}
        </div>
      </div>

      <div className="text-fg-muted pointer-events-none absolute bottom-3 left-4 text-xs">
        Drag to rotate, scroll to zoom; click a dot for details.
      </div>

      {hoveredPlant && hoverPos && container && (
        <MapHoverCard
          plant={hoveredPlant}
          {...hoverPos}
          frame={{
            width: container.clientWidth,
            height: container.clientHeight,
          }}
        />
      )}
    </div>
  );
}
