"use client";

import { useDeferredValue, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Building2,
  Globe,
  Scale,
  Zap,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { KpiStrip, StatTile } from "~/components/ui/stat-tile";
import { ThemeToggle } from "~/components/ui/theme-toggle";
import {
  DEFAULT_FILTERS,
  DEFAULT_TABLE_STATE,
  type FilterChangeHandler,
  type SortField,
} from "~/lib/facility-filters";
import { formatQuantity } from "~/lib/utils";
import { api } from "~/trpc/react";
import { AuditLogsTable } from "./audit-logs-table";
import { EpaPrimer } from "./epa-primer";
import { FacilitiesMap } from "./facilities-map";
import { FacilitiesTable } from "./facilities-table";
import { FacilityDetailDialog } from "./facility-detail-dialog";
import { FacilityFilterBar } from "./facility-filters";
import { PlantComparisonDialog } from "./plant-comparison-dialog";

const MAX_COMPARE = 4;

export function DatabaseExplorer() {
  const [activeTab, setActiveTab] = useState<"explorer" | "map" | "audit">(
    "explorer",
  );
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const deferredFilters = useDeferredValue(filters);
  const [table, setTable] = useState(DEFAULT_TABLE_STATE);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [inspectFacilityId, setInspectFacilityId] = useState<number | null>(
    null,
  );

  const setPage = (page: number) => setTable((t) => ({ ...t, page }));
  const setFilter: FilterChangeHandler = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };
  const handleSortChange = (field: SortField) =>
    setTable((t) => ({
      ...t,
      page: 1,
      sortBy: field,
      sortDir:
        t.sortBy === field
          ? t.sortDir === "asc"
            ? "desc"
            : "asc"
          : field === "capacity" || field === "co2"
            ? "desc"
            : "asc",
    }));

  const toggleCompare = (id: number) =>
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) {
        alert(
          `Maximum of ${MAX_COMPARE} facilities can be compared simultaneously.`,
        );
        return prev;
      }
      return [...prev, id];
    });
  const canCompare = compareIds.length >= 2;

  const { data: stats } = api.facilities.getStats.useQuery(undefined, {
    staleTime: 0,
    refetchOnMount: "always",
  });
  const { data: filterOptions } = api.facilities.getFilterOptions.useQuery();
  const facilitiesQuery = api.facilities.getFacilities.useQuery(
    { ...table, ...deferredFilters },
    { placeholderData: (prev) => prev },
  );
  const mapQuery = api.facilities.getMapFacilities.useQuery(deferredFilters, {
    enabled: activeTab === "map",
    placeholderData: (prev) => prev,
  });
  const detailQuery = api.facilities.getFacility.useQuery(
    { id: inspectFacilityId! },
    { enabled: inspectFacilityId !== null },
  );
  const compareQuery = api.facilities.compareFacilities.useQuery(
    { ids: compareIds },
    { enabled: isCompareOpen && canCompare },
  );
  const auditQuery = api.facilities.getAuditLogs.useQuery(
    { limit: 50 },
    { enabled: activeTab === "audit", staleTime: 0, refetchOnMount: "always" },
  );

  const anomalyCount = stats?.totalAnomalies ?? 0;
  const loadingValue = (value: string | number) => (stats ? value : "...");

  return (
    <div className="bg-canvas text-fg selection:bg-surface-2 selection:text-fg min-h-screen antialiased">
      <header className="border-edge/80 bg-canvas/85 sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="border-edge bg-surface flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-xs">
              <Zap className="h-4 w-4 text-emerald-400" />
            </div>
            <span className="text-fg truncate text-base font-semibold tracking-tight">
              GridPulse
            </span>
            <Badge
              variant="outline"
              className="text-fg-muted hidden px-1.5 py-0 font-mono sm:inline-flex"
            >
              v1.0
            </Badge>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          </div>

          <div className="flex items-center gap-2">
            <SegmentedControl
              value={activeTab}
              onChange={setActiveTab}
              className="rounded-lg"
              options={[
                { value: "explorer", label: "Facilities" },
                {
                  value: "map",
                  label: "Map",
                  icon: <Globe className="h-3.5 w-3.5 text-emerald-400" />,
                },
                {
                  value: "audit",
                  label: (
                    <>
                      Audits{" "}
                      {anomalyCount > 0 && (
                        <Badge
                          variant="warning"
                          className="px-1.5 py-0 font-mono"
                        >
                          {anomalyCount}
                        </Badge>
                      )}
                    </>
                  ),
                },
              ]}
            />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div>
          <h1 className="text-fg text-3xl font-bold tracking-tight sm:text-4xl">
            US Power & Emissions Intelligence
          </h1>
          <p className="text-fg-muted mt-1 text-sm sm:text-base">
            Continuous stack monitoring, regional grid reliability, and
            automated physical sanity audits.
          </p>
        </div>

        <EpaPrimer />

        <KpiStrip className="gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
          <StatTile
            variant="card"
            label="Total Facilities"
            icon={<Building2 className="text-fg-muted h-4 w-4" />}
            value={loadingValue(
              formatQuantity(stats?.totalFacilities, "", { fallback: "0" }),
            )}
            subtext={`${stats?.totalStates ?? 52} states & territories`}
          />
          <StatTile
            variant="card"
            label="Tracked Capacity"
            icon={<Zap className="h-4 w-4 text-amber-400" />}
            value={loadingValue(
              `${((stats?.totalCapacityMW ?? 0) / 1000).toFixed(1)} GW`,
            )}
            subtext={formatQuantity(stats?.totalUnits, "generators", {
              fallback: "Active units",
            })}
          />
          <StatTile
            variant="card"
            label="Reliability Grids"
            icon={<Globe className="h-4 w-4 text-sky-400" />}
            value={loadingValue(`${stats?.totalNercRegions ?? 0} Regions`)}
            subtext="ERCOT, SERC, WECC, etc."
          />
          <StatTile
            variant="card"
            label="Annual CO₂"
            icon={<Activity className="h-4 w-4 text-emerald-400" />}
            value={loadingValue(
              stats?.totalCo2Tons
                ? `${(stats.totalCo2Tons / 1_000_000).toFixed(1)}M t`
                : "—",
            )}
            valueClassName="font-mono text-emerald-400"
            subtext="Monitored stack mass"
          />
          <StatTile
            variant="card"
            label="Audit Flags"
            icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
            value={loadingValue(anomalyCount)}
            valueClassName="font-mono text-amber-400"
            subtext="Sanity violations"
            className="col-span-2 sm:col-span-1"
          />
        </KpiStrip>

        {activeTab === "explorer" && (
          <div className="space-y-4">
            <FacilityFilterBar
              filters={filters}
              onFilterChange={setFilter}
              onResetFilters={resetFilters}
              filterOptions={filterOptions}
              totalMatching={facilitiesQuery.data?.totalCount}
              isLoading={facilitiesQuery.isLoading}
            />
            <FacilitiesTable
              data={facilitiesQuery.data}
              {...table}
              isLoading={facilitiesQuery.isLoading}
              isPlaceholderData={facilitiesQuery.isPlaceholderData}
              onSortChange={handleSortChange}
              compareIds={compareIds}
              onToggleCompare={toggleCompare}
              onInspect={setInspectFacilityId}
              onPageChange={setPage}
              onPageSizeChange={(pageSize) =>
                setTable((t) => ({ ...t, pageSize, page: 1 }))
              }
              onResetFilters={resetFilters}
            />
          </div>
        )}

        {activeTab === "map" && (
          <FacilitiesMap
            facilities={mapQuery.data}
            isLoading={mapQuery.isLoading}
            onInspectFacility={setInspectFacilityId}
            filters={filters}
            onFilterChange={setFilter}
          />
        )}

        {activeTab === "audit" && (
          <AuditLogsTable
            logs={auditQuery.data}
            isLoading={auditQuery.isLoading}
          />
        )}
      </main>

      <PlantComparisonDialog
        open={isCompareOpen}
        onOpenChange={setIsCompareOpen}
        plants={compareQuery.data}
        isLoading={compareQuery.isLoading}
        onClearSelection={() => setCompareIds([])}
        onRemovePlant={toggleCompare}
        onInspectPlant={setInspectFacilityId}
      />

      <FacilityDetailDialog
        onClose={() => setInspectFacilityId(null)}
        facilityId={inspectFacilityId}
        facility={detailQuery.data}
        isLoading={detailQuery.isLoading}
        onToggleCompare={toggleCompare}
        isInCompare={
          inspectFacilityId !== null && compareIds.includes(inspectFacilityId)
        }
      />

      {compareIds.length > 0 && (
        <aside
          aria-label="Plant benchmark comparison dock"
          className="animate-in fade-in slide-in-from-bottom-4 border-edge bg-surface/95 fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-2.5 rounded-full border px-3 py-1.5 shadow-2xl backdrop-blur-md duration-200 select-none sm:bottom-6 sm:gap-3 sm:px-4 sm:py-2"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            {compareIds.length}
          </span>
          <span className="text-fg-2 text-xs font-medium whitespace-nowrap sm:text-sm">
            {compareIds.length === 1
              ? "1 plant"
              : `${compareIds.length} plants`}
          </span>
          <div className="bg-edge h-4 w-px shrink-0" />
          {canCompare ? (
            <Button
              size="sm"
              onClick={() => setIsCompareOpen(true)}
              className="h-7 shrink-0 rounded-full px-3 sm:h-8 sm:px-3.5 sm:text-sm"
            >
              <Scale className="h-3.5 w-3.5" />
              Compare
            </Button>
          ) : (
            <span className="text-fg-muted hidden shrink-0 text-xs italic sm:inline">
              Select 1 more to compare
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCompareIds([])}
            className="h-7 px-1.5"
          >
            Clear
          </Button>
        </aside>
      )}
    </div>
  );
}
