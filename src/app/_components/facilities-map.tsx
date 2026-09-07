"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Globe,
  Map as MapIcon,
  Zap,
  Flame,
  Sparkles,
  FilterX,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { StatTile } from "~/components/ui/stat-tile";
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
      <div className="flex h-[620px] w-full items-center justify-center rounded-xl border border-edge/80 bg-surface/30">
        <div className="flex items-center gap-2 text-xs text-fg-muted">
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
}

export function FacilitiesMap({
  facilities = [],
  isLoading = false,
  onInspectFacility,
  selectedFuel,
  onFuelChange,
  selectedState,
  onStateChange,
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
      <div className="flex flex-col gap-2.5 rounded-lg border border-edge/80 bg-surface/60 p-3 sm:p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-edge bg-surface text-fg shadow-xs">
            {viewMode === "globe" ? (
              <Globe className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            ) : (
              <MapIcon className="h-4 w-4 text-sky-500 dark:text-cyan-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-fg sm:text-base">
                {viewMode === "globe" ? "3D Globe" : "2D Map"}
              </h2>
              <Badge
                variant="success"
                className="font-mono text-xs"
              >
                {isLoading ? "..." : `${facilities.length.toLocaleString()} facilities`}
              </Badge>
            </div>
            <p className="text-xs text-fg-muted hidden sm:block">
              {viewMode === "globe"
                ? "Interactive spherical orthographic globe"
                : "Cartographic Mercator map with facility coordinates"}
            </p>
          </div>
        </div>

        {/* View Mode Toggle & Metric Size Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex rounded-md border border-edge/80 bg-surface/60 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("globe")}
              className={`flex items-center gap-1 cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-all ${
                viewMode === "globe"
                  ? "bg-surface-2 text-fg shadow-xs"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              <Globe className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
              <span>3D Globe</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("leaflet")}
              className={`flex items-center gap-1 cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-all ${
                viewMode === "leaflet"
                  ? "bg-surface-2 text-fg shadow-xs"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              <MapIcon className="h-3 w-3 text-sky-500 dark:text-cyan-400" />
              <span>2D Leaflet</span>
            </button>
          </div>

          {/* Metric Switcher */}
          <div className="flex items-center rounded-md border border-edge/80 bg-surface/60 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setMetricMode("capacity")}
              className={`flex items-center gap-1 cursor-pointer rounded px-2 py-1 text-xs font-medium transition-all ${
                metricMode === "capacity"
                  ? "bg-surface-2 text-fg shadow-xs"
                  : "text-fg-muted hover:text-fg"
              }`}
              title="Scale dots by Capacity"
            >
              <Zap className="h-3 w-3 text-amber-500 dark:text-amber-400" />
              <span className="hidden sm:inline">Capacity</span>
              <span className="sm:hidden">MW</span>
            </button>
            <button
              type="button"
              onClick={() => setMetricMode("co2")}
              className={`flex items-center gap-1 cursor-pointer rounded px-2 py-1 text-xs font-medium transition-all ${
                metricMode === "co2"
                  ? "bg-surface-2 text-fg shadow-xs"
                  : "text-fg-muted hover:text-fg"
              }`}
              title="Scale dots by CO2"
            >
              <Flame className="h-3 w-3 text-rose-500 dark:text-rose-400" />
              <span>CO₂</span>
            </button>
            <button
              type="button"
              onClick={() => setMetricMode("uniform")}
              className={`cursor-pointer rounded px-2 py-1 text-xs font-medium transition-all ${
                metricMode === "uniform"
                  ? "bg-surface-2 text-fg shadow-xs"
                  : "text-fg-muted hover:text-fg"
              }`}
              title="Uniform dot size"
            >
              <span>Fixed</span>
            </button>
          </div>
        </div>
      </div>

      {/* Fuel Type Chips & Filter Controls */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => onFuelChange("ALL")}
          className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors shrink-0 ${
            selectedFuel === "ALL"
              ? "border-emerald-300/60 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-edge bg-surface/60 text-fg-muted hover:border-edge/80 hover:text-fg"
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
              className={`flex items-center gap-1.5 cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors shrink-0 ${
                isSelected
                  ? "border-edge bg-surface-2 text-fg shadow-xs"
                  : "border-edge bg-surface/60 text-fg-muted hover:border-edge/80 hover:text-fg"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              <span>{cat.label}</span>
              <span className="font-mono text-xs text-fg-muted">
                ({count})
              </span>
            </button>
          );
        })}

        {selectedState !== "ALL" && (
          <Badge
            variant="outline"
            className="cursor-pointer gap-1 border-edge bg-surface-2 text-fg hover:bg-surface-2/80 shrink-0 text-xs py-0.5"
            onClick={() => onStateChange("ALL")}
          >
            <span>State: {selectedState}</span>
            <FilterX className="h-3 w-3 text-fg-muted" />
          </Badge>
        )}
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
        <StatTile
          variant="card"
          label="Visible Facilities"
          value={facilities.length.toLocaleString()}
          className="border-edge/80 bg-surface/30 p-3.5"
        />
        <StatTile
          variant="card"
          label="Tracked Capacity"
          value={`${Math.round(totalCapacity).toLocaleString()} MW`}
          valueClassName="text-emerald-600 dark:text-emerald-400"
          className="border-edge/80 bg-surface/30 p-3.5"
        />
        <StatTile
          variant="card"
          label="Tracked Annual CO₂"
          value={`${Math.round(totalEmissions).toLocaleString()} tons`}
          valueClassName="text-rose-600 dark:text-rose-400"
          className="border-edge/80 bg-surface/30 p-3.5"
        />
        <StatTile
          variant="card"
          label="Projection Engine"
          value={
            <span className="flex items-center gap-1.5 text-sm font-semibold text-fg">
              <Sparkles className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              {viewMode === "globe" ? "D3 Orthographic (3D)" : "Leaflet Mercator (2D)"}
            </span>
          }
          className="border-edge/80 bg-surface/30 p-3.5"
        />
      </div>
    </div>
  );
}
