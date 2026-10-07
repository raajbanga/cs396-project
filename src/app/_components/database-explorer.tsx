"use client";

import {
  useDeferredValue,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  Activity,
  AlertTriangle,
  Building2,
  CloudDownload,
  Globe,
  Scale,
  Upload,
  Zap,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { KpiStrip, StatTile } from "~/components/ui/stat-tile";
import { ThemeToggle } from "~/components/ui/theme-toggle";
import {
  DEFAULT_FILTERS,
  explorerSearchParams,
  nextSort,
  type ExplorerState,
  type FilterChangeHandler,
  type SortField,
  type UnitSortField,
} from "~/lib/facility-filters";
import { formatQuantity } from "~/lib/utils";
import { api } from "~/trpc/react";
import { AuditLogsTable } from "./audit-logs-table";
import { DataCoverage } from "./data-coverage";
import { DataRetrievalDialog } from "./data-retrieval-dialog";
import { DataUploadDialog } from "./data-upload-dialog";
import { EpaPrimer } from "./epa-primer";
import { FacilitiesMap } from "./facilities-map";
import { FacilitiesTable } from "./facilities-table";
import { FacilityDetailDialog } from "./facility-detail-dialog";
import { FacilityFilterBar } from "./facility-filters";
import { PlantComparisonDialog } from "./plant-comparison-dialog";
import { UnitDetailDialog } from "./unit-detail-dialog";
import { UnitsTable } from "./units-table";

const MAX_COMPARE = 4;

/** Text-identity sort keys start ascending; numeric metrics start descending (highest first). */
const ASC_FIRST: readonly string[] = [
  "name",
  "id",
  "facility",
  "unitId",
  "state",
];
const descByDefault = (field: string) => !ASC_FIRST.includes(field);

export function DatabaseExplorer({
  initialState,
}: {
  initialState: ExplorerState;
}) {
  const [activeTab, setActiveTab] = useState(initialState.tab);
  const [filters, setFilters] = useState(initialState.filters);
  const deferredFilters = useDeferredValue(filters);
  const [table, setTable] = useState(initialState.table);
  const [unitTable, setUnitTable] = useState(initialState.unitTable);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [compareUnitIds, setCompareUnitIds] = useState<string[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isRetrieveOpen, setIsRetrieveOpen] = useState(false);
  const [inspectFacilityId, setInspectFacilityId] = useState<number | null>(
    null,
  );
  const [inspectUnitId, setInspectUnitId] = useState<string | null>(null);

  const utils = api.useUtils();

  // §8.4: mirror tab, filters, sort, and page into the URL so views are shareable and reload-safe.
  useEffect(() => {
    const qs = explorerSearchParams({
      tab: activeTab,
      filters,
      table,
      unitTable,
    });
    window.history.replaceState(
      null,
      "",
      qs ? `?${qs}` : window.location.pathname,
    );
  }, [activeTab, filters, table, unitTable]);

  const setPage = (page: number) =>
    activeTab === "units"
      ? setUnitTable((t) => ({ ...t, page }))
      : setTable((t) => ({ ...t, page }));
  const resetPages = () => {
    setTable((t) => ({ ...t, page: 1 }));
    setUnitTable((t) => ({ ...t, page: 1 }));
  };
  const setFilter: FilterChangeHandler = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    resetPages();
  };
  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    resetPages();
  };
  const handleSortChange = (field: SortField) =>
    setTable((t) => nextSort(t, field, descByDefault));
  const handleUnitSortChange = (field: UnitSortField) =>
    setUnitTable((t) => nextSort(t, field, descByDefault));

  const compareCount = compareIds.length + compareUnitIds.length;
  function toggleIn<T>(
    list: T[],
    setList: Dispatch<SetStateAction<T[]>>,
    id: T,
  ) {
    if (list.includes(id)) return setList(list.filter((x) => x !== id));
    if (compareCount >= MAX_COMPARE) {
      return alert(
        `Maximum of ${MAX_COMPARE} facilities or units can be compared simultaneously.`,
      );
    }
    setList([...list, id]);
  }
  const toggleCompare = (id: number) => toggleIn(compareIds, setCompareIds, id);
  const toggleUnitCompare = (id: string) =>
    toggleIn(compareUnitIds, setCompareUnitIds, id);
  const clearCompare = () => {
    setCompareIds([]);
    setCompareUnitIds([]);
  };
  const canCompare = compareCount >= 2;
  const showRank = filters.topN !== "ALL";

  const { data: stats } = api.facilities.getStats.useQuery(undefined, {
    staleTime: 0,
    refetchOnMount: "always",
  });
  const { data: filterOptions } = api.facilities.getFilterOptions.useQuery();
  const facilitiesQuery = api.facilities.getFacilities.useQuery(
    { ...table, ...deferredFilters },
    { enabled: activeTab === "explorer", placeholderData: (prev) => prev },
  );
  const unitsQuery = api.facilities.getUnitYears.useQuery(
    { ...unitTable, ...deferredFilters },
    { enabled: activeTab === "units", placeholderData: (prev) => prev },
  );
  const mapQuery = api.facilities.getMapFacilities.useQuery(deferredFilters, {
    enabled: activeTab === "map",
    placeholderData: (prev) => prev,
  });
  const detailQuery = api.facilities.getFacility.useQuery(
    { id: inspectFacilityId! },
    { enabled: inspectFacilityId !== null },
  );
  const unitDetailQuery = api.facilities.getUnit.useQuery(
    { id: inspectUnitId! },
    { enabled: inspectUnitId !== null },
  );
  const compareQuery = api.facilities.compareFacilities.useQuery(
    { ids: compareIds, unitIds: compareUnitIds },
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRetrieveOpen(true)}
              className="h-8 gap-1.5 px-2.5 text-xs font-medium sm:px-3 sm:text-sm"
              aria-label="Retrieve data from EPA CAMPD"
            >
              <CloudDownload className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Retrieve</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsUploadOpen(true)}
              className="h-8 gap-1.5 px-2.5 text-xs font-medium sm:px-3 sm:text-sm"
              aria-label="Upload data file"
            >
              <Upload className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Upload Data</span>
              <span className="sm:hidden">Upload</span>
            </Button>
            <SegmentedControl
              value={activeTab}
              onChange={setActiveTab}
              className="rounded-lg"
              options={[
                { value: "explorer", label: "Facilities" },
                { value: "units", label: "Units" },
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

        <DataCoverage coverage={stats?.coverage} sources={stats?.sources} />

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

        {(activeTab === "explorer" || activeTab === "units") && (
          <div className="space-y-4">
            <FacilityFilterBar
              filters={filters}
              onFilterChange={setFilter}
              onResetFilters={resetFilters}
              filterOptions={filterOptions}
              {...(activeTab === "units"
                ? {
                    itemLabel: "unit-years",
                    totalMatching: unitsQuery.data?.totalCount,
                    isLoading: unitsQuery.isLoading,
                  }
                : {
                    itemLabel: "facilities",
                    totalMatching: facilitiesQuery.data?.totalCount,
                    isLoading: facilitiesQuery.isLoading,
                  })}
            />
            {activeTab === "units" ? (
              <UnitsTable
                data={unitsQuery.data}
                {...unitTable}
                showRank={showRank}
                isLoading={unitsQuery.isLoading}
                isPlaceholderData={unitsQuery.isPlaceholderData}
                onSortChange={handleUnitSortChange}
                compareUnitIds={compareUnitIds}
                onToggleCompare={toggleUnitCompare}
                onInspect={setInspectUnitId}
                onPageChange={setPage}
                onPageSizeChange={(pageSize) =>
                  setUnitTable((t) => ({ ...t, pageSize, page: 1 }))
                }
                onResetFilters={resetFilters}
              />
            ) : (
              <FacilitiesTable
                data={facilitiesQuery.data}
                {...table}
                showRank={showRank}
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
            )}
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
        onClearSelection={clearCompare}
        onRemovePlant={(p) =>
          p.unitInternalId
            ? toggleUnitCompare(p.unitInternalId)
            : toggleCompare(p.id)
        }
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

      <UnitDetailDialog
        onClose={() => setInspectUnitId(null)}
        unitInternalId={inspectUnitId}
        unit={unitDetailQuery.data}
        isLoading={unitDetailQuery.isLoading}
        onInspectFacility={(id) => {
          setInspectUnitId(null);
          setInspectFacilityId(id);
        }}
        onToggleCompare={toggleUnitCompare}
        isInCompare={
          inspectUnitId !== null && compareUnitIds.includes(inspectUnitId)
        }
      />

      <DataUploadDialog
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        onImported={() => void utils.facilities.invalidate()}
      />

      <DataRetrievalDialog
        open={isRetrieveOpen}
        onOpenChange={setIsRetrieveOpen}
        onImported={() => void utils.facilities.invalidate()}
      />

      {compareCount > 0 && (
        <aside
          aria-label="Plant benchmark comparison dock"
          className="animate-in fade-in slide-in-from-bottom-4 border-edge bg-surface/95 fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-2.5 rounded-full border px-3 py-1.5 shadow-2xl backdrop-blur-md duration-200 select-none sm:bottom-6 sm:gap-3 sm:px-4 sm:py-2"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            {compareCount}
          </span>
          <span className="text-fg-2 text-xs font-medium whitespace-nowrap sm:text-sm">
            {[
              compareIds.length &&
                `${compareIds.length} ${compareIds.length === 1 ? "plant" : "plants"}`,
              compareUnitIds.length &&
                `${compareUnitIds.length} ${compareUnitIds.length === 1 ? "unit" : "units"}`,
            ]
              .filter(Boolean)
              .join(" · ")}
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
            onClick={clearCompare}
            className="h-7 px-1.5"
          >
            Clear
          </Button>
        </aside>
      )}
    </div>
  );
}
