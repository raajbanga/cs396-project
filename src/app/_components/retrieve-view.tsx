"use client";

import { useDeferredValue, useState, type ReactNode } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { EmptyState, InlineLoading } from "~/components/ui/empty-state";
import { Input } from "~/components/ui/input";
import { PageTitle, PageView } from "~/components/ui/page";
import {
  ErrorBanner,
  Field,
  ReportTable,
  Section,
} from "~/components/ui/report";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { TryExamples } from "~/components/ui/try-examples";
import { Select, toOptions } from "~/components/ui/select";
import { KpiStrip, StatTile } from "~/components/ui/stat-tile";
import {
  DEFAULT_RETRIEVAL,
  type CampdRetrieval as RetrievalInput,
  parseFacilityIds,
  UNIT_METRICS,
} from "~/lib/facility-filters";
import type { FieldChange } from "~/lib/record-diff";
import { datasetOriginLabel, formatNumber } from "~/lib/utils";
import { api } from "~/trpc/react";
import { DatasetHistory } from "./dataset-history";

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

/** Sample retrievals for the demo: a state and fuel, one facility's history, a unit type, a control. */
const RETRIEVE_EXAMPLES: ({
  label: string;
  years: { from: number; to: number };
} & Partial<typeof DEFAULT_RETRIEVAL>)[] = [
  {
    label: "Kentucky coal units, 2025",
    years: { from: 2025, to: 2025 },
    stateCode: "KY",
    unitFuelType: "Coal",
  },
  {
    label: "Barry (facility 3), 2023–2025",
    years: { from: 2023, to: 2025 },
    facilityIds: "3",
  },
  {
    label: "Texas combined-cycle units, 2024",
    years: { from: 2024, to: 2024 },
    stateCode: "TX",
    unitType: "Combined cycle",
  },
  {
    label: "Ohio units with a baghouse, 2025",
    years: { from: 2025, to: 2025 },
    stateCode: "OH",
    controlTechnologies: "Baghouse",
  },
];

const sum = <T,>(rows: T[], key: keyof T) =>
  rows.reduce((n, row) => n + Number(row[key]), 0);

/**
 * §5 retrieval: CAMPD annual emissions by year range and filters. Shows what the database already
 * holds, previews what the API returns against it (new / changed / unchanged / dropped), and saves
 * only after approval. Also lists the dataset history.
 */
export function RetrieveView() {
  const utils = api.useUtils();
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
    onSettled: () => void utils.facilities.invalidate(),
    onSuccess: () => setPreviewInput(null),
  });
  const running = retrieve.isPending;
  const runError = retrieve.data?.error ?? retrieve.error?.message;
  const results = retrieve.data?.results ?? [];

  const previewQuery = api.facilities.previewCampd.useQuery(previewInput!, {
    enabled: previewInput !== null,
    staleTime: Infinity,
  });
  const preview = previewIsCurrent ? previewQuery.data : undefined;
  const previewYears = preview?.years ?? [];
  const previewing = previewIsCurrent && previewQuery.isFetching;

  const coverageQuery = api.facilities.getLocalCoverage.useQuery(
    deferredInput!,
    { enabled: deferredInput !== null },
  );
  const coverage = coverageQuery.data ?? [];

  const { data: filterOptions } = api.facilities.getFilterOptions.useQuery();
  const { data: published } =
    api.facilities.getCampdPublishedThrough.useQuery();
  const { data: campdOptions } = api.facilities.getRetrievalOptions.useQuery();

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
    <PageView
      header={
        <PageTitle
          lead={
            <>
              Retrieval method: the EPA Clean Air Markets (CAM) API, apportioned
              annual emissions endpoint (
              <code className="text-xs">/annual</code>
              ). Choose years and filters, preview what the API returns next to
              what the database already holds, then approve to save. Nothing is
              stored before you approve, and each year becomes its own dataset.
              Files from CAMPD Custom Data Download go through{" "}
              <Link href="/upload" className="text-primary hover:underline">
                Upload
              </Link>{" "}
              instead.
            </>
          }
        >
          Retrieve from the EPA
        </PageTitle>
      }
    >
      {runError && <ErrorBanner>Retrieval stopped at {runError}</ErrorBanner>}
      {preview?.error && (
        <ErrorBanner>Preview stopped at {preview.error}</ErrorBanner>
      )}

      <Section title="Filters">
        <TryExamples
          examples={RETRIEVE_EXAMPLES.map(({ label, years: y, ...form }) => ({
            label,
            onSelect: () => {
              setForm({ ...DEFAULT_RETRIEVAL, ...form });
              setYears(y);
            },
          }))}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        {invalid && <p className="text-danger text-sm">{invalid}</p>}
        <Button
          className="mt-1"
          disabled={!input || previewing}
          onClick={() => input && setPreviewInput(input)}
        >
          {previewing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {previewing
            ? "Fetching from the EPA…"
            : `Preview ${yearCount > 1 ? `${yearCount} years` : "year"} from the EPA`}
        </Button>
      </Section>

      <Section
        title="Already in the local database"
        note="Stored unit-years for these years and filters, by the dataset that last wrote them. Fuel, unit type, and control match by name, so this approximates what CAMPD will return."
      >
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
          title="Preview from the live EPA API"
          note="Compared with the stored values for each facility-unit-year. Approving writes new and changed records; unchanged ones are rewritten with the same values, and dropped rows are listed in the invalid-records report."
        >
          {previewing && !preview ? (
            <InlineLoading
              className="py-6"
              title="Fetching from the EPA CAMPD API…"
            />
          ) : previewYears.length > 0 ? (
            <>
              <DiffTiles rows={previewYears}>
                <StatTile
                  label="Received"
                  value={formatNumber(sum(previewYears, "received"))}
                  subtext="Rows from CAMPD"
                />
              </DiffTiles>
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
              {!preview?.error && (
                <div className="border-edge flex flex-wrap items-center justify-end gap-2 border-t pt-4">
                  <span className="text-fg-2 mr-auto text-sm">
                    Nothing is saved until you approve.
                  </span>
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
                    onClick={() => retrieve.mutate(previewInput)}
                  >
                    {running ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    {running
                      ? "Saving…"
                      : `Approve and save ${yearCount > 1 ? `${yearCount} years` : "year"} (${formatNumber(toSave)} new or changed)`}
                  </Button>
                </div>
              )}
            </>
          ) : null}
        </Section>
      )}

      {retrieve.variables && (
        <Section title="Retrieval status">
          <DiffTiles rows={results} saved>
            <StatTile
              label="Status"
              value={running ? "Saving" : runError ? "Error" : "Saved"}
              valueClassName={
                running
                  ? "text-info"
                  : runError
                    ? "text-danger"
                    : "text-success"
              }
              subtext={`${results.length} of ${retrieve.variables.toYear - retrieve.variables.fromYear + 1} years saved`}
            />
          </DiffTiles>
        </Section>
      )}

      <DatasetHistory
        title="Past retrievals"
        uploads={false}
        note="New / Updated / Unchanged compare each retrieval with what the database held before it (— = imported before this was tracked). Superseded datasets had all their records taken over by a later retrieval; they are kept as history."
      />
    </PageView>
  );
}

/** `children` (a lead tile), then New / Changed / Unchanged / Dropped summed over the years, for a preview or a saved retrieval. */
function DiffTiles({
  rows,
  saved = false,
  children,
}: {
  rows: {
    inserted: number;
    updated: number;
    unchanged: number;
    dropped: number;
  }[];
  saved?: boolean;
  children: ReactNode;
}) {
  const dropped = sum(rows, "dropped");
  return (
    <KpiStrip>
      {children}
      <StatTile
        label="New"
        value={formatNumber(sum(rows, "inserted"))}
        valueClassName="text-primary"
        subtext={saved ? "Inserted" : "Not in the database"}
      />
      <StatTile
        label="Changed"
        value={formatNumber(sum(rows, "updated"))}
        valueClassName="text-warn"
        subtext={saved ? "Values updated" : "Values differ"}
      />
      <StatTile
        label="Unchanged"
        value={formatNumber(sum(rows, "unchanged"))}
        subtext={saved ? "Same as before" : "Same as stored"}
      />
      <StatTile
        label="Dropped"
        value={formatNumber(dropped)}
        valueClassName={dropped ? "text-danger" : undefined}
        subtext={saved ? "See invalid-records CSV" : "Invalid or duplicate"}
        className="col-span-2 sm:col-span-1"
      />
    </KpiStrip>
  );
}
