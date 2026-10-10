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
  FileDown,
  Globe,
  Search,
  Scale,
  Upload,
  Zap,
} from "lucide-react";
import { Badge, SourceBadge } from "~/components/ui/badge";
import { Button, buttonClass } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { KpiStrip, StatTile } from "~/components/ui/stat-tile";
import { ThemeToggle } from "~/components/ui/theme-toggle";
import { exportUrl } from "~/lib/csv";
import {
  DEFAULT_FILTERS,
  explorerSearchParams,
  nextSort,
  type ExplorerState,
  type FilterChangeHandler,
  type AuditSortField,
  type SortField,
  type UnitSortField,
} from "~/lib/facility-filters";
import { formatNumber, formatQuantity } from "~/lib/utils";
import { api } from "~/trpc/react";
import { AuditLogsTable } from "./audit-logs-table";
import { DataCoverage } from "./data-coverage";
import { DataDownloadDialog } from "./data-download-dialog";
import { DataRetrievalDialog } from "./data-retrieval-dialog";
import { DataUploadDialog } from "./data-upload-dialog";
import { EpaPrimer } from "./epa-primer";
import { FacilitiesMap } from "./facilities-map";
import { FacilitiesTable } from "./facilities-table";
import { FacilityDetailDialog } from "./facility-detail-dialog";
import { FacilityFilterBar, type DescribeProps } from "./facility-filters";
import { PlantComparisonDialog } from "./plant-comparison-dialog";
import { UnitDetailDialog } from "./unit-detail-dialog";
import { UnitsTable } from "./units-table";

const MAX_COMPARE = 4;

/** Text-identity sort keys start ascending (severity: ERROR first); numeric metrics and dates start descending. */
const ASC_FIRST: readonly string[] = [
  "name",
  "id",
  "facility",
  "unitId",
  "state",
  "severity",
  "rule",
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
  const [compareFull, setCompareFull] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isRetrieveOpen, setIsRetrieveOpen] = useState(false);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [inspectFacilityId, setInspectFacilityId] = useState<number | null>(
    null,
  );
  const [inspectUnitId, setInspectUnitId] = useState<string | null>(null);
  const [auditTable, setAuditTable] = useState(initialState.auditTable);
  const [describeMode, setDescribeMode] = useState<"name" | "describe">(
    initialState.q ? "describe" : "name",
  );
  const [describeText, setDescribeText] = useState(initialState.q);
  const [describedQuery, setDescribedQuery] = useState(initialState.q);
  const [describeResult, setDescribeResult] =
    useState<DescribeProps["result"]>(null);
  const [isDescribing, setIsDescribing] = useState(false);

  const utils = api.useUtils();

  const explorerState = {
    tab: activeTab,
    q: describeMode === "describe" ? describedQuery : "",
    filters,
    table,
    unitTable,
    auditTable,
  };
  const explorerQuery = explorerSearchParams(explorerState);

  // §8.4: mirror tab, filters, sort, and page into the URL so views are shareable and reload-safe.
  useEffect(() => {
    window.history.replaceState(
      null,
      "",
      explorerQuery ? `?${explorerQuery}` : window.location.pathname,
    );
  }, [explorerQuery]);

  const setPage = (page: number) =>
    activeTab === "units"
      ? setUnitTable((t) => ({ ...t, page }))
      : activeTab === "audit"
        ? setAuditTable((t) => ({ ...t, page }))
        : setTable((t) => ({ ...t, page }));
  const resetPages = () => {
    setTable((t) => ({ ...t, page: 1 }));
    setUnitTable((t) => ({ ...t, page: 1 }));
    setAuditTable((t) => ({ ...t, page: 1 }));
  };
  const setFilter: FilterChangeHandler = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    resetPages();
  };
  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    resetPages();
  };

  /** Rubric §6: plain text → filters, view, and sort, applied through the same state as manual filters. */
  const runDescribe = async () => {
    const text = describeText.trim();
    if (!text) return;
    setIsDescribing(true);
    try {
      const r = await utils.facilities.describeSearch.fetch({ text });
      const tab = r.tab ?? (activeTab === "explorer" ? "explorer" : "units");
      setFilters(r.filters);
      setActiveTab(tab);
      setTable((t) => ({
        ...t,
        page: 1,
        ...(r.sort && tab === "explorer"
          ? { sortBy: "co2" as const, sortDir: r.sort.dir }
          : {}),
      }));
      setUnitTable((t) => ({
        ...t,
        page: 1,
        ...(r.sort ? { sortBy: r.sort.by, sortDir: r.sort.dir } : {}),
      }));
      setDescribeResult(r);
      setDescribedQuery(text);
    } catch (err) {
      setDescribeResult({
        unrecognized: [],
        via: "parser",
        notes: [err instanceof Error ? err.message : String(err)],
      });
    } finally {
      setIsDescribing(false);
    }
  };
  const describe: DescribeProps = {
    mode: describeMode,
    text: describeText,
    onModeChange: setDescribeMode,
    onTextChange: setDescribeText,
    onSubmit: () => void runDescribe(),
    isLoading: isDescribing,
    result: describeResult,
  };

  const handleSortChange = (field: SortField) =>
    setTable((t) => nextSort(t, field, descByDefault));
  const handleAuditSortChange = (field: AuditSortField) =>
    setAuditTable((t) => nextSort(t, field, descByDefault));
  const handleUnitSortChange = (field: UnitSortField) =>
    setUnitTable((t) => nextSort(t, field, descByDefault));

  const compareCount = compareIds.length + compareUnitIds.length;
  function toggleIn<T>(
    list: T[],
    setList: Dispatch<SetStateAction<T[]>>,
    id: T,
  ) {
    setCompareFull(false);
    if (list.includes(id)) return setList(list.filter((x) => x !== id));
    // At the limit the dock says so, instead of a blocking browser alert.
    if (compareCount >= MAX_COMPARE) return setCompareFull(true);
    setList([...list, id]);
  }
  const toggleCompare = (id: number) => toggleIn(compareIds, setCompareIds, id);
  const toggleUnitCompare = (id: string) =>
    toggleIn(compareUnitIds, setCompareUnitIds, id);
  const clearCompare = () => {
    setCompareIds([]);
    setCompareUnitIds([]);
    setCompareFull(false);
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
    { ...auditTable, ...deferredFilters },
    { enabled: activeTab === "audit", placeholderData: (prev) => prev },
  );

  // In workflow order: get data in (Retrieve, Upload), then get it out (Download).
  const headerActions = [
    {
      label: "Retrieve",
      title: "Retrieve data from the EPA CAMPD API",
      icon: CloudDownload,
      open: setIsRetrieveOpen,
    },
    {
      label: "Upload",
      title: "Upload a CSV or Excel file",
      icon: Upload,
      open: setIsUploadOpen,
    },
    {
      label: "Download",
      title: "Download data as CSV",
      icon: FileDown,
      open: setIsDownloadOpen,
    },
  ];

  const anomalyCount = stats?.totalAnomalies ?? 0;
  const lastImportedAt = Math.max(
    0,
    ...(stats?.sources ?? []).map((s) => new Date(s.lastImportedAt).getTime()),
  );
  const lastImport = lastImportedAt
    ? new Date(lastImportedAt).toLocaleDateString()
    : undefined;
  const loadingValue = (value: string | number) => (stats ? value : "...");

  return (
    <div className="bg-canvas text-fg selection:bg-surface-2 selection:text-fg min-h-screen antialiased">
      <header className="border-edge/80 bg-canvas/85 sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="border-edge bg-surface flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border">
              <Zap className="h-4 w-4 text-emerald-400" />
            </div>
            <span className="text-fg truncate text-base font-semibold tracking-tight">
              epaData
            </span>
          </div>

          <div className="flex items-center gap-2">
            {headerActions.map(({ label, title, icon: Icon, open }) => (
              <Button
                key={label}
                variant="outline"
                size="sm"
                onClick={() => open(true)}
                className="h-8 gap-1.5 px-2.5 text-xs font-medium sm:px-3 sm:text-sm"
                aria-label={title}
                title={title}
              >
                <Icon className="text-fg-muted h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </Button>
            ))}
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
            EPA Power-Sector Emissions Data
          </h1>
          <p className="text-fg-muted mt-1 max-w-3xl text-sm sm:text-base">
            epaData collects annual operating and emissions data for U.S.
            power-plant units from the EPA Clean Air Markets Program (CAMPD) and
            from validated CSV/Excel uploads, stores it in a local SQLite
            database, and lets you search, compare, and download it. TRACI
            impact factors and scoring follow in Phase 2.
          </p>
          <nav
            aria-label="Main functions"
            className="mt-3 flex flex-wrap items-center gap-2 text-xs"
          >
            {[
              ...headerActions.slice(0, 2),
              {
                label: "Search",
                title: "Search unit-years by filters or a description",
                icon: Search,
                open: () => setActiveTab("units"),
              },
              ...headerActions.slice(2),
            ].map(({ label, title, icon: Icon, open }, i) => (
              <Button
                key={label}
                variant="outline"
                size="sm"
                onClick={() => open(true)}
                title={title}
                className="h-7 gap-1.5 px-2.5 text-xs"
              >
                <span className="text-fg-muted font-mono">{i + 1}</span>
                <Icon className="text-fg-muted h-3.5 w-3.5" />
                {label}
              </Button>
            ))}
          </nav>
        </div>

        <EpaPrimer />

        <DataCoverage coverage={stats?.coverage} sources={stats?.sources} />

        <KpiStrip className="gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
          <StatTile
            variant="card"
            label="Total Facilities"
            icon={<Building2 className="text-fg-muted h-4 w-4" />}
            value={loadingValue(formatNumber(stats?.totalFacilities))}
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
            label="CO₂, all years"
            icon={<Activity className="h-4 w-4 text-emerald-400" />}
            value={loadingValue(
              stats?.totalCo2Tons
                ? `${(stats.totalCo2Tons / 1_000_000).toFixed(1)}M t`
                : "—",
            )}
            valueClassName="font-mono text-emerald-400"
            subtext="Sum of every reporting year"
          />
          <StatTile
            variant="card"
            label="Audit Flags"
            icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
            value={loadingValue(anomalyCount)}
            valueClassName="font-mono text-amber-400"
            subtext="Data-quality flags"
            className="col-span-2 sm:col-span-1"
          />
        </KpiStrip>

        {activeTab !== "map" && (
          <div className="space-y-4">
            <FacilityFilterBar
              filters={filters}
              onFilterChange={setFilter}
              onResetFilters={resetFilters}
              filterOptions={filterOptions}
              describe={activeTab === "audit" ? undefined : describe}
              actions={
                <>
                  <SourceBadge
                    kind="db"
                    detail={lastImport && `last import ${lastImport}`}
                    className="hidden md:inline-flex"
                  />
                  {activeTab !== "audit" && (
                    <a
                      href={exportUrl("search", {}, explorerQuery)}
                      download
                      className={buttonClass({
                        variant: "outline",
                        size: "sm",
                        className: "bg-surface/60 h-8",
                      })}
                      title="Download every matching row as CSV"
                    >
                      <FileDown className="text-fg-muted h-3.5 w-3.5" />
                      CSV
                    </a>
                  )}
                </>
              }
              {...(activeTab === "units"
                ? {
                    itemLabel: "unit-years",
                    totalMatching: unitsQuery.data?.totalCount,
                    isLoading: unitsQuery.isLoading,
                  }
                : activeTab === "audit"
                  ? {
                      itemLabel: "flags",
                      totalMatching: auditQuery.data?.totalCount,
                      isLoading: auditQuery.isLoading,
                    }
                  : {
                      itemLabel: "facilities",
                      totalMatching: facilitiesQuery.data?.totalCount,
                      isLoading: facilitiesQuery.isLoading,
                    })}
            />
            {activeTab === "audit" ? (
              <AuditLogsTable
                data={auditQuery.data}
                {...auditTable}
                onSortChange={handleAuditSortChange}
                isLoading={auditQuery.isLoading}
                isPlaceholderData={auditQuery.isPlaceholderData}
                onPageChange={setPage}
                onPageSizeChange={(pageSize) =>
                  setAuditTable((t) => ({ ...t, pageSize, page: 1 }))
                }
              />
            ) : activeTab === "units" ? (
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
            facilities={mapQuery.data?.facilities}
            unlocated={mapQuery.data?.unlocated}
            isLoading={mapQuery.isLoading}
            onInspectFacility={setInspectFacilityId}
            filters={filters}
            onFilterChange={setFilter}
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

      <DataDownloadDialog
        open={isDownloadOpen}
        onOpenChange={setIsDownloadOpen}
        explorer={explorerState}
        filterOptions={filterOptions}
        onFilterChange={setFilter}
        onResetFilters={resetFilters}
        compareIds={compareIds}
        compareUnitIds={compareUnitIds}
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
          {compareFull && (
            <span
              role="status"
              className="text-xs font-medium whitespace-nowrap text-amber-700 dark:text-amber-400"
            >
              Max {MAX_COMPARE}: remove one first
            </span>
          )}
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
