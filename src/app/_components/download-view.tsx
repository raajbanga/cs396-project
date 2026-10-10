"use client";

import { use, useDeferredValue, useEffect, useState } from "react";
import { Button, buttonClass } from "~/components/ui/button";
import { EmptyState, InlineLoading } from "~/components/ui/empty-state";
import { PageTitle, PageView } from "~/components/ui/page";
import { Section } from "~/components/ui/report";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Select } from "~/components/ui/select";
import { TryExamples } from "~/components/ui/try-examples";
import { exportUrl, type ExportType } from "~/lib/csv";
import {
  DEFAULT_FILTERS,
  explorerSearchParams,
  type ExplorerState,
  type FilterChangeHandler,
} from "~/lib/facility-filters";
import { cn, datasetStatus, replaceUrlQuery, sourceLabel } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";
import { SelectionContext, selectionLabel } from "./selection-context";
import { datasetParams } from "./dataset-history";
import { FacilityFilterBar } from "./facility-filters";

type DatasetRow = RouterOutputs["facilities"]["getDatasets"][number];

const TYPES: { value: ExportType; label: string; description: string }[] = [
  {
    value: "dataset",
    label: "Dataset",
    description:
      "Every unit-year record a dataset currently holds, with its audit flags.",
  },
  {
    value: "valid",
    label: "Valid records",
    description:
      "A dataset's records that passed every physical-sanity rule (records with audit flags are left out).",
  },
  {
    value: "invalid",
    label: "Invalid records",
    description:
      "Data-quality report: rows an upload rejected or skipped as duplicates (with the original columns), plus records the physical-sanity rules flagged as questionable.",
  },
  {
    value: "search",
    label: "Search results",
    description:
      "All rows matching the explorer filters, in the table's sort order (not just the current page).",
  },
  {
    value: "selection",
    label: "Selection",
    description:
      "Every reporting year of the facilities and units picked for comparison.",
  },
  {
    value: "provenance",
    label: "Provenance",
    description:
      "Where each dataset came from: source, retrieval parameters or file name, import date, counts, and status.",
  },
];

const DATASET_TYPES: readonly ExportType[] = [
  "dataset",
  "valid",
  "invalid",
  "provenance",
];

const datasetLabel = (d: DatasetRow) =>
  `${d.reportingYear} · ${sourceLabel(d.source)} · ${datasetParams(d)} · ${datasetStatus(d)} · ${d.importedAt.toLocaleDateString()}`;

/**
 * §9 / §10 download page: what to export (dataset, search results, selection, reports,
 * provenance), the dataset or filters, and the file format. Filters arrive in the URL from
 * Explore's "More options" link, so search results download exactly what Explore showed.
 */
export function DownloadView({
  initialState,
}: {
  initialState: ExplorerState;
}) {
  const [type, setType] = useState<ExportType>(
    explorerSearchParams(initialState) ? "search" : "dataset",
  );
  const [datasetId, setDatasetId] = useState("");
  const [view, setView] = useState<"explorer" | "units">(
    initialState.tab === "units" ? "units" : "explorer",
  );
  const [filters, setFilters] = useState(initialState.filters);
  const [table, setTable] = useState(initialState.table);
  const explorer: ExplorerState = {
    ...initialState,
    filters,
    table,
    tab: view,
  };
  const deferredFilters = useDeferredValue(filters);
  const { compareIds, compareUnitIds } = use(SelectionContext);
  const { data: filterOptions } = api.facilities.getFilterOptions.useQuery();
  const onFilterChange: FilterChangeHandler = (key, value) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const onResetFilters = () => setFilters(DEFAULT_FILTERS);

  const query = explorerSearchParams(explorer);
  useEffect(() => replaceUrlQuery(query), [query]);

  const historyQuery = api.facilities.getDatasets.useQuery(
    { limit: 200 },
    { enabled: DATASET_TYPES.includes(type) },
  );
  const isSearch = type === "search";
  const facilitiesQuery = api.facilities.getFacilities.useQuery(
    { ...explorer.table, ...deferredFilters },
    { enabled: isSearch && view === "explorer" },
  );
  const unitsQuery = api.facilities.getUnitYears.useQuery(
    { ...explorer.unitTable, ...deferredFilters },
    { enabled: isSearch && view === "units" },
  );

  const datasets = historyQuery.data ?? [];
  const datasetOptions = [
    ...(type === "provenance" ? [{ value: "ALL", label: "All datasets" }] : []),
    ...datasets.map((d) => ({ value: d.id, label: datasetLabel(d) })),
  ];
  const selectedDataset =
    datasetOptions.find((o) => o.value === datasetId)?.value ??
    datasetOptions[0]?.value;
  const selectionCount = compareIds.length + compareUnitIds.length;

  const url = (() => {
    switch (type) {
      case "search":
        return exportUrl("search", {}, query);
      case "selection":
        return selectionCount
          ? exportUrl("selection", {
              ids: compareIds.join(","),
              unitIds: compareUnitIds.join(","),
            })
          : null;
      case "provenance":
        return exportUrl("provenance", {
          id: selectedDataset === "ALL" ? undefined : selectedDataset,
        });
      default:
        return selectedDataset
          ? exportUrl(type, { id: selectedDataset })
          : null;
    }
  })();

  return (
    <PageView
      header={
        <PageTitle lead="Export data from the local database as CSV: whole datasets, search results, your comparison selection, data-quality reports, or provenance.">
          Download data
        </PageTitle>
      }
      footer={
        url ? (
          <a href={url} download className={buttonClass()}>
            Download CSV
          </a>
        ) : (
          <Button disabled>Download CSV</Button>
        )
      }
    >
      <TryExamples
        examples={[
          {
            label: "Kentucky coal unit-years in 2025 with CO₂ ≥ 500,000 t",
            onSelect: () => {
              setType("search");
              setView("units");
              setFilters({
                ...DEFAULT_FILTERS,
                stateCode: "KY",
                primaryFuel: "Coal",
                year: "2025",
                co2MassTonsMin: "500000",
              });
            },
          },
          {
            label: "the top CO₂ facility in each state, 2024",
            onSelect: () => {
              setType("search");
              setView("explorer");
              setFilters({
                ...DEFAULT_FILTERS,
                year: "2024",
                topN: "1",
                rankGroup: "state",
              });
              setTable((t) => ({ ...t, sortBy: "co2", sortDir: "desc" }));
            },
          },
          {
            label: "the invalid-records report of the latest dataset",
            onSelect: () => {
              setType("invalid");
              setDatasetId("");
            },
          },
          {
            label: "provenance of every dataset",
            onSelect: () => {
              setType("provenance");
              setDatasetId("ALL");
            },
          },
        ]}
      />

      <Section title="1. What to download">
        <div
          role="radiogroup"
          aria-label="What to download"
          className="border-edge bg-surface divide-edge/70 divide-y rounded-md border"
        >
          {TYPES.map((t) => (
            <label
              key={t.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 px-3 py-2.5",
                type === t.value && "bg-primary/[0.05]",
              )}
            >
              <input
                type="radio"
                name="export-type"
                value={t.value}
                checked={type === t.value}
                onChange={() => setType(t.value)}
                className="accent-primary mt-1"
              />
              <span>
                <span className="text-fg block text-sm font-medium">
                  {t.label}
                </span>
                <span className="text-fg-muted block text-xs">
                  {t.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </Section>

      {DATASET_TYPES.includes(type) && (
        <Section title="2. Dataset">
          {historyQuery.isLoading ? (
            <InlineLoading className="py-6" title="Loading datasets…" />
          ) : datasetOptions.length === 0 ? (
            <EmptyState title="No datasets yet" />
          ) : (
            <Select
              size="drawer"
              value={selectedDataset ?? ""}
              onValueChange={setDatasetId}
              options={datasetOptions}
            />
          )}
        </Section>
      )}

      {type === "search" && (
        <Section
          title="2. Filters"
          note="The same filters as Explore. Opened from Explore's “More options”, they start as Explore's current search."
        >
          <SegmentedControl
            value={view}
            onChange={setView}
            options={[
              { value: "explorer", label: "Facilities" },
              { value: "units", label: "Unit-years" },
            ]}
            className="w-fit"
          />
          <FacilityFilterBar
            filters={filters}
            filterOptions={filterOptions}
            onFilterChange={onFilterChange}
            onResetFilters={onResetFilters}
            {...(view === "units"
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
        </Section>
      )}

      {type === "selection" &&
        (selectionCount ? (
          <Section title="2. Selection">
            <p className="text-fg-2 text-sm">
              {selectionLabel(compareIds, compareUnitIds)}
              {compareIds.length > 0 &&
                ` (facility IDs ${compareIds.join(", ")})`}
            </p>
          </Section>
        ) : (
          <EmptyState
            title="Nothing selected"
            description="Tick facilities or units in Explore (the checkbox column), then come back here."
          />
        ))}

      <Section title="3. File format">
        <Select
          size="drawer"
          value="csv"
          onValueChange={() => undefined}
          options={[{ value: "csv", label: "CSV (comma-separated, UTF-8)" }]}
          className="sm:w-72"
        />
      </Section>
    </PageView>
  );
}
