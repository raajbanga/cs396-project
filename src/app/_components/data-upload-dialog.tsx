"use client";

import { useRef, useState } from "react";
import {
  CheckCircle2,
  Database,
  FileDown,
  FileUp,
  Loader2,
} from "lucide-react";
import { Badge, SourceBadge, type BadgeVariant } from "~/components/ui/badge";
import { Button, buttonClass } from "~/components/ui/button";
import { DataPanel } from "~/components/ui/data-panel";
import { Dialog, DialogTitle } from "~/components/ui/dialog";
import { EmptyState } from "~/components/ui/empty-state";
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
import { AuditTable } from "./audit-logs-table";

type Tab = "preview" | "quality" | "duplicates" | "columns";

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

/** Upload → Python validation report → approve or cancel → stored records. */
export function DataUploadDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
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
      onImported();
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      size="compare"
      closeLabel="Close"
      header={
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 font-mono text-xs font-semibold text-emerald-400">
              <Database className="h-3.5 w-3.5" />
              Data Import
            </span>
            {report && (
              <Badge variant="sky" className="font-mono">
                {report.targetSchema.replaceAll("_", " ")}
              </Badge>
            )}
          </div>
          <DialogTitle>Import Power & Emissions Data</DialogTitle>
          <p className="text-fg-muted text-xs sm:text-sm">
            Upload a CSV or Excel file. Python reads it and checks it against
            the project schema; nothing is saved until you approve the import.
          </p>
        </div>
      }
      footer={
        result ? (
          <Button size="sm" onClick={reset}>
            Upload Another File
          </Button>
        ) : report && file ? (
          <>
            <span className="text-fg-muted truncate font-mono text-xs sm:mr-auto">
              {file.name} (
              {formatQuantity(file.size / 1024, "KB", { digits: 1 })})
            </span>
            <Button variant="ghost" size="sm" onClick={reset} disabled={busy}>
              Cancel Import
            </Button>
            <Button
              size="sm"
              disabled={busy || !canImport(report)}
              onClick={() => approve(file)}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Approve & Import {formatNumber(report.summary.validCount)} Records
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
          className={cn(
            "border-edge bg-surface/30 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed p-8 text-center transition-colors hover:border-emerald-500/60 sm:p-12",
            dragging && "border-emerald-500 bg-emerald-500/10",
            busy && "pointer-events-none opacity-60",
          )}
        >
          {busy ? (
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          ) : (
            <FileUp className="h-8 w-8 text-emerald-400" />
          )}
          <p className="text-fg mt-3 text-base font-semibold">
            {busy
              ? "Reading and validating with Python…"
              : "Drag a file here or click to browse"}
          </p>
          <p className="text-fg-muted mt-1 max-w-md text-xs sm:text-sm">
            CSV or Excel (.xlsx), up to 100 MB. CAMPD facility files fill{" "}
            <code>facilities</code> and <code>units</code>; annual emissions
            files also fill <code>annual_records</code>.
          </p>
        </div>
      )}
    </Dialog>
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
          valueClassName="text-emerald-400"
          subtext="Will be imported"
        />
        <StatTile
          variant="card"
          label="Rejected"
          value={formatNumber(summary.invalidCount)}
          valueClassName={summary.invalidCount ? "text-red-400" : undefined}
          subtext="Not imported"
        />
        <StatTile
          variant="card"
          label="Duplicates"
          value={formatNumber(summary.duplicateCount)}
          valueClassName={summary.duplicateCount ? "text-amber-400" : undefined}
          subtext="Facility-unit-year, skipped"
        />
        <StatTile
          variant="card"
          label="Audit Flags"
          value={formatNumber(report.anomalies.length)}
          valueClassName={
            report.anomalies.length ? "text-amber-400" : undefined
          }
          subtext="Imported and flagged"
        />
      </KpiStrip>

      <div className="border-edge bg-surface/40 flex flex-wrap items-center gap-2 rounded-lg border p-3 text-xs">
        {report.missingRequired.length > 0 ? (
          <Badge variant="destructive">
            Missing required columns:{" "}
            {report.missingRequired
              .map((c) => `${c.table}.${c.column}`)
              .join(", ")}
          </Badge>
        ) : (
          <>
            <Database className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-fg font-semibold">Saves to</span>
            {report.destinationTables.map((table) => (
              <Badge key={table} variant="secondary" className="font-mono">
                {table}
              </Badge>
            ))}
            {report.destinationTables.includes("annual_records") && (
              <span className="text-fg-2 flex flex-wrap items-center gap-1.5 sm:ml-auto">
                <SourceBadge kind="db" />
                compared with stored records:
                <strong className="text-emerald-400">
                  {formatNumber(report.diff.inserted)} new
                </strong>
                ·
                <strong className="text-amber-400">
                  {formatNumber(report.diff.updated)} changed
                </strong>
                · {formatNumber(report.diff.unchanged)} unchanged
              </span>
            )}
          </>
        )}
      </div>

      <SegmentedControl
        value={tab}
        onChange={onTabChange}
        options={[
          { value: "preview", label: "Preview" },
          {
            value: "quality",
            label: `Data Quality (${formatNumber(summary.invalidCount + report.anomalies.length)})`,
          },
          {
            value: "duplicates",
            label: `Duplicates (${formatNumber(report.duplicates.length)})`,
          },
          { value: "columns", label: `Columns (${columns.length})` },
        ]}
      />

      {tab === "preview" && (
        <Section
          title={`First ${report.previewRows.length} of ${formatNumber(summary.totalRows)} rows`}
        >
          <ReportTable
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
        (report.duplicates.length === 0 ? (
          <EmptyState
            variant="success"
            title="No duplicate facility-unit-year records"
            description="Every row is unique in the file and new to the database."
          />
        ) : (
          <Section
            title="Duplicate facility-unit-year records"
            note="Repeats within the file keep the first row; records already in the database are updated."
          >
            <ReportTable
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

      {tab === "columns" && (
        <>
          <Section title="Schema mapping">
            <ReportTable
              head={[
                "File Column",
                "Table",
                "Database Column",
                "Required",
                "Missing Values",
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
          label="Annual Records"
          value={formatNumber(result.annualRecords)}
          subtext={`${formatNumber(result.diff.inserted)} new · ${formatNumber(result.diff.updated)} updated · ${formatNumber(result.diff.unchanged)} unchanged`}
        />
        <StatTile
          variant="card"
          label="Audit Flags"
          value={formatNumber(result.anomalies)}
          subtext="See the Audits tab"
        />
      </KpiStrip>
      <div className="flex flex-wrap items-center gap-2">
        {result.issues > 0 && (
          <a
            href={exportUrl("invalid", { id: result.datasetId })}
            download
            className={buttonClass({ variant: "outline", size: "sm" })}
          >
            <FileDown className="h-3.5 w-3.5 text-red-400" />
            Download rejected rows ({formatNumber(result.issues)})
          </a>
        )}
        <p className="text-fg-muted font-mono text-xs sm:ml-auto">
          Dataset ID {result.datasetId}
        </p>
      </div>
    </div>
  );
}
