"use client";

import { useState, type ReactNode } from "react";
import { CloudDownload, Loader2 } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Dialog, DialogTitle } from "~/components/ui/dialog";
import { EmptyState, InlineLoading } from "~/components/ui/empty-state";
import { Input } from "~/components/ui/input";
import { Select, toOptions } from "~/components/ui/select";
import { KpiStrip, StatTile } from "~/components/ui/stat-tile";
import {
  DEFAULT_RETRIEVAL,
  describeCampdFilters,
  parseFacilityIds,
} from "~/lib/facility-filters";
import { DATASET_SOURCE_LABELS, formatQuantity } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";
import { ReportTable, Section } from "./data-upload-dialog";

type DatasetRow = RouterOutputs["facilities"]["getDatasets"][number];

/** First year of Acid Rain Program annual data in CAMPD. */
const FIRST_CAMPD_YEAR = 1995;
const LAST_YEAR = new Date().getFullYear() - 1;

const count = (n: number) => formatQuantity(n, "", { fallback: "0" });

function datasetParams(row: DatasetRow) {
  if (row.source !== "API") return row.originalFilename ?? "—";
  if (!row.queryParams) return "—";
  return describeCampdFilters(row.queryParams) || "All units";
}

/** §5 retrieval: CAMPD annual emissions by year range and filters, plus the dataset history. */
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
  const setField = (key: keyof typeof DEFAULT_RETRIEVAL, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const retrieve = api.facilities.retrieveCampd.useMutation({
    onSettled: onImported,
  });
  const running = retrieve.isPending;
  const runError = retrieve.data?.error ?? retrieve.error?.message;
  const results = retrieve.data?.results ?? [];

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
  const facilityIds = parseFacilityIds(form.facilityIds);
  const yearCount = years.to - years.from + 1;
  const invalid =
    facilityIds === null
      ? "Facility IDs must be whole numbers separated by commas."
      : yearCount < 1
        ? "From year must not be after To year."
        : null;

  const submit = () => {
    if (invalid || !facilityIds) return;
    retrieve.mutate({
      fromYear: years.from,
      toYear: years.to,
      stateCode: form.stateCode,
      facilityId: facilityIds,
      unitFuelType: form.unitFuelType,
      unitType: form.unitType,
      controlTechnologies: form.controlTechnologies,
    });
  };

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
            Pull apportioned annual emissions from the EPA Clean Air Markets
            API. Each year is stored as its own dataset with these parameters;
            existing facility-unit-years are updated in place.
          </p>
        </div>
      }
      footer={
        <Button size="sm" disabled={running || !!invalid} onClick={submit}>
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CloudDownload className="h-3.5 w-3.5" />
          )}
          {running
            ? "Retrieving…"
            : `Retrieve ${yearCount > 1 ? `${yearCount} years` : "year"}`}
        </Button>
      }
    >
      {runError && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-400 sm:text-sm">
          Retrieval stopped at {runError}
        </div>
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

      {retrieve.variables && (
        <Section title="This retrieval">
          <KpiStrip className="sm:grid-cols-3">
            <StatTile
              label="Status"
              value={running ? "Running" : runError ? "Error" : "Done"}
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
              label="Received"
              value={count(results.reduce((n, r) => n + r.rawRecordCount, 0))}
              subtext="Rows from CAMPD"
            />
            <StatTile
              label="Stored"
              value={count(results.reduce((n, r) => n + r.validRecords, 0))}
              valueClassName="text-emerald-400"
              subtext="annual_records"
            />
          </KpiStrip>
        </Section>
      )}

      <Section
        title="Past retrievals"
        note="Superseded datasets had all their records taken over by a later retrieval; they are kept as history."
      >
        {historyQuery.isLoading ? (
          <InlineLoading className="py-6" title="Loading datasets…" />
        ) : history.length === 0 ? (
          <EmptyState title="No datasets yet" />
        ) : (
          <ReportTable
            head={[
              "Year",
              "Source",
              "Parameters",
              "Imported",
              "Received",
              "Stored",
              "Status",
            ]}
            rows={history.map((d) => [
              d.reportingYear,
              DATASET_SOURCE_LABELS[d.source] ?? d.source,
              <span key="params" title={d.name}>
                {datasetParams(d)}
              </span>,
              d.importedAt.toLocaleString(),
              count(d.rawRecordCount),
              count(d.validRecords),
              <DatasetStatus key="status" row={d} />,
            ])}
          />
        )}
      </Section>
    </Dialog>
  );
}

function DatasetStatus({ row }: { row: DatasetRow }) {
  if (row.notes?.startsWith("Error")) {
    return (
      <Badge variant="destructive" title={row.notes}>
        Error
      </Badge>
    );
  }
  if (row.superseded) return <Badge variant="secondary">Superseded</Badge>;
  return <Badge variant="success">Active</Badge>;
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={className}>
      <span className="text-fg-muted mb-1 block text-xs font-medium">
        {label}
      </span>
      {children}
    </label>
  );
}
