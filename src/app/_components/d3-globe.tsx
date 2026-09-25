"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import {
  Compass,
  MapPin,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import { useTheme } from "next-themes";
import * as topojson from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { FuelBadge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  getFuelTheme,
  getMarkerRadius,
  MAP_FRAME,
  type MapFacility,
  type MetricMode,
} from "~/lib/map-utils";
import { formatCountyShort } from "~/lib/plant-narrative";
import { cn } from "~/lib/utils";

type Rotation = [number, number, number];
type Projection = ReturnType<typeof createProjection>;

interface GeoLayers {
  land: d3.GeoPermissibleObjects;
  states: d3.GeoPermissibleObjects;
  nation: d3.GeoPermissibleObjects;
}

const MIN_SCALE = 160;
const MAX_SCALE = 10000;
const HOME_VIEW = { yaw: 98, pitch: -38, scale: 380 };
const PRESETS = [
  { label: "US", ...HOME_VIEW },
  { label: "East", yaw: 78, pitch: -38, scale: 560 },
  { label: "Texas", yaw: 99, pitch: -31, scale: 720 },
  { label: "West", yaw: 118, pitch: -38, scale: 560 },
];
const HUD_BUTTON = "text-fg-2 hover:text-fg hover:bg-surface-2/60 h-7 px-2";
const HUD_PANEL =
  "border-edge/80 bg-surface/90 pointer-events-auto flex items-center gap-1 rounded-lg border p-1 shadow-xs backdrop-blur-md";

/** Canvas stroke/fill colors per theme: [dark, light]. */
const PALETTE = {
  rim: [
    [
      "rgba(16, 185, 129, 0.0)",
      "rgba(16, 185, 129, 0.04)",
      "rgba(52, 211, 153, 0.12)",
    ],
    [
      "rgba(16, 185, 129, 0.0)",
      "rgba(16, 185, 129, 0.03)",
      "rgba(16, 185, 129, 0.10)",
    ],
  ],
  sphere: [
    ["#18181b", "#09090b", "#040405"],
    ["#ffffff", "#f4f4f5", "#e4e4e7"],
  ],
  sphereEdge: ["rgba(255, 255, 255, 0.15)", "rgba(24, 24, 27, 0.2)"],
  graticule: ["rgba(255, 255, 255, 0.08)", "rgba(24, 24, 27, 0.08)"],
  equator: ["rgba(52, 211, 153, 0.2)", "rgba(16, 185, 129, 0.25)"],
  landFill: ["rgba(24, 24, 27, 0.75)", "rgba(228, 228, 231, 0.75)"],
  landEdge: ["rgba(161, 161, 170, 0.3)", "rgba(113, 113, 122, 0.4)"],
  states: ["rgba(52, 211, 153, 0.35)", "rgba(16, 185, 129, 0.45)"],
  nation: ["rgba(52, 211, 153, 0.95)", "rgba(5, 150, 105, 0.95)"],
  hoverHalo: ["rgba(255, 255, 255, 0.5)", "rgba(15, 23, 42, 0.25)"],
  dotEdge: ["#09090b", "#ffffff"],
  hoverRing: ["#ffffff", "#0f172a"],
} as const;

export function MapSpinner({ label }: { label: string }) {
  return (
    <div className="text-fg-muted flex items-center gap-2 text-xs">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
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
    const theme = isDark ? 0 : 1;
    const color = (key: Exclude<keyof typeof PALETTE, "rim" | "sphere">) =>
      PALETTE[key][theme];

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
    const [rim0, rim1, rim2] = PALETTE.rim[theme];
    rim.addColorStop(0, rim0);
    rim.addColorStop(0.7, rim1);
    rim.addColorStop(0.95, rim2);
    rim.addColorStop(1, rim0);
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
    PALETTE.sphere[theme].forEach((stop, i) =>
      sphere.addColorStop([0, 0.8, 1][i]!, stop),
    );
    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.fillStyle = sphere;
    ctx.fill();
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = color("sphereEdge");
    ctx.stroke();
    strokePath(d3.geoGraticule10(), 0.5, color("graticule"));
    strokePath(
      {
        type: "LineString",
        coordinates: [
          [-180, 0],
          [180, 0],
        ],
      },
      0.75,
      color("equator"),
    );

    // Land, US states, and the US national outline
    if (geo) {
      strokePath(geo.land, 0.75, color("landEdge"), color("landFill"));
      strokePath(geo.states, 0.6, color("states"));
      strokePath(geo.nation, 2.4, color("nation"));
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
      ctx.fillStyle = isHovered ? color("hoverHalo") : fuelTheme.glow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py, isHovered ? r + 1.5 : r, 0, Math.PI * 2);
      ctx.fillStyle = fuelTheme.color;
      ctx.fill();
      ctx.lineWidth = isDark ? 0.75 : 1;
      ctx.strokeStyle = color("dotEdge");
      ctx.stroke();

      if (isHovered) {
        ctx.beginPath();
        ctx.arc(px, py, r + 5, 0, Math.PI * 2);
        ctx.lineWidth = 1.75;
        ctx.strokeStyle = color("hoverRing");
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

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    zoomBy(Math.exp(-e.deltaY * 0.0015));
  };

  const zoomBy = (factor: number) =>
    setScale((s) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s * factor)));

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
          <MapSpinner label="Rendering Wireframe Projections..." />
        </div>
      )}

      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        className="h-full w-full touch-none"
      />

      <div className="pointer-events-none absolute top-3 right-3 left-3 flex items-center justify-between gap-2">
        <div className={HUD_PANEL}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoRotate(!autoRotate)}
            className={cn(
              HUD_BUTTON,
              autoRotate &&
                "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-300",
            )}
          >
            {autoRotate ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            <span className="hidden sm:inline">
              {autoRotate ? "Spinning" : "Auto-Rotate"}
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
              {i === 0 && (
                <Compass className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
              )}
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

      <div className="border-edge/80 bg-surface/90 text-fg-muted pointer-events-none absolute bottom-4 left-4 rounded-md border px-2.5 py-1 text-xs backdrop-blur-md">
        Click & drag to rotate globe • Scroll to zoom • Click dot for plant
        profile
      </div>

      {hoveredPlant && hoverPos && (
        <div
          style={{
            left: Math.max(
              8,
              Math.min(hoverPos.x + 16, (container?.clientWidth ?? 800) - 270),
            ),
            top: Math.max(
              8,
              Math.min(hoverPos.y - 40, (container?.clientHeight ?? 600) - 200),
            ),
          }}
          className="border-edge bg-surface/95 animate-in fade-in zoom-in-95 pointer-events-none absolute z-30 w-64 rounded-lg border p-3 shadow-2xl backdrop-blur-md transition-all duration-75"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-fg text-sm font-semibold tracking-tight">
                {hoveredPlant.name}
              </h4>
              <p className="text-fg-muted text-xs">
                {hoveredPlant.county &&
                  `${formatCountyShort(hoveredPlant.county)}, `}
                {hoveredPlant.stateCode} • ORISPL #{hoveredPlant.id}
              </p>
            </div>
            <FuelBadge fuel={hoveredPlant.primaryFuel} />
          </div>

          <div className="border-edge mt-2.5 grid grid-cols-2 gap-1.5 border-t pt-2 text-xs">
            {[
              [
                "Capacity",
                `${hoveredPlant.totalCapacityMW.toLocaleString()} MW`,
              ],
              [
                "Annual CO₂",
                `${Math.round(hoveredPlant.totalCo2Tons).toLocaleString()} tons`,
              ],
              ["NERC Grid", hoveredPlant.nercRegion ?? "Unassigned"],
              ["Generators", `${hoveredPlant.unitCount} units`],
            ].map(([label, value]) => (
              <div key={label}>
                <span className="text-fg-muted">{label}:</span>
                <p className="text-fg font-mono font-medium">{value}</p>
              </div>
            ))}
          </div>

          <div className="border-edge/80 mt-2.5 flex items-center justify-between border-t pt-2 text-xs">
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              Click dot to open profile
            </span>
            <MapPin className="text-fg-muted h-3 w-3" />
          </div>
        </div>
      )}
    </div>
  );
}
