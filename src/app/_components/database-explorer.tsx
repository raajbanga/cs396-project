"use client";

import { useEffect, useState } from "react";
import { Globe, Scale, Zap } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ThemeToggle } from "~/components/ui/theme-toggle";
import { api } from "~/trpc/react";
import { AuditLogsTable } from "./audit-logs-table";
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

  // Consolidated Filter State
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedState, setSelectedState] = useState<string>("ALL");
  const [selectedFuel, setSelectedFuel] = useState<string>("ALL");
  const [selectedNerc, setSelectedNerc] = useState<string>("ALL");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [sortBy, setSortBy] = useState<"name" | "id" | "capacity" | "co2">(
    "name",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Consolidated Plant Comparison State
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSortChange = (field: "name" | "id" | "capacity" | "co2") => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(field === "capacity" || field === "co2" ? "desc" : "asc");
    }
    setPage(1);
  };

  const handleStateChange = (st: string) => {
    setSelectedState(st);
    setPage(1);
  };

  const handleFuelChange = (fuel: string) => {
    setSelectedFuel(fuel);
    setPage(1);
  };

  const handleNercChange = (nerc: string) => {
    setSelectedNerc(nerc);
    setPage(1);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    selectedState !== "ALL" ||
    selectedFuel !== "ALL" ||
    selectedNerc !== "ALL";

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setSelectedState("ALL");
    setSelectedFuel("ALL");
    setSelectedNerc("ALL");
    setPage(1);
  };

  const toggleCompare = (id: number) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 4) {
        alert("Maximum of 4 facilities can be compared simultaneously.");
        return prev;
      }
      return [...prev, id];
    });
  };

  const removeCompare = (id: number) => {
    setCompareIds((prev) => prev.filter((x) => x !== id));
  };

  const clearCompare = () => {
    setCompareIds([]);
  };

  const isCompareSelected = (id: number) => compareIds.includes(id);
  const canCompare = compareIds.length >= 2;
  const compareCount = compareIds.length;

  // Unit inspector modal
  const [inspectFacilityId, setInspectFacilityId] = useState<number | null>(
    null,
  );

  // tRPC Client queries
  const { data: stats, isLoading: statsLoading } =
    api.facilities.getStats.useQuery();

  const { data: filterOptions } = api.facilities.getFilterOptions.useQuery();

  const {
    data: facilitiesData,
    isLoading: facilitiesLoading,
    isPlaceholderData,
  } = api.facilities.getFacilities.useQuery(
    {
      page,
      pageSize,
      search: debouncedSearch,
      stateCode: selectedState,
      primaryFuel: selectedFuel,
      nercRegion: selectedNerc,
      sortBy,
      sortDir,
    },
    {
      placeholderData: (prev) => prev,
    },
  );

  const { data: mapFacilities, isLoading: mapFacilitiesLoading } =
    api.facilities.getMapFacilities.useQuery(
      {
        search: debouncedSearch,
        stateCode: selectedState,
        primaryFuel: selectedFuel,
        nercRegion: selectedNerc,
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
      { ids: compareIds },
      { enabled: isCompareOpen && canCompare },
    );

  const { data: auditLogs, isLoading: auditLoading } =
    api.facilities.getAuditLogs.useQuery(
      { limit: 50 },
      { enabled: activeTab === "audit" },
    );

  return (
    <div className="bg-canvas text-fg selection:bg-surface-2 selection:text-fg min-h-screen antialiased">
      {/* Top Navigation Bar */}
      <header className="border-edge/80 bg-canvas/85 sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6 lg:px-8">
          {/* Logo & Title */}
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="border-edge bg-surface flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-xs">
              <Zap className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-fg truncate text-base font-semibold tracking-tight">
                  GridPulse
                </span>
                <Badge
                  variant="outline"
                  className="border-edge text-fg-muted hidden px-1.5 py-0 font-mono text-xs sm:inline-flex"
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
            <div className="border-edge/80 bg-surface/60 flex rounded-lg border p-0.5 text-xs sm:text-sm">
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
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
        {/* Page Title */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-fg text-3xl font-bold tracking-tight sm:text-4xl">
              US Power & Emissions Intelligence
            </h1>
            <p className="text-fg-muted mt-1 text-sm sm:text-base">
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
              search={search}
              onSearchChange={setSearch}
              selectedState={selectedState}
              onStateChange={handleStateChange}
              selectedNerc={selectedNerc}
              onNercChange={handleNercChange}
              selectedFuel={selectedFuel}
              onFuelChange={handleFuelChange}
              filterOptions={filterOptions}
              totalMatching={facilitiesData?.totalCount}
              isLoading={facilitiesLoading}
              hasActiveFilters={hasActiveFilters}
              onResetFilters={resetFilters}
            />

            <FacilitiesTable
              facilities={facilitiesData?.items}
              totalCount={facilitiesData?.totalCount}
              totalPages={facilitiesData?.totalPages}
              page={page}
              pageSize={pageSize}
              isLoading={facilitiesLoading}
              isPlaceholderData={isPlaceholderData}
              sortBy={sortBy}
              sortDir={sortDir}
              onSortChange={handleSortChange}
              compareIds={compareIds}
              onToggleCompare={toggleCompare}
              onInspect={(id) => setInspectFacilityId(id)}
              onPageChange={setPage}
              onPageSizeChange={handlePageSizeChange}
              onResetFilters={resetFilters}
            />
          </div>
        )}

        {/* Tab 2: Map View */}
        {activeTab === "map" && (
          <FacilitiesMap
            facilities={mapFacilities}
            isLoading={mapFacilitiesLoading}
            onInspectFacility={(id) => setInspectFacilityId(id)}
            selectedFuel={selectedFuel}
            onFuelChange={handleFuelChange}
            selectedState={selectedState}
            onStateChange={handleStateChange}
          />
        )}

        {/* Tab 3: Audit Logs */}
        {activeTab === "audit" && (
          <AuditLogsTable logs={auditLogs} isLoading={auditLoading} />
        )}
      </main>

      {/* Head-to-Head Plant Benchmarking */}
      <PlantComparisonDialog
        open={isCompareOpen}
        onOpenChange={setIsCompareOpen}
        plants={compareData}
        isLoading={compareLoading}
        onClearSelection={clearCompare}
        onRemovePlant={removeCompare}
        onInspectPlant={(id) => setInspectFacilityId(id)}
      />

      {/* Facility Detail Modal */}
      <FacilityDetailDialog
        open={inspectFacilityId !== null}
        onOpenChange={(open) => !open && setInspectFacilityId(null)}
        facilityId={inspectFacilityId}
        facility={selectedFacility}
        isLoading={facilityDetailLoading}
        onToggleCompare={toggleCompare}
        isInCompare={
          inspectFacilityId !== null && isCompareSelected(inspectFacilityId)
        }
      />

      {/* Floating Benchmark Dock */}
      {compareCount > 0 && (
        <aside
          aria-label="Plant benchmark comparison dock"
          className="animate-in fade-in slide-in-from-bottom-4 border-edge bg-surface/95 fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-2.5 rounded-full border px-3 py-1.5 shadow-2xl backdrop-blur-md duration-200 select-none sm:bottom-6 sm:gap-3 sm:px-4 sm:py-2"
        >
          <div className="flex shrink-0 items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {compareCount}
            </span>
            <span className="text-fg-2 text-xs font-medium whitespace-nowrap sm:text-sm">
              {compareCount === 1 ? "1 plant" : `${compareCount} plants`}
            </span>
          </div>

          <div className="bg-edge h-4 w-px shrink-0" />

          {canCompare ? (
            <Button
              size="sm"
              onClick={() => setIsCompareOpen(true)}
              className="h-7 shrink-0 gap-1.5 rounded-full px-3 text-xs font-medium shadow-xs sm:h-8 sm:px-3.5 sm:text-sm"
            >
              <Scale className="h-3.5 w-3.5" />
              <span>Compare</span>
            </Button>
          ) : (
            <span className="text-fg-muted hidden shrink-0 text-xs italic sm:inline">
              Select 1 more to compare
            </span>
          )}

          <button
            type="button"
            onClick={clearCompare}
            className="text-fg-muted hover:text-fg shrink-0 cursor-pointer rounded px-1.5 py-1 text-xs transition-colors"
          >
            Clear
          </button>
        </aside>
      )}
    </div>
  );
}
