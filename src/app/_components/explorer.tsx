"use client";

import {
  use,
  useDeferredValue,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import Link from "next/link";
import { SourceBadge } from "~/components/ui/badge";
import { buttonClass } from "~/components/ui/button";
import { PageTitle } from "~/components/ui/page";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { exportUrl } from "~/lib/csv";
import {
  DEFAULT_FILTERS,
  explorerSearchParams,
  isFilterActive,
  nextSort,
  type ExplorerState,
  type FacilityFilters,
  type FilterChangeHandler,
  type SortDirection,
} from "~/lib/facility-filters";
import { replaceUrlQuery } from "~/lib/utils";
import { api } from "~/trpc/react";
import { SelectionContext } from "./selection-context";
import { AuditLogsTable } from "./audit-logs-table";
import { FacilitiesTable } from "./facilities-table";
import { FacilityFilterBar, type DescribeProps } from "./facility-filters";
import { UnitsTable } from "./units-table";

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

/** Whether a description set anything besides a name search. */
const setsFilters = (filters: FacilityFilters) =>
  (Object.keys(DEFAULT_FILTERS) as (keyof FacilityFilters)[]).some(
    (k) => k !== "search" && isFilterActive(filters, k),
  );

/** §9 data-explorer page: search form, filters, and the Facilities / Unit-years / Audit-flags tables. */
export function Explorer({ initialState }: { initialState: ExplorerState }) {
  const [activeTab, setActiveTab] = useState(initialState.tab);
  const [filters, setFilters] = useState(initialState.filters);
  const deferredFilters = useDeferredValue(filters);
  const [table, setTable] = useState(initialState.table);
  const [unitTable, setUnitTable] = useState(initialState.unitTable);
  const [auditTable, setAuditTable] = useState(initialState.auditTable);
  const [searchText, setSearchText] = useState(
    initialState.q || initialState.filters.search,
  );
  const [describedQuery, setDescribedQuery] = useState(initialState.q);
  const [describeResult, setDescribeResult] =
    useState<DescribeProps["result"]>(null);
  const [isDescribing, setIsDescribing] = useState(false);
  const { compareIds, compareUnitIds, toggleCompare, toggleUnitCompare } =
    use(SelectionContext);

  const utils = api.useUtils();

  const explorerState: ExplorerState = {
    tab: activeTab,
    q: describedQuery,
    filters,
    table,
    unitTable,
    auditTable,
  };
  const explorerQuery = explorerSearchParams(explorerState);

  // §8.4: mirror tab, filters, sort, and page into the URL so views are shareable and reload-safe.
  useEffect(() => replaceUrlQuery(explorerQuery), [explorerQuery]);

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
    setSearchText("");
    setDescribedQuery("");
    setDescribeResult(null);
    resetPages();
  };

  /**
   * Rubric §6: plain text → filters, view, and sort, applied through the same state as manual
   * filters. Text with nothing the parser recognizes (a plant name) becomes a name search instead.
   */
  const runSearch = async () => {
    const text = searchText.trim();
    if (!text) return setFilter("search", "");
    setIsDescribing(true);
    try {
      const r = await utils.facilities.describeSearch.fetch({ text });
      if (!setsFilters(r.filters) && !r.filters.search && !r.sort && !r.tab) {
        setFilter("search", text);
        setDescribedQuery("");
        setDescribeResult(null);
        return;
      }
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
    text: searchText,
    onTextChange: setSearchText,
    onSubmit: () => void runSearch(),
    isLoading: isDescribing,
    result: describeResult,
  };

  const showRank = filters.topN !== "ALL";

  const { data: stats } = api.facilities.getStats.useQuery();
  const { data: filterOptions } = api.facilities.getFilterOptions.useQuery();
  const facilitiesQuery = api.facilities.getFacilities.useQuery(
    { ...table, ...deferredFilters },
    { enabled: activeTab === "explorer", placeholderData: (prev) => prev },
  );
  const unitsQuery = api.facilities.getUnitYears.useQuery(
    { ...unitTable, ...deferredFilters },
    { enabled: activeTab === "units", placeholderData: (prev) => prev },
  );
  const auditQuery = api.facilities.getAuditLogs.useQuery(
    { ...auditTable, ...deferredFilters },
    { enabled: activeTab === "audit", placeholderData: (prev) => prev },
  );

  const lastImportedAt = Math.max(
    0,
    ...(stats?.sources ?? []).map((s) => new Date(s.lastImportedAt).getTime()),
  );
  const lastImport = lastImportedAt
    ? new Date(lastImportedAt).toLocaleDateString()
    : undefined;

  /** A tab's table props: sort and page state with their handlers, and the query's status. */
  const tableProps = <
    T extends { page: number; pageSize: number; sortDir: SortDirection } & {
      sortBy: F;
    },
    F extends string,
  >(
    t: T,
    setT: Dispatch<SetStateAction<T>>,
    q: { isLoading: boolean; isPlaceholderData: boolean },
  ) => ({
    sortBy: t.sortBy,
    sortDir: t.sortDir,
    onSortChange: (field: F) => setT((s) => nextSort(s, field, descByDefault)),
    paging: {
      page: t.page,
      pageSize: t.pageSize,
      isLoading: q.isLoading,
      isPlaceholderData: q.isPlaceholderData,
      onPageChange: (page: number) => setT((s) => ({ ...s, page })),
      onPageSizeChange: (pageSize: number) =>
        setT((s) => ({ ...s, pageSize, page: 1 })),
    },
  });

  const [itemLabel, activeQuery] =
    activeTab === "units"
      ? (["unit-years", unitsQuery] as const)
      : activeTab === "audit"
        ? (["flags", auditQuery] as const)
        : (["facilities", facilitiesQuery] as const);

  return (
    <div className="space-y-6">
      <PageTitle lead="Search the local database by description, name, or any combination of fields. Click a row for its details; tick rows to compare them.">
        Explore
      </PageTitle>

      <SegmentedControl
        variant="tabs"
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: "explorer", label: "Facilities" },
          { value: "units", label: "Unit-years" },
          {
            value: "audit",
            label: (
              <>
                Audit flags
                {stats?.totalAnomalies ? (
                  <span className="text-fg-muted font-normal tabular-nums">
                    {stats.totalAnomalies.toLocaleString()}
                  </span>
                ) : null}
              </>
            ),
          },
        ]}
      />

      <FacilityFilterBar
        filters={filters}
        onFilterChange={setFilter}
        onResetFilters={resetFilters}
        filterOptions={filterOptions}
        describe={activeTab === "audit" ? undefined : describe}
        itemLabel={itemLabel}
        totalMatching={activeQuery.data?.totalCount}
        isLoading={activeQuery.isLoading}
        actions={
          <>
            <SourceBadge
              kind="db"
              detail={lastImport && `last import ${lastImport}`}
              className="hidden md:inline-flex"
            />
            {activeTab !== "audit" && (
              <>
                <a
                  href={exportUrl("search", {}, explorerQuery)}
                  download
                  className={buttonClass({ variant: "outline", size: "sm" })}
                  title="Download every matching row as CSV"
                >
                  Download CSV
                </a>
                <Link
                  href={`/download?${explorerQuery}`}
                  className={buttonClass({ variant: "ghost", size: "sm" })}
                >
                  More options
                </Link>
              </>
            )}
          </>
        }
      />

      {activeTab === "audit" ? (
        <AuditLogsTable
          data={auditQuery.data}
          {...tableProps(auditTable, setAuditTable, auditQuery)}
        />
      ) : activeTab === "units" ? (
        <UnitsTable
          data={unitsQuery.data}
          {...tableProps(unitTable, setUnitTable, unitsQuery)}
          showRank={showRank}
          compareUnitIds={compareUnitIds}
          onToggleCompare={toggleUnitCompare}
          onResetFilters={resetFilters}
        />
      ) : (
        <FacilitiesTable
          data={facilitiesQuery.data}
          {...tableProps(table, setTable, facilitiesQuery)}
          showRank={showRank}
          year={filters.year}
          compareIds={compareIds}
          onToggleCompare={toggleCompare}
          onResetFilters={resetFilters}
        />
      )}
    </div>
  );
}
