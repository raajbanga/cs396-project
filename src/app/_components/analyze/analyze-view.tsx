"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { SourceBadge } from "~/components/ui/badge";
import { Button, buttonClass } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { PageTitle } from "~/components/ui/page";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  analysisSearchParams,
  DEFAULT_ANALYSIS_FILTERS,
  DEFAULT_VIEW,
  type AnalysisView,
  type parseAnalysisParams,
} from "~/lib/analysis-state";
import { exportUrl } from "~/lib/csv";
import { ExportContext } from "~/components/ui/export-button";
import { analyzeMetadata } from "~/lib/export-bundle";
import {
  applyDescribed,
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
  // A search that names no years keeps the default 2015–2025 range.
  const { describe, reset: resetDescribe } = useDescribeSearch({
    initialText: initial.filters.search,
    onNameSearch: (text) => setFilter("search", text),
    onApply: (r) =>
      setFilters(
        applyDescribed(DEFAULT_ANALYSIS_FILTERS, r.filters, {
          yearRange: true,
        }),
      ),
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
  // A reversed range matches nothing; say why instead of drawing empty charts.
  const reversed =
    Boolean(filters.yearMin && filters.yearMax) &&
    Number(filters.yearMin) > Number(filters.yearMax);
  const empty = reversed || summary.data?.records === 0;
  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    resetDescribe();
  };

  return (
    <ExportContext
      value={analyzeMetadata(source, Object.fromEntries(filterQuery), view)}
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
          onResetFilters={clearFilters}
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
                aria-disabled={empty}
                onClick={(e) => empty && e.preventDefault()}
                href={exportUrl(
                  "analysis",
                  {},
                  filterQuery.toString() || "yearMin=",
                )}
                download
                className={buttonClass({
                  variant: "outline",
                  size: "sm",
                  className: empty ? "pointer-events-none opacity-50" : "",
                })}
                title="Every selected unit-year with all variables, as CSV in a ZIP with metadata.json"
              >
                Download all
              </a>
            </>
          }
        />

        {empty ? (
          <EmptyState
            className="border-edge rounded-lg border border-dashed"
            title={
              reversed
                ? `The year range runs backwards (${filters.yearMin} to ${filters.yearMax})`
                : "No unit-years match these filters"
            }
            description={
              reversed
                ? "Swap the years to analyze that period, or clear the filters."
                : "Remove a filter, or clear them all to start from every unit-year."
            }
            action={
              <div className="flex justify-center gap-2">
                {reversed && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setFilters({
                        ...filters,
                        yearMin: filters.yearMax,
                        yearMax: filters.yearMin,
                      })
                    }
                  >
                    Swap years
                  </Button>
                )}
                <Button size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            }
          />
        ) : (
          <Tab
            filters={deferredFilters}
            view={view}
            setView={setView}
            catalog={catalog}
            summary={summary.data}
          />
        )}
      </div>
    </ExportContext>
  );
}
