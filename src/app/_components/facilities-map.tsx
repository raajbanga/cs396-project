"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  FilterX,
  Flame,
  Globe,
  Map as MapIcon,
  Sparkles,
  Zap,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { StatTile } from "~/components/ui/stat-tile";
import type {
  FacilityFilters,
  FilterChangeHandler,
} from "~/lib/facility-filters";
import {
  FUEL_CATEGORIES,
  getFuelTheme,
  MAP_FRAME,
  type MapFacility,
  type MetricMode,
} from "~/lib/map-utils";
import { cn } from "~/lib/utils";
import { D3Globe, MapSpinner } from "./d3-globe";

// Leaflet touches `window` on import, so it can only load client-side.
const LeafletMap = dynamic(
  () => import("./leaflet-map").then((mod) => mod.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div
        className={cn(
          MAP_FRAME,
          "bg-surface/30 flex items-center justify-center",
        )}
      >
        <MapSpinner label="Loading 2D Leaflet Map..." />
      </div>
    ),
  },
);

const CHIP =
  "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors";
const CHIP_IDLE = "border-edge bg-surface/60 text-fg-muted hover:text-fg";

export function FacilitiesMap({
  facilities = [],
  isLoading,
  onInspectFacility,
  filters,
  onFilterChange,
}: {
  facilities?: MapFacility[];
  isLoading: boolean;
  onInspectFacility: (id: number) => void;
  filters: FacilityFilters;
  onFilterChange: FilterChangeHandler;
}) {
  const [viewMode, setViewMode] = useState<"globe" | "leaflet">("globe");
  const [metricMode, setMetricMode] = useState<MetricMode>("capacity");
  const isGlobe = viewMode === "globe";

  const summary = useMemo(() => {
    const fuelCounts: Record<string, number> = {};
    let totalCapacity = 0;
    let totalEmissions = 0;
    for (const f of facilities) {
      const { name } = getFuelTheme(f.primaryFuel);
      fuelCounts[name] = (fuelCounts[name] ?? 0) + 1;
      totalCapacity += f.totalCapacityMW;
      totalEmissions += f.totalCo2Tons;
    }
    return { fuelCounts, totalCapacity, totalEmissions };
  }, [facilities]);

  const MapView = isGlobe ? D3Globe : LeafletMap;

  return (
    <div className="space-y-4">
      <div className="border-edge/80 bg-surface/60 flex flex-col gap-2.5 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex items-center gap-2.5">
          <div className="border-edge bg-surface flex h-8 w-8 shrink-0 items-center justify-center rounded-md border shadow-xs">
            {isGlobe ? (
              <Globe className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            ) : (
              <MapIcon className="h-4 w-4 text-sky-500 dark:text-cyan-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-fg text-sm font-semibold tracking-tight sm:text-base">
                {isGlobe ? "3D Globe" : "2D Map"}
              </h2>
              <Badge variant="success" className="font-mono">
                {isLoading
                  ? "..."
                  : `${facilities.length.toLocaleString()} facilities`}
              </Badge>
            </div>
            <p className="text-fg-muted hidden text-xs sm:block">
              {isGlobe
                ? "Interactive spherical orthographic globe"
                : "Cartographic Mercator map with facility coordinates"}
            </p>
          </div>
        </div>

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

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => onFilterChange("primaryFuel", "ALL")}
          className={cn(
            CHIP,
            filters.primaryFuel === "ALL"
              ? "border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
              : CHIP_IDLE,
          )}
        >
          All Fuels ({facilities.length})
        </button>
        {FUEL_CATEGORIES.map((cat) => {
          const isSelected = filters.primaryFuel === cat.query;
          return (
            <button
              key={cat.label}
              type="button"
              onClick={() =>
                onFilterChange("primaryFuel", isSelected ? "ALL" : cat.query)
              }
              className={cn(
                CHIP,
                isSelected
                  ? "border-edge bg-surface-2 text-fg shadow-xs"
                  : CHIP_IDLE,
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              {cat.label}
              <span className="text-fg-muted font-mono">
                ({summary.fuelCounts[cat.label] ?? 0})
              </span>
            </button>
          );
        })}
        {filters.stateCode !== "ALL" && (
          <button
            type="button"
            onClick={() => onFilterChange("stateCode", "ALL")}
            className={cn(CHIP, "border-edge bg-surface-2 text-fg")}
          >
            State: {filters.stateCode}
            <FilterX className="text-fg-muted h-3 w-3" />
          </button>
        )}
      </div>

      <MapView
        facilities={facilities}
        onInspectFacility={onInspectFacility}
        metricMode={metricMode}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Visible Facilities",
            value: facilities.length.toLocaleString(),
          },
          {
            label: "Tracked Capacity",
            value: `${Math.round(summary.totalCapacity).toLocaleString()} MW`,
            valueClassName: "text-emerald-600 dark:text-emerald-400",
          },
          {
            label: "Tracked Annual CO₂",
            value: `${Math.round(summary.totalEmissions).toLocaleString()} tons`,
            valueClassName: "text-rose-600 dark:text-rose-400",
          },
          {
            label: "Projection Engine",
            value: (
              <span className="flex items-center gap-1.5 text-sm">
                <Sparkles className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                {isGlobe ? "D3 Orthographic (3D)" : "Leaflet Mercator (2D)"}
              </span>
            ),
          },
        ].map((tile) => (
          <StatTile
            key={tile.label}
            variant="card"
            className="p-3.5 sm:p-3.5"
            {...tile}
          />
        ))}
      </div>
    </div>
  );
}
