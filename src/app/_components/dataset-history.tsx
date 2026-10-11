"use client";

import { Badge } from "~/components/ui/badge";
import { EmptyState, InlineLoading } from "~/components/ui/empty-state";
import { ReportTable, Section } from "~/components/ui/report";
import { describeCampdFilters } from "~/lib/facility-filters";
import { datasetStatus, formatNumber, sourceLabel } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";

type DatasetRow = RouterOutputs["facilities"]["getDatasets"][number];

/** A dataset's retrieval filters (API) or file name (upload). */
export function datasetParams(row: DatasetRow) {
  if (row.source !== "API") return row.originalFilename ?? "—";
  if (!row.queryParams) return "—";
  return describeCampdFilters(row.queryParams) || "All units";
}

/** A diff count, or "—" for datasets imported before diffs were tracked. */
const tracked = (n: number | null) => (n === null ? "—" : formatNumber(n));

const STATUS_BADGES = {
  Error: "destructive",
  Superseded: "secondary",
  "Superseded by API": "secondary",
  "Partly replaced by API": "warning",
  Active: "success",
} as const;

function DatasetStatus({ row }: { row: DatasetRow }) {
  const status = datasetStatus(row);
  return (
    <Badge
      variant={STATUS_BADGES[status]}
      title={
        status === "Error"
          ? (row.notes ?? undefined)
          : row.replacedByApi
            ? `${formatNumber(row.replacedByApi)} of this file's unit-years were replaced by a CAMPD API sync`
            : undefined
      }
    >
      {status}
    </Badge>
  );
}

/** §5 / §6 dataset history: the CAMPD retrievals (Retrieve page) or the file uploads (Upload page), newest first. */
export function DatasetHistory({
  title,
  note,
  uploads,
}: {
  title: string;
  note: string;
  uploads: boolean;
}) {
  const historyQuery = api.facilities.getDatasets.useQuery({ limit: 200 });
  const history = (historyQuery.data ?? []).filter(
    (d) => (d.source !== "API") === uploads,
  );

  return (
    <Section title={title} note={note}>
      {historyQuery.isLoading ? (
        <InlineLoading className="py-6" title="Loading datasets…" />
      ) : history.length === 0 ? (
        <EmptyState title={uploads ? "No uploads yet" : "No retrievals yet"} />
      ) : (
        <ReportTable
          sortable
          sortKeys={history.map((d) => [
            undefined,
            undefined,
            datasetParams(d),
            d.importedAt,
            ...Array<undefined>(uploads ? 8 : 6),
            datasetStatus(d),
          ])}
          head={[
            "Year",
            "Source",
            uploads ? "File" : "Parameters",
            "Imported",
            "Received",
            "Stored",
            "New",
            "Updated",
            "Unchanged",
            "Dropped",
            ...(uploads ? ["Still in use", "Replaced by API"] : []),
            "Status",
          ]}
          rows={history.map((d) => [
            d.reportingYear,
            sourceLabel(d.source),
            <span key="params" title={d.name}>
              {datasetParams(d)}
            </span>,
            d.importedAt.toLocaleString(),
            formatNumber(d.rawRecordCount),
            formatNumber(d.validRecords),
            tracked(d.insertedRecords),
            tracked(d.updatedRecords),
            tracked(d.unchangedRecords),
            tracked(d.droppedRecords),
            ...(uploads
              ? [formatNumber(d.currentRecords), formatNumber(d.replacedByApi)]
              : []),
            <DatasetStatus key="status" row={d} />,
          ])}
        />
      )}
    </Section>
  );
}
