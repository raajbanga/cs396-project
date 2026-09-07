"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Globe,
  Map as MapIcon,
  Zap,
  Flame,
  Sparkles,
  Search,
  FilterX,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import {
  FUEL_CATEGORIES,
  getFuelTheme,
  type MapFacility,
  type MetricMode,
} from "~/lib/map-utils";
import { D3Globe } from "./d3-globe";

// Dynamically import Leaflet with SSR disabled to prevent window is not defined errors
const LeafletMap = dynamic(
  () => import("./leaflet-map").then((mod) => mod.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[620px] w-full items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <span>Loading 2D Leaflet Map...</span>
        </div>
      </div>
    ),
  },
);

interface FacilitiesMapProps {
  facilities?: MapFacility[];
  isLoading?: boolean;
  onInspectFacility: (id: number) => void;
  selectedFuel: string;
  onFuelChange: (fuel: string) => void;
  selectedState: string;
  onStateChange: (state: string) => void;
  states?: string[];
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export function FacilitiesMap({
  facilities = [],
  isLoading = false,
  onInspectFacility,
  selectedFuel,
  onFuelChange,
  selectedState,
  onStateChange,
  states = [],
  searchQuery = "",
  onSearchChange,
}: FacilitiesMapProps) {
  const [viewMode, setViewMode] = useState<"globe" | "leaflet">("globe");
  const [metricMode, setMetricMode] = useState<MetricMode>("capacity");

  // Fuel counts for the legend
  const fuelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    facilities.forEach((f) => {
      const theme = getFuelTheme(f.primaryFuel);
      counts[theme.name] = (counts[theme.name] ?? 0) + 1;
    });
    return counts;
  }, [facilities]);

  const totalCapacity = useMemo(
    () => facilities.reduce((sum, f) => sum + f.totalCapacityMW, 0),
    [facilities],
  );

  const totalEmissions = useMemo(
    () => facilities.reduce((sum, f) => sum + f.totalCo2Tons, 0),
    [facilities],
  );

  return (
    <div className="space-y-4">
      {/* Top Map Action Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 sm:flex-row sm:items-center sm:justify-between backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            {viewMode === "globe" ? (
              <Globe className="h-5 w-5 animate-pulse" />
            ) : (
              <MapIcon className="h-5 w-5 text-cyan-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight text-white">
                {viewMode === "globe"
                  ? "3D Orthographic Wireframe Globe"
                  : "2D Cartographic Leaflet Map"}
              </h2>
              <Badge
                variant="outline"
                className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-mono text-[11px]"
              >
                {isLoading ? "Loading..." : `${facilities.length.toLocaleString()} Facilities`}
              </Badge>
            </div>
            <p className="text-xs text-zinc-400">
              {viewMode === "globe"
                ? "D3-Geo spherical projection with wireframe graticules, back-face culling, and drag rotation"
                : "Leaflet Mercator map with dark CartoDB tile layer and interactive facility markers"}
            </p>
          </div>
        </div>

        {/* View Mode Toggle & Metric Size Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher: Globe vs Leaflet */}
          <div className="flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("globe")}
              className={`flex items-center gap-1.5 cursor-pointer rounded-md px-3 py-1.5 font-medium transition-all ${
                viewMode === "globe"
                  ? "bg-zinc-800 text-white shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Globe className="h-3.5 w-3.5 text-emerald-400" />
              <span>3D Globe</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("leaflet")}
              className={`flex items-center gap-1.5 cursor-pointer rounded-md px-3 py-1.5 font-medium transition-all ${
                viewMode === "leaflet"
                  ? "bg-zinc-800 text-white shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <MapIcon className="h-3.5 w-3.5 text-cyan-400" />
              <span>2D Leaflet</span>
            </button>
          </div>

          {/* Dot Size Metric Switcher */}
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-950 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setMetricMode("capacity")}
              className={`flex items-center gap-1 cursor-pointer rounded-md px-2.5 py-1.5 font-medium transition-all ${
                metricMode === "capacity"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Scale dots by Nameplate Capacity (MW)"
            >
              <Zap className="h-3 w-3 text-amber-400" />
              <span>Capacity MW</span>
            </button>
            <button
              type="button"
              onClick={() => setMetricMode("co2")}
              className={`flex items-center gap-1 cursor-pointer rounded-md px-2.5 py-1.5 font-medium transition-all ${
                metricMode === "co2"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Scale dots by Annual CO2 Mass (Tons)"
            >
              <Flame className="h-3 w-3 text-rose-400" />
              <span>CO₂ Tons</span>
            </button>
            <button
              type="button"
              onClick={() => setMetricMode("uniform")}
              className={`cursor-pointer rounded-md px-2.5 py-1.5 font-medium transition-all ${
                metricMode === "uniform"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Uniform dot size"
            >
              <span>Uniform</span>
            </button>
          </div>
        </div>
      </div>

      {/* Fuel Type Chips & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-zinc-500 font-medium mr-1">Filter Fuel:</span>
          <button
            type="button"
            onClick={() => onFuelChange("ALL")}
            className={`cursor-pointer rounded-full border px-2.5 py-0.5 transition-colors ${
              selectedFuel === "ALL"
                ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300 font-medium"
                : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            }`}
          >
            All Fuels ({facilities.length})
          </button>

          {FUEL_CATEGORIES.map((cat) => {
            const isSelected = selectedFuel === cat.query;
            const count = fuelCounts[cat.label] ?? 0;
            return (
              <button
                key={cat.label}
                type="button"
                onClick={() =>
                  onFuelChange(isSelected ? "ALL" : cat.query)
                }
                className={`flex items-center gap-1.5 cursor-pointer rounded-full border px-2.5 py-0.5 transition-colors ${
                  isSelected
                    ? "border-white/40 bg-zinc-800 text-white font-medium"
                    : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                <span>{cat.label}</span>
                <span className="font-mono text-[10px] text-zinc-500">
                  ({count})
                </span>
              </button>
            );
          })}

          {selectedState !== "ALL" && (
            <Badge
              variant="outline"
              className="cursor-pointer gap-1 border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              onClick={() => onStateChange("ALL")}
            >
              <span>State: {selectedState}</span>
              <FilterX className="h-3 w-3 text-zinc-400" />
            </Badge>
          )}
        </div>

        {/* State selector & Search input */}
        <div className="flex items-center gap-2">
          {states.length > 0 && (
            <select
              value={selectedState}
              aria-label="Filter by state"
              onChange={(e) => onStateChange(e.target.value)}
              className="h-7 rounded-md border border-zinc-800 bg-zinc-900 px-2 text-xs text-zinc-300 focus:border-emerald-500 focus:outline-hidden"
            >
              <option value="ALL">All States ({states.length})</option>
              {states.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          )}

          {onSearchChange && (
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search map plants..."
                className="h-7 w-36 rounded-md border border-zinc-800 bg-zinc-900 pl-7 pr-2.5 text-xs text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-hidden"
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Map Visualization Card */}
      {viewMode === "globe" ? (
        <D3Globe
          facilities={facilities}
          onInspectFacility={onInspectFacility}
          metricMode={metricMode}
        />
      ) : (
        <LeafletMap
          facilities={facilities}
          onInspectFacility={onInspectFacility}
          metricMode={metricMode}
        />
      )}

      {/* Bottom Summary Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-zinc-800/80 bg-zinc-900/40 p-3">
          <span className="text-[11px] font-medium text-zinc-500">
            Visible Plant Facilities
          </span>
          <p className="mt-1 font-mono text-lg font-bold text-white">
            {facilities.length.toLocaleString()}
          </p>
        </Card>
        <Card className="border-zinc-800/80 bg-zinc-900/40 p-3">
          <span className="text-[11px] font-medium text-zinc-500">
            Combined Nameplate Capacity
          </span>
          <p className="mt-1 font-mono text-lg font-bold text-emerald-400">
            {Math.round(totalCapacity).toLocaleString()} MW
          </p>
        </Card>
        <Card className="border-zinc-800/80 bg-zinc-900/40 p-3">
          <span className="text-[11px] font-medium text-zinc-500">
            Combined Annual CO₂
          </span>
          <p className="mt-1 font-mono text-lg font-bold text-rose-400">
            {Math.round(totalEmissions).toLocaleString()} tons
          </p>
        </Card>
        <Card className="border-zinc-800/80 bg-zinc-900/40 p-3">
          <span className="text-[11px] font-medium text-zinc-500">
            Visualization Engine
          </span>
          <p className="mt-1 flex items-center gap-1.5 font-medium text-zinc-200 text-sm">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span>
              {viewMode === "globe"
                ? "D3 Orthographic (3D)"
                : "Leaflet Dark (2D)"}
            </span>
          </p>
        </Card>
      </div>
    </div>
  );
}
