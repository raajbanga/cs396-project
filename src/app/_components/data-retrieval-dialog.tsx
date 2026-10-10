"use client";

import { useDeferredValue, useState } from "react";
import { CheckCircle2, CloudDownload, Eye, Loader2 } from "lucide-react";
import { Badge, SourceBadge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Dialog, DialogTitle } from "~/components/ui/dialog";
import { EmptyState, InlineLoading } from "~/components/ui/empty-state";
import { Input } from "~/components/ui/input";
import {
  ErrorBanner,
  Field,
  ReportTable,
  Section,
} from "~/components/ui/report";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Select, toOptions } from "~/components/ui/select";
import { KpiStrip, StatTile } from "~/components/ui/stat-tile";
import {
  DEFAULT_RETRIEVAL,
  describeCampdFilters,
  type CampdRetrieval as RetrievalInput,
  parseFacilityIds,
  UNIT_METRICS,
} from "~/lib/facility-filters";
import type { FieldChange } from "~/lib/record-diff";
import {
  datasetOriginLabel,
  datasetStatus,
  formatNumber,
  sourceLabel,
} from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";

type DatasetRow = RouterOutputs["facilities"]["getDatasets"][number];
type PreviewYear = RouterOutputs["facilities"]["previewCampd"]["years"][number];
type PreviewTab = "new" | "changed" | "unchanged" | "dropped";

/** First year of Acid Rain Program annual data in CAMPD. */
const FIRST_CAMPD_YEAR = 1995;
const LAST_YEAR = new Date().getFullYear() - 1;

const METRIC_LABELS: Record<FieldChange["field"], string> = {
  ...(Object.fromEntries(UNIT_METRICS.map((m) => [m.key, m.label])) as Record<
    (typeof UNIT_METRICS)[number]["key"],
    string
  >),
  steamLoadKlb: "Steam load",
  so2Controls: "SO₂ controls",
  noxControls: "NOₓ controls",
  pmControls: "PM controls",
  hgControls: "Hg controls",
  programCode: "Programs",
};

const changeValue = (v: FieldChange["database"]) =>
  typeof v === "string" ? v : formatNumber(v, 2);

const changeText = (changes: FieldChange[]) =>
  changes
    .map(
      (c) =>
        `${METRIC_LABELS[c.field]}: ${changeValue(c.database)} → ${changeValue(c.incoming)}`,
    )
    .join(" · ");

/** A diff count, or "—" for datasets imported before diffs were tracked. */
const tracked = (n: number | null) => (n === null ? "—" : formatNumber(n));

const sum = (years: PreviewYear[], key: keyof PreviewYear) =>
  years.reduce((n, y) => n + Number(y[key]), 0);

export function datasetParams(row: DatasetRow) {
  if (row.source !== "API") return row.originalFilename ?? "—";
  if (!row.queryParams) return "—";
  return describeCampdFilters(row.queryParams) || "All units";
}

/**
 * §5 retrieval: CAMPD annual emissions by year range and filters. Shows what the database already
 * holds, previews what the API returns against it (new / changed / unchanged / dropped), and saves
 * only after approval. Also lists the dataset history.
 */
export function DataRetrievalDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const [form, setForm] = useState(DEFAULT_RETRIEVAL);
  const [years, setYears] = useState({ from: LAST_YEAR, to: LAST_YEAR });
  const [previewInput, setPreviewInput] = useState<RetrievalInput | null>(null);
  const [tab, setTab] = useState<PreviewTab>("changed");
  const setField = (key: keyof typeof DEFAULT_RETRIEVAL, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const facilityIds = parseFacilityIds(form.facilityIds);
  const yearCount = years.to - years.from + 1;
  const invalid =
    facilityIds === null
      ? "Facility IDs must be whole numbers separated by commas."
      : yearCount < 1
        ? "From year must not be after To year."
        : null;
  const input: RetrievalInput | null =
    invalid || !facilityIds
      ? null
      : {
          fromYear: years.from,
          toYear: years.to,
          stateCode: form.stateCode,
          facilityId: facilityIds,
          unitFuelType: form.unitFuelType,
          unitType: form.unitType,
          controlTechnologies: form.controlTechnologies,
        };
  const deferredInput = useDeferredValue(input);
  // A preview belongs to the parameters it was run with; editing them asks for a new one.
  const previewIsCurrent =
    previewInput !== null &&
    JSON.stringify(previewInput) === JSON.stringify(input);

  const retrieve = api.facilities.retrieveCampd.useMutation({
    onSettled: onImported,
    onSuccess: () => setPreviewInput(null),
  });
  const running = retrieve.isPending;
  const runError = retrieve.data?.error ?? retrieve.error?.message;
  const results = retrieve.data?.results ?? [];

  const previewQuery = api.facilities.previewCampd.useQuery(previewInput!, {
    enabled: open && previewInput !== null,
    staleTime: Infinity,
  });
  const preview = previewIsCurrent ? previewQuery.data : undefined;
  const previewYears = preview?.years ?? [];
  const previewing = previewIsCurrent && previewQuery.isFetching;

  const coverageQuery = api.facilities.getLocalCoverage.useQuery(
    deferredInput!,
    { enabled: open && deferredInput !== null },
  );
  const coverage = coverageQuery.data ?? [];

  const { data: filterOptions } = api.facilities.getFilterOptions.useQuery(
    undefined,
    { enabled: open },
  );
  const { data: published } = api.facilities.getCampdPublishedThrough.useQuery(
    undefined,
    { enabled: open },
  );
  const { data: campdOptions } = api.facilities.getRetrievalOptions.useQuery(
    undefined,
    { enabled: open },
  );
  const historyQuery = api.facilities.getDatasets.useQuery(
    { limit: 50 },
    { enabled: open },
  );
  const history = historyQuery.data ?? [];

  const latestYear = Math.max(published?.year ?? LAST_YEAR, LAST_YEAR);
  const yearOptions = toOptions(
    Array.from(
      { length: latestYear - FIRST_CAMPD_YEAR + 1 },
      (_, i) => latestYear - i,
    ),
  );

  const selects = [
    { key: "stateCode", label: "State", values: filterOptions?.states },
    { key: "unitFuelType", label: "Fuel", values: campdOptions?.fuels },
    {
      key: "unitType",
      label: "Unit type",
      values: campdOptions?.unitTypes,
    },
    {
      key: "controlTechnologies",
      label: "Control technology",
      values: campdOptions?.controls,
    },
  ] as const;

  const toSave = sum(previewYears, "inserted") + sum(previewYears, "updated");
  const previewRows = previewYears.flatMap((y) =>
    tab === "dropped" ? [] : y.rows[tab],
  );
  const droppedRows = previewYears.flatMap((y) =>
    y.droppedRows.map((d) => ({ ...d, year: y.year })),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="compare"
      closeLabel="Close"
      header={
        <div className="space-y-1.5">
          <span className="flex items-center gap-1 font-mono text-xs font-semibold text-emerald-400">
            <CloudDownload className="h-3.5 w-3.5" />
            CAMPD Retrieval
          </span>
          <DialogTitle>Retrieve EPA CAMPD Annual Emissions</DialogTitle>
          <p className="text-fg-muted text-xs sm:text-sm">
            Method: EPA Clean Air Markets (CAM) API, apportioned annual
            emissions (<code>/annual</code>). Preview compares what the API
            returns with what the database already holds; nothing is saved until
            you approve. Each year is stored as its own dataset. Files from
            CAMPD Custom Data Download go through Upload instead.
          </p>
        </div>
      }
      footer={
        preview && !preview.error ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreviewInput(null)}
              disabled={running}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={running}
              onClick={() => retrieve.mutate(previewInput!)}
            >
              {running ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {running
                ? "Saving…"
                : `Approve & save ${yearCount > 1 ? `${yearCount} years` : "year"} (${formatNumber(toSave)} new or changed)`}
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            disabled={!input || previewing}
            onClick={() => input && setPreviewInput(input)}
          >
            {previewing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            {previewing
              ? "Fetching from EPA…"
              : `Preview ${yearCount > 1 ? `${yearCount} years` : "year"}`}
          </Button>
        )
      }
    >
      {runError && <ErrorBanner>Retrieval stopped at {runError}</ErrorBanner>}
      {preview?.error && (
        <ErrorBanner>Preview stopped at {preview.error}</ErrorBanner>
      )}

      <Section title="Parameters">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="From year">
            <Select
              size="drawer"
              value={String(years.from)}
              onValueChange={(v) =>
                setYears((y) => ({ ...y, from: Number(v) }))
              }
              options={yearOptions}
            />
          </Field>
          <Field label="To year">
            <Select
              size="drawer"
              value={String(years.to)}
              onValueChange={(v) => setYears((y) => ({ ...y, to: Number(v) }))}
              options={yearOptions}
            />
          </Field>
          <Field label="Facility IDs" className="col-span-2">
            <Input
              value={form.facilityIds}
              onChange={(e) => setField("facilityIds", e.target.value)}
              placeholder="Any, or e.g. 3, 1355"
              className="bg-surface/80"
            />
          </Field>
          {selects.map(({ key, label, values }) => (
            <Field key={key} label={label}>
              <Select
                size="drawer"
                value={form[key]}
                onValueChange={(v) => setField(key, v)}
                options={toOptions(values, "Any")}
              />
            </Field>
          ))}
        </div>
        {invalid && <p className="text-xs text-red-400">{invalid}</p>}
      </Section>

      <Section
        title="Already in the database"
        note="Stored unit-years for these years and filters, by the dataset that last wrote them. Fuel, unit type, and control match by name, so this approximates what CAMPD will return."
      >
        <SourceBadge kind="db" />
        {coverageQuery.isLoading && deferredInput ? (
          <InlineLoading className="py-6" title="Checking the database…" />
        ) : coverage.length === 0 ? (
          <EmptyState title="Nothing stored for these years and filters yet." />
        ) : (
          <ReportTable
            sortable
            sortKeys={coverage.map((c) => [undefined, undefined, c.importedAt])}
            head={["Year", "Stored unit-years", "Last written by"]}
            rows={coverage.map((c) => [
              c.year,
              formatNumber(c.records),
              <span
                key="from"
                className="font-sans"
                title={c.datasetName ?? ""}
              >
                {c.source && c.importedAt
                  ? datasetOriginLabel({
                      source: c.source,
                      importedAt: c.importedAt,
                    })
                  : "Unknown dataset"}
              </span>,
            ])}
          />
        )}
      </Section>

      {previewIsCurrent && (
        <Section
          title="Preview: what the API returned"
          note="Compared with the stored values for each facility-unit-year. Approving writes new and changed records; unchanged ones are rewritten with the same values, and dropped rows are listed in the invalid-records report."
        >
          <SourceBadge kind="api" />
          {previewing && !preview ? (
            <InlineLoading
              className="py-6"
              title="Fetching from the EPA CAMPD API…"
            />
          ) : previewYears.length > 0 ? (
            <>
              <KpiStrip>
                <StatTile
                  label="Received"
                  value={formatNumber(sum(previewYears, "received"))}
                  subtext="Rows from CAMPD"
                />
                <StatTile
                  label="New"
                  value={formatNumber(sum(previewYears, "inserted"))}
                  valueClassName="text-emerald-400"
                  subtext="Not in the database"
                />
                <StatTile
                  label="Changed"
                  value={formatNumber(sum(previewYears, "updated"))}
                  valueClassName="text-amber-400"
                  subtext="Values differ"
                />
                <StatTile
                  label="Unchanged"
                  value={formatNumber(sum(previewYears, "unchanged"))}
                  subtext="Same as stored"
                />
                <StatTile
                  label="Dropped"
                  value={formatNumber(sum(previewYears, "dropped"))}
                  valueClassName={
                    sum(previewYears, "dropped") ? "text-red-400" : undefined
                  }
                  subtext="Invalid or duplicate"
                  className="col-span-2 sm:col-span-1"
                />
              </KpiStrip>
              {previewYears.length > 1 && (
                <ReportTable
                  sortable
                  head={[
                    "Year",
                    "Received",
                    "New",
                    "Changed",
                    "Unchanged",
                    "Dropped",
                  ]}
                  rows={previewYears.map((y) => [
                    y.year,
                    formatNumber(y.received),
                    formatNumber(y.inserted),
                    formatNumber(y.updated),
                    formatNumber(y.unchanged),
                    formatNumber(y.dropped),
                  ])}
                />
              )}
              <SegmentedControl
                value={tab}
                onChange={setTab}
                options={[
                  { value: "new", label: "New" },
                  { value: "changed", label: "Changed" },
                  { value: "unchanged", label: "Unchanged" },
                  { value: "dropped", label: "Dropped" },
                ]}
                className="w-fit"
              />
              {tab === "dropped" ? (
                droppedRows.length === 0 ? (
                  <EmptyState
                    variant="success"
                    title="Every CAMPD row passed validation"
                  />
                ) : (
                  <ReportTable
                    sortable
                    head={["Year", "Row", "Kind", "Reason"]}
                    rows={droppedRows.map((d) => [
                      d.year,
                      d.rowNumber,
                      d.kind,
                      d.reason,
                    ])}
                  />
                )
              ) : previewRows.length === 0 ? (
                <EmptyState title={`No ${tab} records`} />
              ) : (
                <ReportTable
                  sortable
                  sortKeys={previewRows.map((r) => [
                    undefined,
                    r.facilityName,
                    undefined,
                    undefined,
                    undefined,
                    r.changes.length,
                  ])}
                  head={[
                    "Year",
                    "Facility",
                    "Unit",
                    "Gross MWh (API)",
                    "CO₂ t (API)",
                    ...(tab === "changed" ? ["Database → API"] : []),
                  ]}
                  rows={previewRows.map((r) => [
                    r.year,
                    <span key="f" className="font-sans" title={r.facilityName}>
                      {r.facilityName} (#{r.facilityId})
                    </span>,
                    r.unitId,
                    formatNumber(r.grossGenerationMWh),
                    formatNumber(r.co2MassTons),
                    ...(tab === "changed"
                      ? [
                          <span
                            key="c"
                            className="font-sans"
                            title={changeText(r.changes)}
                          >
                            {changeText(r.changes)}
                          </span>,
                        ]
                      : []),
                  ])}
                />
              )}
              <p className="text-fg-muted text-xs">
                Up to 50 rows per category and year are listed; the counts above
                cover every row.
              </p>
            </>
          ) : null}
        </Section>
      )}

      {retrieve.variables && (
        <Section title="This retrieval">
          <KpiStrip>
            <StatTile
              label="Status"
              value={running ? "Saving" : runError ? "Error" : "Saved"}
              valueClassName={
                running
                  ? "text-sky-400"
                  : runError
                    ? "text-red-400"
                    : "text-emerald-400"
              }
              subtext={`${results.length} of ${retrieve.variables.toYear - retrieve.variables.fromYear + 1} years saved`}
            />
            <StatTile
              label="New"
              value={formatNumber(results.reduce((n, r) => n + r.inserted, 0))}
              valueClassName="text-emerald-400"
              subtext="Inserted"
            />
            <StatTile
              label="Updated"
              value={formatNumber(results.reduce((n, r) => n + r.updated, 0))}
              subtext="Values changed"
            />
            <StatTile
              label="Unchanged"
              value={formatNumber(results.reduce((n, r) => n + r.unchanged, 0))}
              subtext="Same as before"
            />
            <StatTile
              label="Dropped"
              value={formatNumber(results.reduce((n, r) => n + r.dropped, 0))}
              subtext="See invalid-records CSV"
              className="col-span-2 sm:col-span-1"
            />
          </KpiStrip>
        </Section>
      )}

      <Section
        title="Past retrievals"
        note="New / Updated / Unchanged compare each import with what the database held before it (— = imported before this was tracked). Superseded datasets had all their records taken over by a later retrieval; they are kept as history."
      >
        {historyQuery.isLoading ? (
          <InlineLoading className="py-6" title="Loading datasets…" />
        ) : history.length === 0 ? (
          <EmptyState title="No datasets yet" />
        ) : (
          <ReportTable
            sortable
            sortKeys={history.map((d) => [
              undefined,
              undefined,
              datasetParams(d),
              d.importedAt,
              ...Array<undefined>(6),
              datasetStatus(d),
            ])}
            head={[
              "Year",
              "Source",
              "Parameters",
              "Imported",
              "Received",
              "Stored",
              "New",
              "Updated",
              "Unchanged",
              "Dropped",
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
              <DatasetStatus key="status" row={d} />,
            ])}
          />
        )}
      </Section>
    </Dialog>
  );
}

const STATUS_BADGES = {
  Error: "destructive",
  Superseded: "secondary",
  Active: "success",
} as const;

function DatasetStatus({ row }: { row: DatasetRow }) {
  const status = datasetStatus(row);
  return (
    <Badge
      variant={STATUS_BADGES[status]}
      title={status === "Error" ? (row.notes ?? undefined) : undefined}
    >
      {status}
    </Badge>
  );
}
