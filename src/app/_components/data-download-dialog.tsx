"use client";

import { useDeferredValue, useState } from "react";
import { FileDown } from "lucide-react";
import { SourceBadge } from "~/components/ui/badge";
import { Button, buttonClass } from "~/components/ui/button";
import { Dialog, DialogTitle } from "~/components/ui/dialog";
import { EmptyState, InlineLoading } from "~/components/ui/empty-state";
import { Section } from "~/components/ui/report";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Select } from "~/components/ui/select";
import { exportUrl, type ExportType } from "~/lib/csv";
import {
  explorerSearchParams,
  type ExplorerState,
  type FilterChangeHandler,
} from "~/lib/facility-filters";
import { datasetStatus, formatQuantity, sourceLabel } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";
import { datasetParams } from "./data-retrieval-dialog";
import { FacilityFilterBar } from "./facility-filters";

type FilterOptions = RouterOutputs["facilities"]["getFilterOptions"];
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

/** §10 download page: what to export, dataset or filters, and the file format. */
export function DataDownloadDialog({
  open,
  onOpenChange,
  explorer,
  filterOptions,
  onFilterChange,
  onResetFilters,
  compareIds,
  compareUnitIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  explorer: ExplorerState;
  filterOptions?: FilterOptions;
  onFilterChange: FilterChangeHandler;
  onResetFilters: () => void;
  compareIds: number[];
  compareUnitIds: string[];
}) {
  const [type, setType] = useState<ExportType>("dataset");
  const [datasetId, setDatasetId] = useState("");
  const [view, setView] = useState<"explorer" | "units">(
    explorer.tab === "units" ? "units" : "explorer",
  );
  const deferredFilters = useDeferredValue(explorer.filters);

  const historyQuery = api.facilities.getDatasets.useQuery(
    { limit: 200 },
    { enabled: open && DATASET_TYPES.includes(type) },
  );
  const isSearch = open && type === "search";
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
        return exportUrl(
          "search",
          {},
          explorerSearchParams({ ...explorer, tab: view }),
        );
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
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="compare"
      closeLabel="Close"
      header={
        <div className="space-y-1.5">
          <span className="flex items-center gap-1 font-mono text-xs font-semibold text-emerald-400">
            <FileDown className="h-3.5 w-3.5" />
            Data Download
          </span>
          <DialogTitle>Download Data</DialogTitle>
          <SourceBadge kind="db" />
          <p className="text-fg-muted text-xs sm:text-sm">
            Export datasets, search results, your comparison selection,
            data-quality reports, or provenance as CSV.
          </p>
        </div>
      }
      footer={
        url ? (
          <a
            href={url}
            download
            className={buttonClass({ size: "sm" })}
            aria-label="Download CSV"
          >
            <FileDown className="h-3.5 w-3.5" />
            Download CSV
          </a>
        ) : (
          <Button size="sm" disabled>
            <FileDown className="h-3.5 w-3.5" />
            Download CSV
          </Button>
        )
      }
    >
      <Section
        title="Data"
        note={TYPES.find((t) => t.value === type)?.description}
      >
        <SegmentedControl
          value={type}
          onChange={setType}
          options={TYPES}
          className="w-fit flex-wrap"
        />
      </Section>

      {DATASET_TYPES.includes(type) && (
        <Section title="Dataset">
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
          title="Filters"
          note="These are the explorer's filters; changing them here changes the explorer too."
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
            filters={explorer.filters}
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
          <Section title="Selection">
            <p className="text-fg-2 text-sm">
              {[
                compareIds.length &&
                  `${formatQuantity(compareIds.length)} ${compareIds.length === 1 ? "facility" : "facilities"} (${compareIds.join(", ")})`,
                compareUnitIds.length &&
                  `${formatQuantity(compareUnitIds.length)} ${compareUnitIds.length === 1 ? "unit" : "units"}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </Section>
        ) : (
          <EmptyState
            title="Nothing selected"
            description="Tick the compare checkbox on facilities or units in the explorer, then come back here."
          />
        ))}

      <Section title="Format">
        <Select
          size="drawer"
          value="csv"
          onValueChange={() => undefined}
          options={[{ value: "csv", label: "CSV (comma-separated, UTF-8)" }]}
          className="sm:w-72"
        />
      </Section>
    </Dialog>
  );
}
