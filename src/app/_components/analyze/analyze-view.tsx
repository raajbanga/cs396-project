"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { SourceBadge } from "~/components/ui/badge";
import { buttonClass } from "~/components/ui/button";
import { PageTitle } from "~/components/ui/page";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  analysisSearchParams,
  DEFAULT_VIEW,
  type AnalysisView,
  type parseAnalysisParams,
} from "~/lib/analysis-state";
import { exportUrl } from "~/lib/csv";
import { ExportContext } from "~/components/ui/export-button";
import {
  DEFAULT_FILTERS,
  filterSearchParams,
  type FilterChangeHandler,
} from "~/lib/facility-filters";
import { replaceUrlQuery } from "~/lib/utils";
import { api } from "~/trpc/react";
import { FacilityFilterBar, useDescribeSearch } from "../facility-filters";
import { CompareTab } from "./compare-tab";
import { DistributionTab } from "./distribution-tab";
import { ImpactsTab } from "./impacts-tab";
import { OverviewTab } from "./overview-tab";
import { RelationshipsTab } from "./relationships-tab";

/** One tab per question, in the order an analysis usually goes. */
const TABS = {
  overview: { label: "Overview", Tab: OverviewTab },
  distribution: { label: "Distribution", Tab: DistributionTab },
  relationships: { label: "Relationships", Tab: RelationshipsTab },
  compare: { label: "Compare groups", Tab: CompareTab },
  impacts: { label: "TRACI impacts", Tab: ImpactsTab },
};

/**
 * Phase 2 Analyze page: the Explore filters define the analytical dataset (§4.1); each tab answers
 * one question about it. Filters and every tab choice live in the URL.
 */
export function AnalyzeView({
  initial,
}: {
  initial: ReturnType<typeof parseAnalysisParams>;
}) {
  const [filters, setFilters] = useState(initial.filters);
  const [view, setViewState] = useState(initial.view);
  const deferredFilters = useDeferredValue(filters);
  const query = analysisSearchParams(filters, view);
  useEffect(() => replaceUrlQuery(query), [query]);

  const setView = (patch: Partial<AnalysisView>) =>
    setViewState((v) => ({ ...v, ...patch }));
  const setFilter: FilterChangeHandler = (key, value) =>
    setFilters((f) => ({ ...f, [key]: value }));
  // The explorer's description search; analyses use its filters (sort and view don't apply).
  const { describe, reset: resetDescribe } = useDescribeSearch({
    initialText: initial.filters.search,
    onNameSearch: (text) => setFilter("search", text),
    onApply: (r) => setFilters(r.filters),
  });

  const [catalog] = api.analysis.catalog.useSuspenseQuery();
  // A hand-edited link with an unknown variable falls back to the default instead of an error.
  const known = (key: string) => catalog.variables.some((v) => v.key === key);
  const unknown = (["variable", "x", "y"] as const).filter(
    (k) => !known(view[k]),
  );
  useEffect(() => {
    if (unknown.length)
      setViewState((v) => ({
        ...v,
        ...Object.fromEntries(unknown.map((k) => [k, DEFAULT_VIEW[k]])),
      }));
  }, [unknown.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data: filterOptions } = api.facilities.getFilterOptions.useQuery();
  const { data: source } = api.analysis.provenance.useQuery();
  const filterQuery = filterSearchParams(deferredFilters);
  const summary = api.analysis.summary.useQuery(
    { filters: deferredFilters },
    { placeholderData: (prev) => prev },
  );
  const { Tab } = TABS[view.tab];
  if (unknown.length) return null;

  return (
    <ExportContext
      value={{
        page: "Analyze",
        ...source,
        filters: Object.fromEntries(filterQuery),
        view,
      }}
    >
      <div className="space-y-6">
        <PageTitle lead="Pick unit-years with the filters; each tab answers one question about them. Every view can be shared by its URL.">
          Analyze
        </PageTitle>

        <SegmentedControl
          variant="tabs"
          value={view.tab}
          onChange={(tab) => setView({ tab })}
          options={Object.entries(TABS).map(([value, { label }]) => ({
            value: value as AnalysisView["tab"],
            label,
          }))}
        />

        <FacilityFilterBar
          filters={filters}
          onFilterChange={setFilter}
          onResetFilters={() => {
            setFilters(DEFAULT_FILTERS);
            resetDescribe();
          }}
          describe={describe}
          filterOptions={filterOptions}
          itemLabel="unit-years"
          analysis
          totalMatching={summary.data?.records}
          isLoading={summary.isLoading}
          actions={
            <>
              <SourceBadge kind="db" className="hidden md:inline-flex" />
              <a
                href={exportUrl(
                  "analysis",
                  {},
                  filterQuery.toString() || "yearMin=",
                )}
                download
                className={buttonClass({ variant: "outline", size: "sm" })}
                title="Every selected unit-year with all variables, as CSV in a ZIP with metadata.json"
              >
                Download dataset
              </a>
            </>
          }
        />

        <Tab
          filters={deferredFilters}
          view={view}
          setView={setView}
          catalog={catalog}
          summary={summary.data}
        />
      </div>
    </ExportContext>
  );
}
