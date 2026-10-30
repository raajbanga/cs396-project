"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { SourceBadge } from "~/components/ui/badge";
import { buttonClass } from "~/components/ui/button";
import { PageTitle } from "~/components/ui/page";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  analysisSearchParams,
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
import { FacilityFilterBar } from "../facility-filters";
import { ChartsTab } from "./charts-tab";
import { CompareTab } from "./compare-tab";
import { DatasetTab } from "./dataset-tab";
import { ImpactsTab } from "./impacts-tab";
import { StatisticsTab } from "./statistics-tab";

const TABS = {
  dataset: { label: "Dataset", Tab: DatasetTab },
  statistics: { label: "Statistics", Tab: StatisticsTab },
  charts: { label: "Charts", Tab: ChartsTab },
  compare: { label: "Compare", Tab: CompareTab },
  impacts: { label: "Impacts", Tab: ImpactsTab },
};

/**
 * Phase 2 Analyze page: the Explore filters define the analytical dataset (§4.1); the tabs
 * summarize, chart, compare, and assess it. Filters and every tab choice live in the URL.
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

  const [catalog] = api.analysis.catalog.useSuspenseQuery();
  const { data: filterOptions } = api.facilities.getFilterOptions.useQuery();
  const { data: source } = api.analysis.provenance.useQuery();
  const filterQuery = filterSearchParams(deferredFilters);
  const summary = api.analysis.summary.useQuery(
    { filters: deferredFilters },
    { placeholderData: (prev) => prev },
  );
  const { Tab } = TABS[view.tab];

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
        <PageTitle lead="Choose unit-years with the filters, then summarize, chart, and compare them, or convert their emissions into TRACI impact indicators. Every view follows the same selection and can be shared by its URL.">
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
          onResetFilters={() => setFilters(DEFAULT_FILTERS)}
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
