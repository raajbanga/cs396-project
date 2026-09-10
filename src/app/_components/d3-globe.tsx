"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import {
  Compass,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  RotateCcw,
  MapPin,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { FuelBadge } from "~/components/ui/fuel-badge";
import { useTheme } from "next-themes";
import {
  getFuelTheme,
  getMarkerRadius,
  type MapFacility,
  type MetricMode,
} from "~/lib/map-utils";
import { formatCountyShort } from "~/lib/plant-narrative";
import type { GeometryCollection, Topology } from "topojson-specification";

interface D3GlobeProps {
  facilities: MapFacility[];
  onInspectFacility: (id: number) => void;
  metricMode: MetricMode;
}

function createProjection(
  width: number,
  height: number,
  scale: number,
  rotation: [number, number, number],
) {
  return d3
    .geoOrthographic()
    .scale(scale)
    .translate([width / 2, height / 2])
    .rotate(rotation)
    .clipAngle(90);
}

function findPlantAt(
  facilities: MapFacility[],
  projection: ReturnType<typeof createProjection>,
  rotation: [number, number, number],
  x: number,
  y: number,
  tolerance: number,
) {
  const center: [number, number] = [-rotation[0], -rotation[1]];
  let closest: MapFacility | null = null;
  let minDistance = tolerance;
  for (const plant of facilities) {
    if (d3.geoDistance([plant.longitude, plant.latitude], center) > Math.PI / 2)
      continue;
    const point = projection([plant.longitude, plant.latitude]);
    if (!point) continue;
    const distance = Math.hypot(point[0] - x, point[1] - y);
    if (distance < minDistance) {
      minDistance = distance;
      closest = plant;
    }
  }
  return closest;
}

export function D3Globe({
  facilities,
  onInspectFacility,
  metricMode,
}: D3GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Next-themes hook for light/dark mode
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted
    ? resolvedTheme === "dark"
    : typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : true;

  // Geographic topology data
  const [worldLand, setWorldLand] = useState<d3.GeoPermissibleObjects | null>(
    null,
  );
  const [usStates, setUsStates] = useState<d3.GeoPermissibleObjects | null>(
    null,
  );
  const [usNation, setUsNation] = useState<d3.GeoPermissibleObjects | null>(
    null,
  );
  const [isLoadingGeo, setIsLoadingGeo] = useState(true);

  // Globe camera view state: [yaw (lon), pitch (lat), roll]
  // Default centered over North America / USA
  const [rotation, setRotation] = useState<[number, number, number]>([
    98, -38, 0,
  ]);
  const [scale, setScale] = useState<number>(380);
  const [autoRotate, setAutoRotate] = useState(false);

  // Interactive hover state
  const [hoveredPlant, setHoveredPlant] = useState<MapFacility | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(
    null,
  );

  // Interaction tracking refs
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const downPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragMovedRef = useRef(false);
  const animFrameRef = useRef<number | null>(null);

  // Load vector topology from bundled files
  useEffect(() => {
    let isMounted = true;

    async function loadGeoData() {
      try {
        const [landRes, statesRes] = await Promise.all([
          fetch("/geo/world-land-110m.json"),
          fetch("/geo/us-states-10m.json"),
        ]);

        if (!landRes.ok || !statesRes.ok) {
          throw new Error("Failed to load local geo JSON files");
        }

        const landTopo = (await landRes.json()) as Topology<{
          land: GeometryCollection;
        }>;
        const statesTopo = (await statesRes.json()) as Topology<{
          states: GeometryCollection;
          nation: GeometryCollection;
        }>;

        if (isMounted) {
          // Convert TopoJSON to GeoJSON features
          const landFeature = topojson.feature(
            landTopo,
            landTopo.objects.land,
          ) as unknown as d3.GeoPermissibleObjects;
          const statesFeature = topojson.feature(
            statesTopo,
            statesTopo.objects.states,
          ) as unknown as d3.GeoPermissibleObjects;
          const nationFeature = topojson.feature(
            statesTopo,
            statesTopo.objects.nation,
          ) as unknown as d3.GeoPermissibleObjects;

          setWorldLand(landFeature);
          setUsStates(statesFeature);
          setUsNation(nationFeature);
          setIsLoadingGeo(false);
        }
      } catch (err) {
        console.error("Error loading geo topology:", err);
        if (isMounted) setIsLoadingGeo(false);
      }
    }

    void loadGeoData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Main canvas render function
  const renderGlobe = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = width / dpr;
    const displayHeight = height / dpr;

    // Reset transform and clear
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    const cx = displayWidth / 2;
    const cy = displayHeight / 2;

    // Create D3 Orthographic Projection
    const projection = createProjection(
      displayWidth,
      displayHeight,
      scale,
      rotation,
    ).precision(0.3);

    const path = d3.geoPath(projection, ctx);

    // 1. Atmosphere Rim Glow (Outer circular ring)
    const globeRadius = scale;
    const rimGrad = ctx.createRadialGradient(
      cx,
      cy,
      globeRadius * 0.85,
      cx,
      cy,
      globeRadius * 1.06,
    );
    if (isDark) {
      rimGrad.addColorStop(0, "rgba(16, 185, 129, 0.0)");
      rimGrad.addColorStop(0.7, "rgba(16, 185, 129, 0.04)");
      rimGrad.addColorStop(0.95, "rgba(52, 211, 153, 0.12)");
      rimGrad.addColorStop(1, "rgba(16, 185, 129, 0.0)");
    } else {
      rimGrad.addColorStop(0, "rgba(16, 185, 129, 0.0)");
      rimGrad.addColorStop(0.7, "rgba(16, 185, 129, 0.03)");
      rimGrad.addColorStop(0.95, "rgba(16, 185, 129, 0.10)");
      rimGrad.addColorStop(1, "rgba(16, 185, 129, 0.0)");
    }

    ctx.beginPath();
    ctx.arc(cx, cy, globeRadius * 1.06, 0, Math.PI * 2);
    ctx.fillStyle = rimGrad;
    ctx.fill();

    // 2. Globe Sphere (Wireframe Base)
    ctx.beginPath();
    path({ type: "Sphere" });
    const sphereGrad = ctx.createRadialGradient(
      cx - globeRadius * 0.25,
      cy - globeRadius * 0.25,
      globeRadius * 0.1,
      cx,
      cy,
      globeRadius,
    );
    if (isDark) {
      sphereGrad.addColorStop(0, "#18181b"); // zinc-900
      sphereGrad.addColorStop(0.8, "#09090b"); // zinc-950
      sphereGrad.addColorStop(1, "#040405");
    } else {
      sphereGrad.addColorStop(0, "#ffffff"); // clean white
      sphereGrad.addColorStop(0.8, "#f4f4f5"); // zinc-100 wireframe base
      sphereGrad.addColorStop(1, "#e4e4e7"); // zinc-200 subtle limb depth
    }
    ctx.fillStyle = sphereGrad;
    ctx.fill();

    // Sphere border wireframe ring
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = isDark
      ? "rgba(255, 255, 255, 0.15)"
      : "rgba(24, 24, 27, 0.2)";
    ctx.stroke();

    // 3. Wireframe Graticules (Latitude & Longitude Grid Lines)
    const graticule = d3.geoGraticule10();
    ctx.beginPath();
    path(graticule);
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = isDark
      ? "rgba(255, 255, 255, 0.08)"
      : "rgba(24, 24, 27, 0.08)";
    ctx.stroke();

    // Highlight Equator & Prime Meridian
    ctx.beginPath();
    path({
      type: "LineString",
      coordinates: [
        [-180, 0],
        [180, 0],
      ],
    });
    ctx.lineWidth = 0.75;
    ctx.strokeStyle = isDark
      ? "rgba(52, 211, 153, 0.2)"
      : "rgba(16, 185, 129, 0.25)";
    ctx.stroke();

    // 4. World Landmass Wireframe Outlines
    if (worldLand) {
      ctx.beginPath();
      path(worldLand);
      ctx.fillStyle = isDark
        ? "rgba(24, 24, 27, 0.75)"
        : "rgba(228, 228, 231, 0.75)";
      ctx.fill();
      ctx.lineWidth = 0.75;
      ctx.strokeStyle = isDark
        ? "rgba(161, 161, 170, 0.3)"
        : "rgba(113, 113, 122, 0.4)";
      ctx.stroke();
    }

    // 5. US State Boundaries (internal borders)
    if (usStates) {
      ctx.beginPath();
      path(usStates);
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = isDark
        ? "rgba(52, 211, 153, 0.35)"
        : "rgba(16, 185, 129, 0.45)"; // emerald state borders
      ctx.stroke();
    }

    // 5b. Thicker US National Outline Border (for all versions)
    if (usNation) {
      ctx.beginPath();
      path(usNation);
      ctx.lineWidth = 2.4; // Prominent national boundary outline
      ctx.strokeStyle = isDark
        ? "rgba(52, 211, 153, 0.95)"
        : "rgba(5, 150, 105, 0.95)";
      ctx.stroke();
    }

    // 6. EPA Facilities (Plotted Points with Back-Face Culling)
    const centerLon = -rotation[0];
    const centerLat = -rotation[1];

    for (const plant of facilities) {
      // Back-face culling: Angular distance <= 90 deg (Math.PI / 2 rad)
      const angularDist = d3.geoDistance(
        [plant.longitude, plant.latitude],
        [centerLon, centerLat],
      );

      if (angularDist > Math.PI / 2) {
        continue; // Culled: Behind the globe
      }

      const coords = projection([plant.longitude, plant.latitude]);
      if (!coords) continue;

      const [px, py] = coords;
      const fuelTheme = getFuelTheme(plant.primaryFuel);

      const zoomBonus = Math.min(3.5, Math.max(0, (scale - 400) / 1200));
      const r = getMarkerRadius(plant, metricMode, {
        min: 2.5,
        max: 10,
        capacityScale: 0.12,
        co2Scale: 0.003,
        uniformBase: 3,
        zoomBonus,
      });

      const isHovered = hoveredPlant?.id === plant.id;
      // Glow halo
      ctx.beginPath();
      ctx.arc(px, py, r + (isHovered ? 3 : 1), 0, Math.PI * 2);
      ctx.fillStyle = isHovered
        ? isDark
          ? "rgba(255, 255, 255, 0.5)"
          : "rgba(15, 23, 42, 0.25)"
        : fuelTheme.glow;
      ctx.fill();

      // Core point
      ctx.beginPath();
      ctx.arc(px, py, isHovered ? r + 1.5 : r, 0, Math.PI * 2);
      ctx.fillStyle = fuelTheme.color;
      ctx.fill();
      ctx.lineWidth = isDark ? 0.75 : 1;
      ctx.strokeStyle = isDark ? "#09090b" : "#ffffff";
      ctx.stroke();

      // Pulsing highlight ring on hover or selection
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(px, py, r + 5, 0, Math.PI * 2);
        ctx.lineWidth = 1.75;
        ctx.strokeStyle = isDark ? "#ffffff" : "#0f172a";
        ctx.stroke();
      }
    }
  }, [
    facilities,
    scale,
    rotation,
    worldLand,
    usStates,
    usNation,
    isDark,
    hoveredPlant,
    metricMode,
  ]);

  // Adjust canvas pixel buffer to container size
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

    return () => {
      resizeObserver.disconnect();
    };
  }, [renderGlobe]);

  // Auto-rotation animation loop
  useEffect(() => {
    if (!autoRotate) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const step = () => {
      if (!isDraggingRef.current) {
        setRotation((prev) => [(prev[0] + 0.12) % 360, prev[1], prev[2]]);
      }
      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [autoRotate]);

  // Mouse drag & Pointer interactions
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    dragMovedRef.current = false;
    downPosRef.current = { x: e.clientX, y: e.clientY };
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (isDraggingRef.current) {
      const dx = clientX - lastPointerRef.current.x;
      const dy = clientY - lastPointerRef.current.y;
      const totalDist = Math.hypot(
        clientX - downPosRef.current.x,
        clientY - downPosRef.current.y,
      );

      if (totalDist > 7) {
        dragMovedRef.current = true;
      }

      lastPointerRef.current = { x: clientX, y: clientY };

      // Sensitivity inversely proportional to scale
      const sensitivity = (180 / (scale * Math.PI)) * 0.85;

      setRotation((prev) => {
        const newYaw = (prev[0] + dx * sensitivity) % 360;
        // Clamp pitch to avoid flipping
        const newPitch = Math.max(
          -85,
          Math.min(85, prev[1] - dy * sensitivity),
        );
        return [newYaw, newPitch, prev[2]];
      });
    } else {
      // Hover hit detection against front-facing facilities
      const projection = createProjection(
        rect.width,
        rect.height,
        scale,
        rotation,
      );
      const closest = findPlantAt(facilities, projection, rotation, x, y, 16);

      setHoveredPlant(closest);
      if (closest) {
        setHoverPos({ x, y });
        canvas.style.cursor = "pointer";
      } else {
        setHoverPos(null);
        canvas.style.cursor = "grab";
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }

    isDraggingRef.current = false;

    // Check if this was a tap/click without drag motion
    const totalDist = Math.hypot(
      e.clientX - downPosRef.current.x,
      e.clientY - downPosRef.current.y,
    );

    if (!dragMovedRef.current && totalDist <= 8) {
      // Direct hit-test at tap point with touch-friendly 22px tolerance
      let targetPlant = hoveredPlant;

      if (!targetPlant && canvas) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        targetPlant = findPlantAt(
          facilities,
          createProjection(rect.width, rect.height, scale, rotation),
          rotation,
          x,
          y,
          22,
        );
      }

      if (targetPlant) {
        onInspectFacility(targetPlant.id);
      }
    }
  };

  // Scroll wheel zoom with exponential scaling up to 10,000
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setScale((prev) => {
      const factor = Math.exp(-e.deltaY * 0.0015);
      const next = prev * factor;
      return Math.max(160, Math.min(10000, next));
    });
  };

  // Preset camera views
  const setPreset = (yaw: number, pitch: number, zoomScale: number) => {
    setRotation([yaw, pitch, 0]);
    setScale(zoomScale);
  };

  return (
    <div
      ref={containerRef}
      className="border-edge/80 bg-canvas relative flex h-[420px] w-full flex-col overflow-hidden rounded-xl border shadow-xs transition-colors select-none sm:h-[520px] lg:h-[620px]"
    >
      {/* Loading Overlay */}
      {isLoadingGeo && (
        <div className="bg-canvas/80 absolute inset-0 z-20 flex items-center justify-center backdrop-blur-xs">
          <div className="text-fg-muted flex items-center gap-2 text-xs">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <span>Rendering Wireframe Projections...</span>
          </div>
        </div>
      )}

      {/* Main Interactive Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        className="h-full w-full touch-none"
      />

      {/* Top Floating HUD: Controls & Camera Presets */}
      <div className="pointer-events-none absolute top-3 right-3 left-3 flex items-center justify-between gap-2">
        <div className="border-edge/80 bg-surface/90 pointer-events-auto flex items-center gap-1 rounded-lg border p-1 shadow-xs backdrop-blur-md">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoRotate(!autoRotate)}
            className={`h-7 gap-1.5 px-2 text-xs ${
              autoRotate
                ? "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-300"
                : "text-fg-muted hover:text-fg hover:bg-surface-2/60"
            }`}
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

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreset(98, -38, 380)}
            className="text-fg-2 hover:text-fg hover:bg-surface-2/60 h-7 px-2 text-xs"
          >
            <Compass className="mr-1 h-3 w-3 text-emerald-500 dark:text-emerald-400" />
            <span>US</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreset(78, -38, 560)}
            className="text-fg-2 hover:text-fg hover:bg-surface-2/60 hidden h-7 px-2 text-xs md:inline-flex"
          >
            <span>East</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreset(99, -31, 720)}
            className="text-fg-2 hover:text-fg hover:bg-surface-2/60 hidden h-7 px-2 text-xs md:inline-flex"
          >
            <span>Texas</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreset(118, -38, 560)}
            className="text-fg-2 hover:text-fg hover:bg-surface-2/60 hidden h-7 px-2 text-xs md:inline-flex"
          >
            <span>West</span>
          </Button>
        </div>

        {/* Zoom & Reset Controls */}
        <div className="border-edge/80 bg-surface/90 pointer-events-auto flex items-center gap-1 rounded-lg border p-1 shadow-xs backdrop-blur-md">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScale((s) => Math.min(10000, s * 1.35))}
            className="text-fg-muted hover:text-fg hover:bg-surface-2/60 h-7 w-7 p-0"
            title="Zoom in"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScale((s) => Math.max(160, s * 0.72))}
            className="text-fg-muted hover:text-fg hover:bg-surface-2/60 h-7 w-7 p-0"
            title="Zoom out"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreset(98, -38, 380)}
            className="text-fg-muted hover:text-fg hover:bg-surface-2/60 h-7 w-7 p-0"
            title="Reset position"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Bottom Floating Legend / Instructions */}
      <div className="text-fg-muted pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 text-xs">
        <div className="border-edge/80 bg-surface/90 rounded-md border px-2.5 py-1 backdrop-blur-md">
          <span>
            Click & drag to rotate globe • Scroll to zoom • Click dot for plant
            profile
          </span>
        </div>
      </div>

      {/* Floating Hover HUD Card */}
      {hoveredPlant && hoverPos && (
        <div
          style={{
            left: Math.max(
              8,
              Math.min(
                hoverPos.x + 16,
                (containerRef.current?.clientWidth ?? 800) - 270,
              ),
            ),
            top: Math.max(
              8,
              Math.min(
                hoverPos.y - 40,
                (containerRef.current?.clientHeight ?? 600) - 200,
              ),
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
                {hoveredPlant.county
                  ? `${formatCountyShort(hoveredPlant.county)}, `
                  : ""}
                {hoveredPlant.stateCode} • ORISPL #{hoveredPlant.id}
              </p>
            </div>
            <FuelBadge fuel={hoveredPlant.primaryFuel} />
          </div>

          <div className="border-edge mt-2.5 grid grid-cols-2 gap-1.5 border-t pt-2 text-xs">
            <div>
              <span className="text-fg-muted">Capacity:</span>
              <p className="text-fg font-mono font-medium">
                {hoveredPlant.totalCapacityMW.toLocaleString()} MW
              </p>
            </div>
            <div>
              <span className="text-fg-muted">Annual CO₂:</span>
              <p className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                {Math.round(hoveredPlant.totalCo2Tons).toLocaleString()} tons
              </p>
            </div>
            <div>
              <span className="text-fg-muted">NERC Grid:</span>
              <p className="text-fg">
                {hoveredPlant.nercRegion ?? "Unassigned"}
              </p>
            </div>
            <div>
              <span className="text-fg-muted">Generators:</span>
              <p className="text-fg">{hoveredPlant.unitCount} units</p>
            </div>
          </div>

          <div className="border-edge/80 text-fg-muted mt-2.5 flex items-center justify-between border-t pt-2 text-xs">
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
