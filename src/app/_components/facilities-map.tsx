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
import { SegmentedControl } from "~/components/ui/segmented-control";
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
      <div className="border-edge/80 bg-surface/30 flex h-[620px] w-full items-center justify-center rounded-xl border">
        <div className="text-fg-muted flex items-center gap-2 text-xs">
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

  const summary = useMemo(
    () =>
      facilities.reduce<{
        fuelCounts: Record<string, number>;
        totalCapacity: number;
        totalEmissions: number;
      }>(
        (result, f) => {
          const theme = getFuelTheme(f.primaryFuel);
          result.fuelCounts[theme.name] =
            (result.fuelCounts[theme.name] ?? 0) + 1;
          result.totalCapacity += f.totalCapacityMW;
          result.totalEmissions += f.totalCo2Tons;
          return result;
        },
        {
          fuelCounts: {},
          totalCapacity: 0,
          totalEmissions: 0,
        },
      ),
    [facilities],
  );

  return (
    <div className="space-y-4">
      {/* Top Map Action Bar */}
      <div className="border-edge/80 bg-surface/60 flex flex-col gap-2.5 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex items-center gap-2.5">
          <div className="border-edge bg-surface text-fg flex h-8 w-8 shrink-0 items-center justify-center rounded-md border shadow-xs">
            {viewMode === "globe" ? (
              <Globe className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            ) : (
              <MapIcon className="h-4 w-4 text-sky-500 dark:text-cyan-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-fg text-sm font-semibold tracking-tight sm:text-base">
                {viewMode === "globe" ? "3D Globe" : "2D Map"}
              </h2>
              <Badge variant="success" className="font-mono text-xs">
                {isLoading
                  ? "..."
                  : `${facilities.length.toLocaleString()} facilities`}
              </Badge>
            </div>
            <p className="text-fg-muted hidden text-xs sm:block">
              {viewMode === "globe"
                ? "Interactive spherical orthographic globe"
                : "Cartographic Mercator map with facility coordinates"}
            </p>
          </div>
        </div>

        {/* View Mode Toggle & Metric Size Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            value={viewMode}
            onChange={setViewMode}
            options={[
              {
                value: "globe",
                label: "3D Globe",
                icon: <Globe className="h-3 w-3 text-emerald-500" />,
              },
              {
                value: "leaflet",
                label: "2D Leaflet",
                icon: <MapIcon className="h-3 w-3 text-sky-500" />,
              },
            ]}
          />
          <SegmentedControl
            value={metricMode}
            onChange={setMetricMode}
            options={[
              {
                value: "capacity",
                label: (
                  <>
                    <span className="hidden sm:inline">Capacity</span>
                    <span className="sm:hidden">MW</span>
                  </>
                ),
                icon: <Zap className="h-3 w-3 text-amber-500" />,
                title: "Scale dots by capacity",
              },
              {
                value: "co2",
                label: "CO₂",
                icon: <Flame className="h-3 w-3 text-rose-500" />,
                title: "Scale dots by CO₂",
              },
              { value: "uniform", label: "Fixed", title: "Uniform dot size" },
            ]}
          />
        </div>
      </div>

      {/* Fuel Type Chips & Filter Controls */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => onFuelChange("ALL")}
          className={`shrink-0 cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
            selectedFuel === "ALL"
              ? "border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "border-edge bg-surface/60 text-fg-muted hover:border-edge/80 hover:text-fg"
          }`}
        >
          All Fuels ({facilities.length})
        </button>

        {FUEL_CATEGORIES.map((cat) => {
          const isSelected = selectedFuel === cat.query;
          const count = summary.fuelCounts[cat.label] ?? 0;
          return (
            <button
              key={cat.label}
              type="button"
              onClick={() => onFuelChange(isSelected ? "ALL" : cat.query)}
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
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
              <span className="text-fg-muted font-mono text-xs">({count})</span>
            </button>
          );
        })}

        {selectedState !== "ALL" && (
          <Badge
            variant="outline"
            className="border-edge bg-surface-2 text-fg hover:bg-surface-2/80 shrink-0 cursor-pointer gap-1 py-0.5 text-xs"
            onClick={() => onStateChange("ALL")}
          >
            <span>State: {selectedState}</span>
            <FilterX className="text-fg-muted h-3 w-3" />
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
          value={`${Math.round(summary.totalCapacity).toLocaleString()} MW`}
          valueClassName="text-emerald-600 dark:text-emerald-400"
          className="border-edge/80 bg-surface/30 p-3.5"
        />
        <StatTile
          variant="card"
          label="Tracked Annual CO₂"
          value={`${Math.round(summary.totalEmissions).toLocaleString()} tons`}
          valueClassName="text-rose-600 dark:text-rose-400"
          className="border-edge/80 bg-surface/30 p-3.5"
        />
        <StatTile
          variant="card"
          label="Projection Engine"
          value={
            <span className="text-fg flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              {viewMode === "globe"
                ? "D3 Orthographic (3D)"
                : "Leaflet Mercator (2D)"}
            </span>
          }
          className="border-edge/80 bg-surface/30 p-3.5"
        />
      </div>
    </div>
  );
}
