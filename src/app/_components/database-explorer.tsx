"use client";

import { useState } from "react";
import { Globe, RefreshCw, Scale, Zap } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ThemeToggle } from "~/components/ui/theme-toggle";
import { useFacilityFilters } from "~/hooks/use-facility-filters";
import { usePlantComparison } from "~/hooks/use-plant-comparison";
import { api } from "~/trpc/react";
import { AuditLogsTable } from "./audit-logs-table";
import { CampdSyncDialog } from "./campd-sync-dialog";
import { EpaPrimer } from "./epa-primer";
import { FacilitiesMap } from "./facilities-map";
import { FacilitiesTable } from "./facilities-table";
import { FacilityDetailDialog } from "./facility-detail-dialog";
import { FacilityFilters } from "./facility-filters";
import { PlantComparisonDialog } from "./plant-comparison-dialog";
import { StatMetrics } from "./stat-metrics";

export function DatabaseExplorer() {
  const [activeTab, setActiveTab] = useState<"explorer" | "map" | "audit">(
    "explorer",
  );

  // Custom encapsulated state hooks
  const filters = useFacilityFilters();
  const comparison = usePlantComparison();

  // Unit inspector modal
  const [inspectFacilityId, setInspectFacilityId] = useState<number | null>(
    null,
  );

  // CAMPD API Sync modal
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncYear, setSyncYear] = useState<number>(2022);
  const [syncState, setSyncState] = useState<string>("ALL");
  const [syncLimit, setSyncLimit] = useState<number>(100);

  // tRPC Client queries
  const utils = api.useUtils();
  const { data: stats, isLoading: statsLoading } =
    api.facilities.getStats.useQuery();

  const { data: filterOptions } = api.facilities.getFilterOptions.useQuery();

  const {
    data: facilitiesData,
    isLoading: facilitiesLoading,
    isPlaceholderData,
  } = api.facilities.getFacilities.useQuery(
    {
      page: filters.page,
      pageSize: filters.pageSize,
      search: filters.debouncedSearch,
      stateCode: filters.selectedState,
      primaryFuel: filters.selectedFuel,
      nercRegion: filters.selectedNerc,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
    },
    {
      placeholderData: (prev) => prev,
    },
  );

  const { data: mapFacilities, isLoading: mapFacilitiesLoading } =
    api.facilities.getMapFacilities.useQuery(
      {
        search: filters.debouncedSearch,
        stateCode: filters.selectedState,
        primaryFuel: filters.selectedFuel,
        nercRegion: filters.selectedNerc,
      },
      {
        placeholderData: (prev) => prev,
      },
    );

  const { data: selectedFacility, isLoading: facilityDetailLoading } =
    api.facilities.getFacility.useQuery(
      { id: inspectFacilityId! },
      { enabled: inspectFacilityId !== null },
    );

  const { data: compareData, isLoading: compareLoading } =
    api.facilities.compareFacilities.useQuery(
      { ids: comparison.compareIds },
      { enabled: comparison.isCompareOpen && comparison.canCompare },
    );

  const { data: auditLogs, isLoading: auditLoading } =
    api.facilities.getAuditLogs.useQuery(
      { limit: 50 },
      { enabled: activeTab === "audit" },
    );

  // Sync Mutation
  const syncMutation = api.facilities.syncCampdData.useMutation({
    onSuccess: () => {
      void utils.facilities.getStats.invalidate();
      void utils.facilities.getFacilities.invalidate();
      void utils.facilities.getMapFacilities.invalidate();
      void utils.facilities.getAuditLogs.invalidate();
    },
  });

  return (
    <div className="min-h-screen bg-canvas text-fg antialiased selection:bg-surface-2 selection:text-fg">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-edge/80 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6 lg:px-8">
          {/* Logo & Title */}
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-edge bg-surface shadow-xs">
              <Zap className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-base font-semibold tracking-tight text-fg">
                  GridPulse
                </span>
                <Badge
                  variant="outline"
                  className="hidden border-edge py-0 px-1.5 font-mono text-xs text-fg-muted sm:inline-flex"
                >
                  v1.0
                </Badge>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
              </div>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* View Tab Switcher */}
            <div className="flex rounded-lg border border-edge/80 bg-surface/60 p-0.5 text-xs sm:text-sm">
              <button
                type="button"
                onClick={() => setActiveTab("explorer")}
                className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-all sm:px-3 sm:text-sm ${
                  activeTab === "explorer"
                    ? "bg-surface-2 text-fg shadow-xs"
                    : "text-fg-muted hover:text-fg"
                }`}
              >
                Facilities
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("map")}
                className={`flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all sm:gap-1.5 sm:px-3 sm:text-sm ${
                  activeTab === "map"
                    ? "bg-surface-2 text-fg shadow-xs"
                    : "text-fg-muted hover:text-fg"
                }`}
              >
                <Globe className="h-3.5 w-3.5 text-emerald-400" />
                <span>Map</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("audit")}
                className={`flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all sm:gap-1.5 sm:px-3 sm:text-sm ${
                  activeTab === "audit"
                    ? "bg-surface-2 text-fg shadow-xs"
                    : "text-fg-muted hover:text-fg"
                }`}
              >
                <span>Audits</span>
                {(stats?.totalAnomalies ?? 0) > 0 && (
                  <Badge
                    variant="warning"
                    className="px-1.5 py-0 font-mono text-xs"
                  >
                    {stats?.totalAnomalies}
                  </Badge>
                )}
              </button>
            </div>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Data Sync Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSyncModalOpen(true)}
              className="h-8 w-8 gap-1.5 border-edge bg-surface/60 p-0 text-xs text-fg-2 hover:text-fg sm:w-auto sm:px-3"
              title="Sync Data"
            >
              <RefreshCw className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Sync Data</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
        {/* Page Title */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">
              US Power & Emissions Intelligence
            </h1>
            <p className="mt-1 text-sm text-fg-muted sm:text-base">
              Continuous stack monitoring, regional grid reliability, and
              automated physical sanity audits.
            </p>
          </div>
        </div>

        {/* Educational Reference Primer */}
        <EpaPrimer />

        {/* Stats Metrics Cards */}
        <StatMetrics stats={stats} isLoading={statsLoading} />

        {/* Tab 1: Facilities Explorer */}
        {activeTab === "explorer" && (
          <div className="space-y-4">
            <FacilityFilters
              search={filters.search}
              onSearchChange={filters.setSearch}
              selectedState={filters.selectedState}
              onStateChange={filters.setSelectedState}
              selectedNerc={filters.selectedNerc}
              onNercChange={filters.setSelectedNerc}
              selectedFuel={filters.selectedFuel}
              onFuelChange={filters.setSelectedFuel}
              filterOptions={filterOptions}
              totalMatching={facilitiesData?.totalCount}
              isLoading={facilitiesLoading}
              hasActiveFilters={filters.hasActiveFilters}
              onResetFilters={filters.resetFilters}
            />

            <FacilitiesTable
              facilities={facilitiesData?.items}
              totalCount={facilitiesData?.totalCount}
              totalPages={facilitiesData?.totalPages}
              page={filters.page}
              pageSize={filters.pageSize}
              isLoading={facilitiesLoading}
              isPlaceholderData={isPlaceholderData}
              sortBy={filters.sortBy}
              sortDir={filters.sortDir}
              onSortChange={filters.handleSortChange}
              compareIds={comparison.compareIds}
              onToggleCompare={comparison.toggleCompare}
              onInspect={(id) => setInspectFacilityId(id)}
              onPageChange={filters.setPage}
              onPageSizeChange={filters.setPageSize}
              onResetFilters={filters.resetFilters}
            />
          </div>
        )}

        {/* Tab 2: Map View */}
        {activeTab === "map" && (
          <FacilitiesMap
            facilities={mapFacilities}
            isLoading={mapFacilitiesLoading}
            onInspectFacility={(id) => setInspectFacilityId(id)}
            selectedFuel={filters.selectedFuel}
            onFuelChange={filters.setSelectedFuel}
            selectedState={filters.selectedState}
            onStateChange={filters.setSelectedState}
          />
        )}

        {/* Tab 3: Audit Logs */}
        {activeTab === "audit" && (
          <AuditLogsTable logs={auditLogs} isLoading={auditLoading} />
        )}
      </main>

      {/* Head-to-Head Plant Benchmarking */}
      <PlantComparisonDialog
        open={comparison.isCompareOpen}
        onOpenChange={comparison.setIsCompareOpen}
        plants={compareData}
        isLoading={compareLoading}
        onClearSelection={comparison.clearCompare}
        onRemovePlant={comparison.removeCompare}
        onInspectPlant={(id) => setInspectFacilityId(id)}
      />

      {/* Facility Detail Modal */}
      <FacilityDetailDialog
        open={inspectFacilityId !== null}
        onOpenChange={(open) => !open && setInspectFacilityId(null)}
        facilityId={inspectFacilityId}
        facility={selectedFacility}
        isLoading={facilityDetailLoading}
        onToggleCompare={comparison.toggleCompare}
        isInCompare={
          inspectFacilityId !== null && comparison.isSelected(inspectFacilityId)
        }
      />

      {/* CAMPD Sync Modal */}
      <CampdSyncDialog
        open={isSyncModalOpen}
        onOpenChange={setIsSyncModalOpen}
        syncYear={syncYear}
        onSyncYearChange={setSyncYear}
        syncState={syncState}
        onSyncStateChange={setSyncState}
        syncLimit={syncLimit}
        onSyncLimitChange={setSyncLimit}
        states={filterOptions?.states}
        isPending={syncMutation.isPending}
        isSuccess={syncMutation.isSuccess}
        isError={syncMutation.isError}
        errorMessage={syncMutation.error?.message}
        mutationData={syncMutation.data}
        onTriggerSync={() =>
          syncMutation.mutate({
            year: syncYear,
            stateCode: syncState !== "ALL" ? syncState : undefined,
            limit: syncLimit,
          })
        }
      />

      {/* Floating Benchmark Dock */}
      {comparison.count > 0 && (
        <aside
          aria-label="Plant benchmark comparison dock"
          className="fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 items-center gap-2.5 rounded-full border border-edge bg-surface/95 px-3 py-1.5 shadow-2xl backdrop-blur-md duration-200 select-none sm:bottom-6 sm:gap-3 sm:px-4 sm:py-2"
        >
          <div className="flex shrink-0 items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {comparison.count}
            </span>
            <span className="whitespace-nowrap text-xs font-medium text-fg-2 sm:text-sm">
              {comparison.count === 1
                ? "1 plant"
                : `${comparison.count} plants`}
            </span>
          </div>

          <div className="h-4 w-px shrink-0 bg-edge" />

          {comparison.canCompare ? (
            <Button
              size="sm"
              onClick={() => comparison.setIsCompareOpen(true)}
              className="h-7 shrink-0 gap-1.5 rounded-full px-3 text-xs font-medium shadow-xs sm:h-8 sm:px-3.5 sm:text-sm"
            >
              <Scale className="h-3.5 w-3.5" />
              <span>Compare</span>
            </Button>
          ) : (
            <span className="hidden shrink-0 text-xs italic text-fg-muted sm:inline">
              Select 1 more to compare
            </span>
          )}

          <button
            type="button"
            onClick={comparison.clearCompare}
            className="shrink-0 cursor-pointer rounded px-1.5 py-1 text-xs text-fg-muted transition-colors hover:text-fg"
          >
            Clear
          </button>
        </aside>
      )}
    </div>
  );
}
