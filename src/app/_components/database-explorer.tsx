"use client";

import { useEffect, useMemo, useState } from "react";
import { Database, RefreshCw, Scale } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { AuditLogsTable } from "./audit-logs-table";
import { CampdSyncDialog } from "./campd-sync-dialog";
import { EpaPrimer } from "./epa-primer";
import { FacilitiesTable } from "./facilities-table";
import { FacilityDetailDialog } from "./facility-detail-dialog";
import { FacilityFilters } from "./facility-filters";
import { PlantComparisonDialog } from "./plant-comparison-dialog";
import { StatMetrics } from "./stat-metrics";

export function DatabaseExplorer() {
  const [activeTab, setActiveTab] = useState<"explorer" | "audit">("explorer");

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedState, setSelectedState] = useState<string>("ALL");
  const [selectedFuel, setSelectedFuel] = useState<string>("ALL");
  const [selectedNerc, setSelectedNerc] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [sortBy, setSortBy] = useState<"name" | "id" | "capacity" | "co2">(
    "name",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Benchmarking Selection (2-4 plants)
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  // Unit inspector modal
  const [inspectFacilityId, setInspectFacilityId] = useState<number | null>(
    null,
  );

  // CAMPD API Sync modal
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncYear, setSyncYear] = useState<number>(2022);
  const [syncState, setSyncState] = useState<string>("ALL");
  const [syncLimit, setSyncLimit] = useState<number>(100);

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
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDir(field === "capacity" || field === "co2" ? "desc" : "asc");
    }
    setPage(1);
  };

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
      page,
      pageSize,
      search: debouncedSearch,
      stateCode: selectedState,
      primaryFuel: selectedFuel,
      nercRegion: selectedNerc,
      sourceCategory: selectedCategory,
      sortBy,
      sortDir,
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
      { enabled: isCompareOpen && compareIds.length >= 2 },
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
      void utils.facilities.getAuditLogs.invalidate();
    },
  });

  const hasActiveFilters = useMemo(
    () =>
      search.trim() !== "" ||
      selectedState !== "ALL" ||
      selectedFuel !== "ALL" ||
      selectedNerc !== "ALL" ||
      selectedCategory !== "ALL",
    [search, selectedState, selectedFuel, selectedNerc, selectedCategory],
  );

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setSelectedState("ALL");
    setSelectedFuel("ALL");
    setSelectedNerc("ALL");
    setSelectedCategory("ALL");
    setPage(1);
  };

  const toggleCompareId = (id: number) => {
    if (compareIds.includes(id)) {
      setCompareIds(compareIds.filter((x) => x !== id));
    } else {
      if (compareIds.length >= 4) {
        alert("Maximum of 4 facilities can be compared simultaneously.");
        return;
      }
      setCompareIds([...compareIds, id]);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 antialiased selection:bg-zinc-800 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-200">
              <Database className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight text-white">
                  EPA CAMPD Management System
                </span>
                <Badge variant="outline" className="py-0 font-mono text-[10px]">
                  Phase 1 Core
                </Badge>
              </div>
              <p className="text-[11px] text-zinc-400">
                Continuous Emissions Monitoring & Relational Registry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* View Tab Switcher */}
            <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("explorer")}
                className={`cursor-pointer rounded-md px-3 py-1 font-medium transition-all ${
                  activeTab === "explorer"
                    ? "bg-zinc-800 text-white shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Facilities Explorer
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("audit")}
                className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-all ${
                  activeTab === "audit"
                    ? "bg-zinc-800 text-white shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <span>Audit Logs</span>
                {(stats?.totalAnomalies ?? 0) > 0 && (
                  <Badge
                    variant="warning"
                    className="px-1 py-0 font-mono text-[10px]"
                  >
                    {stats?.totalAnomalies}
                  </Badge>
                )}
              </button>
            </div>

            {/* Ingestion Sync Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSyncModalOpen(true)}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5 text-emerald-400" />
              <span>CAMPD Sync</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* Header Action Bar */}
        <div className="flex flex-col gap-4 border-b border-zinc-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Power Generation & Emissions Explorer
            </h1>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-400">
              Relational registry of power generation units across NERC
              reliability grids, source categories, and utility operators.
              Includes verified annual generation, gross carbon emissions, and
              automated physical sanity auditing.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {compareIds.length >= 2 && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsCompareOpen(true)}
                className="gap-1.5 shadow-md"
              >
                <Scale className="h-3.5 w-3.5" />
                <span>Compare Plants ({compareIds.length})</span>
              </Button>
            )}
          </div>
        </div>

        {/* Educational 101 Primer for Demystifying EPA Data */}
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
              onStateChange={(st) => {
                setSelectedState(st);
                setPage(1);
              }}
              selectedNerc={selectedNerc}
              onNercChange={(n) => {
                setSelectedNerc(n);
                setPage(1);
              }}
              selectedCategory={selectedCategory}
              onCategoryChange={(c) => {
                setSelectedCategory(c);
                setPage(1);
              }}
              selectedFuel={selectedFuel}
              onFuelChange={(f) => {
                setSelectedFuel(f);
                setPage(1);
              }}
              filterOptions={filterOptions}
              totalMatching={facilitiesData?.totalCount}
              isLoading={facilitiesLoading}
              hasActiveFilters={hasActiveFilters}
              onResetFilters={resetFilters}
              compareCount={compareIds.length}
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
              onToggleCompare={toggleCompareId}
              onInspect={(id) => setInspectFacilityId(id)}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
              onResetFilters={resetFilters}
            />
          </div>
        )}

        {/* Tab 2: Audit Logs */}
        {activeTab === "audit" && (
          <AuditLogsTable logs={auditLogs} isLoading={auditLoading} />
        )}
      </main>

      {/* Head-to-Head Plant Benchmarking Comparison Dialog */}
      <PlantComparisonDialog
        open={isCompareOpen}
        onOpenChange={setIsCompareOpen}
        compareIds={compareIds}
        plants={compareData}
        isLoading={compareLoading}
        onClearSelection={() => setCompareIds([])}
      />

      {/* Unit Detail Modal */}
      <FacilityDetailDialog
        open={inspectFacilityId !== null}
        onOpenChange={(open) => !open && setInspectFacilityId(null)}
        facilityId={inspectFacilityId}
        facility={selectedFacility}
        isLoading={facilityDetailLoading}
      />

      {/* CAMPD API Ingestion Live Modal */}
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
    </div>
  );
}
