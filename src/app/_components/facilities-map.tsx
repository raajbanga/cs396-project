"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { X } from "lucide-react";
import { SourceBadge } from "~/components/ui/badge";
import { PageTitle } from "~/components/ui/page";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  DEFAULT_FILTERS,
  filterSearchParams,
  isFilterActive,
  isStrictKey,
  type ExplorerState,
  type FacilityFilters,
  type FilterChangeHandler,
} from "~/lib/facility-filters";
import {
  FUEL_CATEGORIES,
  getFuelTheme,
  MAP_FRAME,
  type MetricMode,
} from "~/lib/map-utils";
import { cn, formatQuantity, plural, replaceUrlQuery } from "~/lib/utils";
import { api } from "~/trpc/react";
import { D3Globe, MapSpinner } from "./d3-globe";
import { DetailLink } from "./detail-link";
import { SelectionContext } from "./selection-context";

// Leaflet touches `window` on import, so it can only load client-side.
const LeafletMap = dynamic(
  () => import("./leaflet-map").then((mod) => mod.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className={cn(MAP_FRAME, "flex items-center justify-center")}>
        <MapSpinner label="Loading map…" />
      </div>
    ),
  },
);

const CHIP =
  "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border px-2 py-1 text-sm";
const CHIP_IDLE = "border-transparent text-fg-2 hover:bg-surface-2";

/**
 * Map page: the explorer's filters (from the URL) drawn on a globe or a flat map, with a fuel
 * legend that doubles as a filter on the dots' color class, so a chip's count is what it shows.
 * A dot opens its facility in the detail dialog.
 */
export function MapPage({ initialState }: { initialState: ExplorerState }) {
  const { inspect } = use(SelectionContext);
  const [filters, setFilters] = useState(initialState.filters);
  const [viewMode, setViewMode] = useState<"globe" | "leaflet">("globe");
  const [metricMode, setMetricMode] = useState<MetricMode>("capacity");
  const [fuelClass, setFuelClass] = useState<string | null>(null);
  const query = filterSearchParams(filters).toString();
  useEffect(() => replaceUrlQuery(query), [query]);

  const mapQuery = api.facilities.getMapFacilities.useQuery(filters, {
    placeholderData: (prev) => prev,
  });
  const allFacilities = useMemo(
    () => mapQuery.data?.facilities ?? [],
    [mapQuery.data],
  );
  const facilities = useMemo(
    () =>
      fuelClass
        ? allFacilities.filter(
            (f) => getFuelTheme(f.primaryFuel).name === fuelClass,
          )
        : allFacilities,
    [allFacilities, fuelClass],
  );
  const unlocated = mapQuery.data?.unlocated ?? [];
  const setFilter: FilterChangeHandler = (key, value) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const onInspectFacility = useCallback(
    (id: number) => inspect({ kind: "facility", id }),
    [inspect],
  );
  // Filters the map has no control for, carried over from Explore.
  const otherFilters = (
    Object.keys(DEFAULT_FILTERS) as (keyof FacilityFilters)[]
  ).filter(
    (k) => k !== "stateCode" && !isStrictKey(k) && isFilterActive(filters, k),
  ).length;

  const fuelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of allFacilities) {
      const { name } = getFuelTheme(f.primaryFuel);
      counts[name] = (counts[name] ?? 0) + 1;
    }
    return counts;
  }, [allFacilities]);
  const totalCapacity = facilities.reduce((n, f) => n + f.totalCapacityMW, 0);
  const totalEmissions = facilities.reduce((n, f) => n + f.totalCo2Tons, 0);

  const MapView = viewMode === "globe" ? D3Globe : LeafletMap;

  return (
    <div className="space-y-5">
      <PageTitle
        lead={
          <>
            Every facility with coordinates, colored by primary fuel and sized
            by capacity or CO₂. Hover a dot for a summary; click it for details.
            {otherFilters > 0 && (
              <>
                {" "}
                Also filtered by {plural(otherFilters, "setting")} from{" "}
                <Link
                  href={`/explore?${query}`}
                  className="text-primary hover:underline"
                >
                  Explore
                </Link>
                .
              </>
            )}
          </>
        }
      >
        Map
      </PageTitle>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: "globe", label: "Globe" },
              { value: "leaflet", label: "Flat map" },
            ]}
          />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-fg-muted">Dot size</span>
            <SegmentedControl
              value={metricMode}
              onChange={setMetricMode}
              options={[
                { value: "capacity", label: "Capacity" },
                { value: "co2", label: "CO₂" },
                { value: "uniform", label: "Same" },
              ]}
            />
          </div>
        </div>
        <SourceBadge kind="db" />
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setFuelClass(null)}
          className={cn(
            CHIP,
            fuelClass === null ? "border-edge bg-surface text-fg" : CHIP_IDLE,
          )}
          aria-pressed={fuelClass === null}
        >
          All fuels
          <span className="text-fg-muted tabular-nums">
            {mapQuery.isLoading ? "…" : allFacilities.length.toLocaleString()}
          </span>
        </button>
        {FUEL_CATEGORIES.map((cat) => {
          const isSelected = fuelClass === cat.name;
          return (
            <button
              key={cat.name}
              type="button"
              onClick={() => setFuelClass(isSelected ? null : cat.name)}
              className={cn(
                CHIP,
                isSelected ? "border-edge bg-surface text-fg" : CHIP_IDLE,
              )}
              aria-pressed={isSelected}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              {cat.name}
              <span className="text-fg-muted tabular-nums">
                {fuelCounts[cat.name] ?? 0}
              </span>
            </button>
          );
        })}
        {filters.stateCode !== "ALL" && (
          <button
            type="button"
            onClick={() => setFilter("stateCode", "ALL")}
            className={cn(CHIP, "border-edge bg-surface text-fg")}
            aria-label={`Remove state filter ${filters.stateCode}`}
          >
            State {filters.stateCode}
            <X className="text-fg-muted h-3 w-3" />
          </button>
        )}
      </div>

      <MapView
        facilities={facilities}
        onInspectFacility={onInspectFacility}
        metricMode={metricMode}
      />

      <p className="text-fg-2 text-sm">
        <strong className="text-fg font-medium tabular-nums">
          {facilities.length.toLocaleString()}
        </strong>{" "}
        facilities on the map,{" "}
        <strong className="text-fg font-medium tabular-nums">
          {formatQuantity(totalCapacity / 1000, "GW", { digits: 1 })}
        </strong>{" "}
        of capacity,{" "}
        <strong className="text-fg font-medium tabular-nums">
          {formatQuantity(totalEmissions / 1_000_000, "million t", {
            digits: 1,
          })}
        </strong>{" "}
        of CO₂{" "}
        {filters.year === "ALL"
          ? "across all stored years"
          : `in ${filters.year}`}
        .
      </p>

      {unlocated.length > 0 && (
        <details className="text-fg-2 text-sm">
          <summary className="cursor-pointer">
            {plural(
              unlocated.length,
              "matching facility",
              "matching facilities",
            )}{" "}
            without coordinates in CAMPD {unlocated.length === 1 ? "is" : "are"}{" "}
            not drawn. Open one:
          </summary>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {unlocated.map((f) => (
              <DetailLink key={f.id} view={{ kind: "facility", id: f.id }}>
                {f.name} ({f.stateCode})
              </DetailLink>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
