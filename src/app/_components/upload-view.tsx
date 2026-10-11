"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Badge, type BadgeVariant } from "~/components/ui/badge";
import { Button, buttonClass } from "~/components/ui/button";
import { DataPanel } from "~/components/ui/data-panel";
import { EmptyState } from "~/components/ui/empty-state";
import { PageTitle, PageView } from "~/components/ui/page";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { KpiStrip, StatTile } from "~/components/ui/stat-tile";
import { ErrorBanner, ReportTable, Section } from "~/components/ui/report";
import { exportUrl } from "~/lib/csv";
import {
  canImport,
  checkUploadFile,
  UPLOAD_EXTENSIONS,
  type ImportReport,
  type ImportResult,
  type RowStatus,
} from "~/lib/data-import";
import { cn, formatNumber, formatQuantity } from "~/lib/utils";
import { api } from "~/trpc/react";
import { AuditTable } from "./audit-logs-table";
import { DatasetHistory } from "./dataset-history";

type Tab = "preview" | "quality" | "duplicates" | "existing" | "columns";

/** Daily/hourly and facility files store no annual records: only facility and unit attributes. */
const attributesOnly = (report: ImportReport) =>
  report.targetSchema === "FACILITIES_AND_UNITS";

/** "hourly" / "daily" from a sub-annual file's period columns; null for other files. */
const periodKind = (report: ImportReport) =>
  report.periodColumns.some((c) => /hour/i.test(c))
    ? "hourly"
    : report.periodColumns.length
      ? "daily"
      : null;

const STATUS_BADGES: Record<RowStatus, [BadgeVariant, string]> = {
  valid: ["success", "Valid"],
  flagged: ["warning", "Flagged"],
  duplicate: ["secondary", "Duplicate"],
  invalid: ["destructive", "Rejected"],
};

async function postUpload<T>(file: File, commit: boolean): Promise<T> {
  const body = new FormData();
  body.append("file", file);
  if (commit) body.append("commit", "true");
  const res = await fetch("/api/upload", { method: "POST", body });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Upload failed.");
  return json;
}

/** §9 upload page: file → Python validation report → approve or cancel → stored records. */
export function UploadView() {
  const utils = api.useUtils();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [tab, setTab] = useState<Tab>("preview");

  const reset = () => {
    setFile(null);
    setReport(null);
    setResult(null);
    setError(null);
    setTab("preview");
    if (inputRef.current) inputRef.current.value = "";
  };

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const selectFile = (selected: File | undefined) => {
    if (!selected) return;
    reset();
    const invalid = checkUploadFile(selected);
    if (invalid) {
      setError(invalid);
      return;
    }
    setFile(selected);
    void run(async () =>
      setReport(await postUpload<ImportReport>(selected, false)),
    );
  };

  const approve = (approved: File) =>
    void run(async () => {
      setResult(await postUpload<ImportResult>(approved, true));
      void utils.facilities.invalidate();
    });

  return (
    <PageView
      header={
        <PageTitle lead="Python reads the file, matches its columns to the project schema, and checks every row for missing, invalid, and duplicate values. Nothing is saved until you approve the import; rejected rows are listed, never dropped silently.">
          Upload a file
        </PageTitle>
      }
      footer={
        result ? (
          <Button size="sm" onClick={reset}>
            Upload another file
          </Button>
        ) : report && file ? (
          <>
            <span className="text-fg-muted truncate text-sm sm:mr-auto">
              {file.name} (
              {formatQuantity(file.size / 1024, "KB", { digits: 1 })})
            </span>
            <Button variant="ghost" size="sm" onClick={reset} disabled={busy}>
              Cancel import
            </Button>
            <Button
              size="sm"
              disabled={busy || !canImport(report)}
              onClick={() => approve(file)}
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {attributesOnly(report)
                ? `Approve and import ${formatNumber(report.recordCounts.units)} units`
                : `Approve and import ${formatNumber(report.summary.validCount)} records`}
            </Button>
          </>
        ) : null
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_EXTENSIONS.join(",")}
        className="hidden"
        onChange={(e) => selectFile(e.target.files?.[0])}
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {result ? (
        <ImportSuccess result={result} />
      ) : report ? (
        <ReportView report={report} tab={tab} onTabChange={setTab} />
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            selectFile(e.dataTransfer.files[0]);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          className={cn(
            "border-edge bg-surface hover:border-fg-muted flex cursor-pointer flex-col items-center rounded-md border border-dashed px-6 py-14 text-center",
            dragging && "border-primary bg-primary/5",
            busy && "pointer-events-none opacity-60",
          )}
        >
          {busy ? (
            <Loader2 className="text-fg-muted h-6 w-6 animate-spin" />
          ) : (
            <FileUp className="text-fg-muted h-6 w-6" />
          )}
          <p className="text-fg mt-3 font-medium">
            {busy
              ? "Reading and validating with Python…"
              : "Drop a file here, or click to choose one"}
          </p>
          <dl className="text-fg-muted mt-3 grid max-w-lg grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-left text-sm">
            <dt className="text-fg-2">Supported formats</dt>
            <dd>CSV (.csv) and Excel (.xlsx), up to 100 MB</dd>
            <dt className="text-fg-2">What it fills</dt>
            <dd>
              CAMPD facility files fill <code>facilities</code> and{" "}
              <code>units</code>; annual emissions files also fill{" "}
              <code>annual_records</code>.
            </dd>
          </dl>
          <p className="text-fg-muted mt-3 text-xs">
            Sample files for a first try are in the repository&apos;s{" "}
            <code>samples/</code> folder.
          </p>
        </div>
      )}

      {!report && !result && (
        <DatasetHistory
          title="Past uploads"
          uploads
          note="Each upload is its own dataset. New / Updated / Unchanged compare it with what the database held before; Dropped rows are in its invalid-records report on the Download page. Still in use counts the unit-years the database takes from this file now; Replaced by API counts those a later CAMPD sync took over."
        />
      )}
    </PageView>
  );
}

function ReportView({
  report,
  tab,
  onTabChange,
}: {
  report: ImportReport;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  const { summary, availableColumns: columns } = report;
  const previewColumns = columns.slice(0, 12);

  return (
    <div className="space-y-4">
      <KpiStrip>
        <StatTile
          variant="card"
          label="Rows"
          value={formatNumber(summary.totalRows)}
          subtext={`${columns.length} columns`}
        />
        <StatTile
          variant="card"
          label="Valid"
          value={formatNumber(summary.validCount)}
          valueClassName="text-success"
          subtext={
            attributesOnly(report) ? "Attributes kept" : "Will be imported"
          }
        />
        <StatTile
          variant="card"
          label="Rejected"
          value={formatNumber(summary.invalidCount)}
          valueClassName={summary.invalidCount ? "text-danger" : undefined}
          subtext="Not imported"
        />
        <StatTile
          variant="card"
          label="Duplicates"
          value={formatNumber(summary.duplicateCount)}
          valueClassName={summary.duplicateCount ? "text-warn" : undefined}
          subtext={
            report.periodColumns.length
              ? "Same unit and period, skipped"
              : "Facility-unit-year, skipped"
          }
        />
        <StatTile
          variant="card"
          label="Audit flags"
          value={formatNumber(report.anomalies.length)}
          valueClassName={report.anomalies.length ? "text-warn" : undefined}
          subtext="Imported and flagged"
        />
      </KpiStrip>

      <div className="border-edge flex flex-wrap items-center gap-2 border-y py-3 text-sm">
        {report.missingRequired.length > 0 ? (
          <Badge variant="destructive">
            Missing required columns:{" "}
            {report.missingRequired
              .map((c) => `${c.table}.${c.column}`)
              .join(", ")}
          </Badge>
        ) : (
          <>
            <span className="text-fg-2">
              {report.targetSchema.replaceAll("_", " ").toLowerCase()} file,
              saves to
            </span>
            {report.destinationTables.map((table) => (
              <Badge key={table} variant="secondary" className="font-mono">
                {table}
              </Badge>
            ))}
            {attributesOnly(report) && (
              <span className="text-fg-2 w-full">
                {periodKind(report)
                  ? `This is ${periodKind(report)} data, which the database does not store: `
                  : "This file has no annual emissions: "}
                only facility and unit attributes are saved.{" "}
                <strong className="text-fg">
                  {formatNumber(summary.validCount)} rows →{" "}
                  {formatNumber(report.recordCounts.facilities)} facilities,{" "}
                  {formatNumber(report.recordCounts.units)} units; no annual
                  records.
                </strong>
              </span>
            )}
            {report.destinationTables.includes("annual_records") && (
              <span className="text-fg-2 sm:ml-auto">
                Compared with the local database:{" "}
                <strong className="text-fg font-medium">
                  {formatNumber(report.diff.inserted)} new
                </strong>
                ,{" "}
                <strong className="text-fg font-medium">
                  {formatNumber(report.diff.updated)} changed
                </strong>
                , {formatNumber(report.diff.unchanged)} unchanged
              </span>
            )}
          </>
        )}
      </div>

      <SegmentedControl
        variant="tabs"
        value={tab}
        onChange={onTabChange}
        options={[
          { value: "preview", label: "Preview" },
          {
            value: "quality",
            label: `Data quality (${formatNumber(summary.invalidCount + report.anomalies.length)})`,
          },
          {
            value: "duplicates",
            label: `Duplicates in file (${formatNumber(summary.duplicateCount)})`,
          },
          ...(report.destinationTables.includes("annual_records")
            ? [
                {
                  value: "existing" as const,
                  label: `Already in database (${formatNumber(report.existing.length)})`,
                },
              ]
            : []),
          { value: "columns", label: `Columns (${columns.length})` },
        ]}
      />

      {tab === "preview" && (
        <Section
          title={`First ${report.previewRows.length} of ${formatNumber(summary.totalRows)} rows`}
        >
          <ReportTable
            sortable
            sortKeys={report.previewRows.map((row) => [undefined, row.status])}
            head={["Row", "Status", ...previewColumns]}
            rows={report.previewRows.map((row) => {
              const [variant, label] = STATUS_BADGES[row.status];
              return [
                row.rowNumber,
                <Badge key="status" variant={variant}>
                  {label}
                </Badge>,
                ...previewColumns.map((col) => row.data[col] ?? "—"),
              ];
            })}
          />
        </Section>
      )}

      {tab === "quality" &&
        (summary.invalidCount === 0 && report.anomalies.length === 0 ? (
          <EmptyState
            variant="success"
            title="No data-quality issues"
            description="Every row has valid keys, numbers, coordinates, and state codes, and passes the physical sanity rules."
          />
        ) : (
          <>
            {report.validationErrors.length > 0 && (
              <Section
                title={`Rejected rows (${formatNumber(summary.invalidCount)})`}
                note={`These rows are not imported.${summary.invalidCount > report.validationErrors.length ? ` Showing the first ${report.validationErrors.length} problems.` : ""}`}
              >
                <ReportTable
                  sortable
                  head={[
                    "Row",
                    "Facility / Unit",
                    "Column",
                    "Value",
                    "Problem",
                  ]}
                  rows={report.validationErrors.map((e) => [
                    e.rowNumber,
                    `${e.facilityId || "—"} / ${e.unitId || "—"}`,
                    e.field,
                    e.value || "—",
                    e.reason,
                  ])}
                />
              </Section>
            )}
            {report.anomalies.length > 0 && (
              <Section
                title={`Physical sanity flags (${formatNumber(report.anomalies.length)})`}
                note="These records are imported and the flags are logged to data_audit_logs."
              >
                <DataPanel>
                  <AuditTable logs={report.anomalies} />
                </DataPanel>
              </Section>
            )}
          </>
        ))}

      {tab === "duplicates" &&
        (summary.duplicateCount === 0 ? (
          <EmptyState
            variant="success"
            title="No duplicates in the file"
            description={`Every row is a distinct ${report.periodColumns.length ? "unit and period" : "facility-unit-year"}.`}
          />
        ) : (
          <Section
            title={`Repeated rows (${formatNumber(summary.duplicateCount)})`}
            note={`The first row is kept; repeats are skipped and listed in the data-quality report.${summary.duplicateCount > report.duplicates.length ? ` Showing the first ${formatNumber(report.duplicates.length)}.` : ""}`}
          >
            <ReportTable
              sortable
              head={["Row", "Facility", "Unit", "Year", "Resolution"]}
              rows={report.duplicates.map((d) => [
                d.rowNumber,
                d.facilityId,
                d.unitId,
                d.year ?? "—",
                d.reason,
              ])}
            />
          </Section>
        ))}

      {tab === "existing" &&
        (report.existing.length === 0 ? (
          <EmptyState
            variant="success"
            title="All records are new"
            description="None of the file's facility-unit-years is in the database yet."
          />
        ) : (
          <Section
            title={`Already in the database (${formatNumber(report.existing.length)})`}
            note="On import, changed records are updated and attributed to this upload; unchanged ones keep their values."
          >
            <ReportTable
              sortable
              head={["Row", "Facility", "Unit", "Year", "Comparison"]}
              rows={report.existing.map((e) => [
                e.rowNumber,
                e.facilityId,
                e.unitId,
                e.year,
                <Badge
                  key="status"
                  variant={e.status === "changed" ? "warning" : "secondary"}
                >
                  {e.reason}
                </Badge>,
              ])}
            />
          </Section>
        ))}

      {tab === "columns" && (
        <>
          <Section title="Schema mapping">
            <ReportTable
              sortable
              head={[
                "File column",
                "Table",
                "Database column",
                "Required",
                "Missing values",
              ]}
              rows={report.tableMappings.map((m) => [
                m.fileColumn,
                m.targetTable,
                m.targetColumn,
                m.required ? "Yes" : "No",
                formatNumber(report.missingValueCounts[m.fileColumn] ?? 0),
              ])}
            />
          </Section>
          {report.unmappedColumns.length > 0 && (
            <Section
              title={`Not imported (${report.unmappedColumns.length})`}
              note={report.unmappedColumns.join(" · ")}
            />
          )}
        </>
      )}
    </div>
  );
}

function ImportSuccess({ result }: { result: ImportResult }) {
  return (
    <div className="space-y-4">
      <EmptyState
        variant="success"
        title="Import complete"
        description={`Saved as dataset "${result.datasetName}" (${result.source}). The original file is archived at ${result.archivedFile ?? "—"}.`}
      />
      <KpiStrip className="sm:grid-cols-4">
        <StatTile
          variant="card"
          label="Facilities"
          value={formatNumber(result.facilities)}
          subtext="facilities table"
        />
        <StatTile
          variant="card"
          label="Units"
          value={formatNumber(result.units)}
          subtext="units table"
        />
        <StatTile
          variant="card"
          label="Annual records"
          value={formatNumber(result.annualRecords)}
          subtext={`${formatNumber(result.diff.inserted)} new · ${formatNumber(result.diff.updated)} updated · ${formatNumber(result.diff.unchanged)} unchanged`}
        />
        <StatTile
          variant="card"
          label="Audit flags"
          value={formatNumber(result.anomalies)}
          subtext="See Explore, Audit flags"
        />
      </KpiStrip>
      <div className="flex flex-wrap items-center gap-2">
        {result.issues > 0 && (
          <a
            href={exportUrl("invalid", { id: result.datasetId })}
            download
            className={buttonClass({ variant: "outline", size: "sm" })}
          >
            Download rejected rows ({formatNumber(result.issues)})
          </a>
        )}
        <p className="text-fg-muted text-xs sm:ml-auto">
          Dataset ID {result.datasetId}
        </p>
      </div>
    </div>
  );
}
