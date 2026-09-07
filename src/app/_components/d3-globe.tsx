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
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  getFuelTheme,
  type MapFacility,
  type MetricMode,
} from "~/lib/map-utils";
import type { GeometryCollection, Topology } from "topojson-specification";

interface D3GlobeProps {
  facilities: MapFacility[];
  selectedFacilityId?: number | null;
  onInspectFacility: (id: number) => void;
  metricMode: MetricMode;
}

export function D3Globe({
  facilities,
  selectedFacilityId,
  onInspectFacility,
  metricMode,
}: D3GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Geographic topology data
  const [worldLand, setWorldLand] = useState<d3.GeoPermissibleObjects | null>(
    null,
  );
  const [usStates, setUsStates] = useState<d3.GeoPermissibleObjects | null>(
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

          setWorldLand(landFeature);
          setUsStates(statesFeature);
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
    const projection = d3
      .geoOrthographic()
      .scale(scale)
      .translate([cx, cy])
      .rotate(rotation)
      .clipAngle(90) // Cull back-face geometries
      .precision(0.3);

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
    rimGrad.addColorStop(0, "rgba(16, 185, 129, 0.0)");
    rimGrad.addColorStop(0.7, "rgba(16, 185, 129, 0.04)");
    rimGrad.addColorStop(0.95, "rgba(52, 211, 153, 0.12)");
    rimGrad.addColorStop(1, "rgba(16, 185, 129, 0.0)");

    ctx.beginPath();
    ctx.arc(cx, cy, globeRadius * 1.06, 0, Math.PI * 2);
    ctx.fillStyle = rimGrad;
    ctx.fill();

    // 2. Globe Sphere (Dark Slate Base)
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
    sphereGrad.addColorStop(0, "#18181b"); // zinc-900
    sphereGrad.addColorStop(0.8, "#09090b"); // zinc-950
    sphereGrad.addColorStop(1, "#040405");
    ctx.fillStyle = sphereGrad;
    ctx.fill();

    // Sphere border wireframe ring
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.stroke();

    // 3. Wireframe Graticules (Latitude & Longitude Grid Lines)
    const graticule = d3.geoGraticule10();
    ctx.beginPath();
    path(graticule);
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
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
    ctx.strokeStyle = "rgba(52, 211, 153, 0.2)";
    ctx.stroke();

    // 4. World Landmass Wireframe Outlines
    if (worldLand) {
      ctx.beginPath();
      path(worldLand);
      ctx.fillStyle = "rgba(24, 24, 27, 0.75)";
      ctx.fill();
      ctx.lineWidth = 0.75;
      ctx.strokeStyle = "rgba(161, 161, 170, 0.3)"; // zinc-400 subtle wireframe
      ctx.stroke();
    }

    // 5. US State Boundaries
    if (usStates) {
      ctx.beginPath();
      path(usStates);
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = "rgba(52, 211, 153, 0.35)"; // subtle emerald state borders
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

      // Determine dot radius based on metric mode
      let r = 3;
      if (metricMode === "capacity") {
        r = Math.max(2, Math.min(9, Math.sqrt(plant.totalCapacityMW) * 0.12));
      } else if (metricMode === "co2") {
        r = Math.max(2, Math.min(9, Math.sqrt(plant.totalCo2Tons) * 0.003));
      }

      const isHovered = hoveredPlant?.id === plant.id;
      const isSelected = selectedFacilityId === plant.id;

      // Glow halo
      ctx.beginPath();
      ctx.arc(px, py, r + (isHovered || isSelected ? 3 : 1), 0, Math.PI * 2);
      ctx.fillStyle = isHovered ? "rgba(255, 255, 255, 0.5)" : fuelTheme.glow;
      ctx.fill();

      // Core point
      ctx.beginPath();
      ctx.arc(px, py, isHovered ? r + 1.5 : r, 0, Math.PI * 2);
      ctx.fillStyle = fuelTheme.color;
      ctx.fill();
      ctx.lineWidth = 0.75;
      ctx.strokeStyle = "#09090b";
      ctx.stroke();

      // Pulsing highlight ring on hover or selection
      if (isHovered || isSelected) {
        ctx.beginPath();
        ctx.arc(px, py, r + 5, 0, Math.PI * 2);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isHovered ? "#ffffff" : "#34d399";
        ctx.stroke();
      }
    }
  }, [
    facilities,
    scale,
    rotation,
    worldLand,
    usStates,
    hoveredPlant,
    selectedFacilityId,
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

  // Redraw whenever state changes
  useEffect(() => {
    renderGlobe();
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

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
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
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const projection = d3
        .geoOrthographic()
        .scale(scale)
        .translate([cx, cy])
        .rotate(rotation)
        .clipAngle(90);

      const centerLon = -rotation[0];
      const centerLat = -rotation[1];

      let closest: MapFacility | null = null;
      let minDistance = 14; // pixels hit radius

      for (const p of facilities) {
        if (
          d3.geoDistance([p.longitude, p.latitude], [centerLon, centerLat]) >
          Math.PI / 2
        ) {
          continue; // cull
        }

        const projected = projection([p.longitude, p.latitude]);
        if (!projected) continue;

        const dist = Math.hypot(projected[0] - x, projected[1] - y);
        if (dist < minDistance) {
          minDistance = dist;
          closest = p;
        }
      }

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

    // If it was a click without significant drag motion
    if (!dragMovedRef.current && hoveredPlant) {
      onInspectFacility(hoveredPlant.id);
    }
  };

  // Scroll wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setScale((prev) => {
      const delta = -e.deltaY * 0.45;
      return Math.max(160, Math.min(1800, prev + delta));
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
      className="relative flex h-[620px] w-full flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 select-none shadow-2xl"
    >
      {/* Loading Overlay */}
      {isLoadingGeo && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-950/80 backdrop-blur-xs">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
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
      <div className="pointer-events-none absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-zinc-800/80 bg-zinc-900/90 p-1 backdrop-blur-md shadow-lg">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoRotate(!autoRotate)}
            className={`h-7 px-2 text-xs gap-1.5 ${
              autoRotate
                ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            {autoRotate ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            <span>{autoRotate ? "Spinning" : "Auto-Rotate"}</span>
          </Button>

          <div className="h-3.5 w-px bg-zinc-800" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreset(98, -38, 380)}
            className="h-7 px-2 text-xs text-zinc-300 hover:text-white"
          >
            <Compass className="h-3 w-3 mr-1 text-emerald-400" />
            <span>US Center</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreset(78, -38, 560)}
            className="h-7 px-2 text-xs text-zinc-300 hover:text-white"
          >
            <span>East (PJM/SERC)</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreset(99, -31, 720)}
            className="h-7 px-2 text-xs text-zinc-300 hover:text-white"
          >
            <span>Texas (ERCOT)</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreset(118, -38, 560)}
            className="h-7 px-2 text-xs text-zinc-300 hover:text-white"
          >
            <span>West (WECC)</span>
          </Button>
        </div>

        {/* Zoom & Reset Controls */}
        <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-zinc-800/80 bg-zinc-900/90 p-1 backdrop-blur-md shadow-lg">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScale((s) => Math.min(1800, s * 1.25))}
            className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
            title="Zoom in"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScale((s) => Math.max(160, s * 0.8))}
            className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
            title="Zoom out"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreset(98, -38, 380)}
            className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
            title="Reset position"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Bottom Floating Legend / Instructions */}
      <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 text-[11px] text-zinc-500">
        <div className="rounded-md border border-zinc-800/80 bg-zinc-900/80 px-2.5 py-1 backdrop-blur-md">
          <span>Click & drag to rotate globe • Scroll to zoom • Click dot for plant profile</span>
        </div>
      </div>

      {/* Floating Hover HUD Card */}
      {hoveredPlant && hoverPos && (
        <div
          style={{
            left: Math.min(
              hoverPos.x + 16,
              (containerRef.current?.clientWidth ?? 800) - 270,
            ),
            top: Math.max(16, hoverPos.y - 40),
          }}
          className="pointer-events-none absolute z-30 w-64 rounded-lg border border-zinc-700 bg-zinc-900/95 p-3 shadow-2xl backdrop-blur-md transition-all duration-75 animate-in fade-in zoom-in-95"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold tracking-tight text-white">
                {hoveredPlant.name}
              </h4>
              <p className="text-[11px] text-zinc-400">
                {hoveredPlant.county ? `${hoveredPlant.county} Co., ` : ""}
                {hoveredPlant.stateCode} • ORISPL #{hoveredPlant.id}
              </p>
            </div>
            <Badge
              variant="outline"
              className={`py-0 text-[10px] ${getFuelTheme(hoveredPlant.primaryFuel).badgeClass}`}
            >
              {hoveredPlant.primaryFuel}
            </Badge>
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-1.5 border-t border-zinc-800 pt-2 text-[11px]">
            <div>
              <span className="text-zinc-500">Capacity:</span>
              <p className="font-mono font-medium text-zinc-200">
                {hoveredPlant.totalCapacityMW.toLocaleString()} MW
              </p>
            </div>
            <div>
              <span className="text-zinc-500">Annual CO₂:</span>
              <p className="font-mono font-medium text-emerald-400">
                {Math.round(hoveredPlant.totalCo2Tons).toLocaleString()} tons
              </p>
            </div>
            <div>
              <span className="text-zinc-500">NERC Grid:</span>
              <p className="text-zinc-200">
                {hoveredPlant.nercRegion ?? "Unassigned"}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">Generators:</span>
              <p className="text-zinc-200">{hoveredPlant.unitCount} units</p>
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between border-t border-zinc-800/80 pt-2 text-[10px] text-zinc-400">
            <span className="text-emerald-400 font-medium">Click dot to open profile</span>
            <MapPin className="h-3 w-3 text-zinc-500" />
          </div>
        </div>
      )}
    </div>
  );
}
