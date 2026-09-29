"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  FileText,
  FileUp,
  Flame,
  Loader2,
  RefreshCw,
  Table as TableIcon,
  Upload,
  XCircle,
  Zap,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { DataPanel } from "~/components/ui/data-panel";
import { Dialog, DialogTitle } from "~/components/ui/dialog";
import { EmptyState } from "~/components/ui/empty-state";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { KpiStrip, StatTile } from "~/components/ui/stat-tile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  type CommitResponse,
  type DuplicateRecordItem,
  type PreviewRow,
  type PythonValidationReport,
  type UploadResponse,
  type ValidationErrorItem,
} from "~/lib/data-import-types";
import { cn, formatQuantity } from "~/lib/utils";

type DialogTab = "preview" | "report" | "duplicates" | "schema";

interface DataUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
  onNavigateTab?: (tab: "explorer" | "audit") => void;
}

export function DataUploadDialog({
  open,
  onOpenChange,
  onImportComplete,
  onNavigateTab,
}: DataUploadDialogProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploadData, setUploadData] = useState<UploadResponse | null>(null);
  const [commitData, setCommitData] = useState<CommitResponse | null>(null);
  const [activeTab, setActiveTab] = useState<DialogTab>("preview");
  const [previewPage, setPreviewPage] = useState(1);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pageSize = 15;

  const resetState = () => {
    setIsDragging(false);
    setIsUploading(false);
    setIsCommitting(false);
    setError(null);
    setUploadData(null);
    setCommitData(null);
    setActiveTab("preview");
    setPreviewPage(1);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handleFileProcess = async (selectedFile: File) => {
    setError(null);
    setCommitData(null);
    setUploadData(null);

    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (!ext || !["csv", "tsv", "xlsx", "xlsm"].includes(ext)) {
      setError(
        "Unsupported file extension. Please select a CSV or Excel (.xlsx) file.",
      );
      return;
    }

    if (selectedFile.size > 100 * 1024 * 1024) {
      setError(
        `File is too large (${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed is 100MB.`,
      );
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const json = (await res.json()) as
        | UploadResponse
        | { error?: string };

      if (!res.ok || !("stagedId" in json)) {
        const errorMsg =
          "error" in json && typeof json.error === "string"
            ? json.error
            : "Failed to parse upload file.";
        throw new Error(errorMsg);
      }

      setUploadData(json);
      setActiveTab("preview");
      setPreviewPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) void handleFileProcess(droppedFile);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const chosenFile = e.target.files?.[0];
    if (chosenFile) void handleFileProcess(chosenFile);
  };

  const handleApproveImport = async () => {
    if (!uploadData?.stagedId) return;

    setIsCommitting(true);
    setError(null);

    try {
      const res = await fetch("/api/upload/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stagedId: uploadData.stagedId,
          fileName: uploadData.fileName,
          fileExtension: uploadData.fileExtension,
        }),
      });

      const json = (await res.json()) as CommitResponse | { error?: string };
      if (!res.ok || !("datasetId" in json)) {
        const errorMsg =
          "error" in json && typeof json.error === "string"
            ? json.error
            : "Failed to commit import to database.";
        throw new Error(errorMsg);
      }

      setCommitData(json);
      onImportComplete?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to commit records.",
      );
    } finally {
      setIsCommitting(false);
    }
  };

  const report: PythonValidationReport | undefined = uploadData?.report;
  const isCompatible = report?.schemaComparison.isSchemaCompatible ?? false;
  const canApprove =
    isCompatible && (report?.summary.validCount ?? 0) > 0 && !isCommitting;

  const previewRows: PreviewRow[] = report?.previewRows ?? [];
  const totalPreviewPages = Math.ceil(previewRows.length / pageSize) || 1;
  const pagedRows = previewRows.slice(
    (previewPage - 1) * pageSize,
    previewPage * pageSize,
  );

  const validationErrors: ValidationErrorItem[] =
    report?.validationErrors ?? [];
  const duplicates: DuplicateRecordItem[] = report?.duplicates ?? [];
  const totalQualityIssues =
    validationErrors.length + (report?.anomalies.length ?? 0);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="upload"
      closeLabel="Close Importer"
      header={
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 font-mono text-xs font-semibold text-emerald-400">
                <Database className="h-3.5 w-3.5" />
                Data Ingestion Engine
              </span>
              <Badge variant="outline" className="font-mono text-[11px]">
                Python CSV / Excel
              </Badge>
              {report?.targetSchema && (
                <Badge variant="sky" className="font-mono text-[11px]">
                  {report.targetSchema.replace(/_/g, " ")}
                </Badge>
              )}
            </div>
            {uploadData && !commitData && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 gap-1.5 px-2.5 text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                <RefreshCw className="h-3 w-3" />
                Select Another File
              </Button>
            )}
          </div>

          <DialogTitle>Import Power & Emissions Data</DialogTitle>
          <p className="text-fg-muted text-xs sm:text-sm">
            Upload CSV or Excel files to automatically parse with Python, validate
            against project schemas, detect facility-unit-year duplicates, and audit
            physical bounds before database commit.
          </p>
        </div>
      }
      footer={
        commitData ? (
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <span className="text-fg-muted font-mono text-xs">
              Preserved file: {commitData.preservedFilePath}
            </span>
            <div className="flex items-center gap-2">
              {onNavigateTab && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onNavigateTab("explorer");
                      handleClose();
                    }}
                  >
                    View Facilities Explorer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onNavigateTab("audit");
                      handleClose();
                    }}
                  >
                    View Audit Logs
                  </Button>
                </>
              )}
              <Button size="sm" onClick={resetState}>
                Upload Another File
              </Button>
            </div>
          </div>
        ) : uploadData ? (
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <FileSpreadsheet className="text-fg-muted h-4 w-4" />
              <span className="text-fg font-medium">{uploadData.fileName}</span>
              <span className="text-fg-muted font-mono">
                ({(uploadData.fileSize / 1024).toFixed(1)} KB)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={resetState}>
                Discard
              </Button>
              <Button
                size="sm"
                disabled={!canApprove}
                onClick={() => void handleApproveImport()}
                className="gap-1.5"
              >
                {isCommitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Committing to Database...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve & Import ({formatQuantity(report?.summary.validCount ?? 0, "records")})
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv,.xlsx,.xlsm"
        className="hidden"
        onChange={handleFileChange}
      />

      {error && (
        <div className="border-red-500/40 bg-red-500/10 text-red-400 flex items-start gap-2.5 rounded-lg border p-3 text-xs sm:text-sm">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-semibold">Upload or Validation Error</p>
            <p className="text-fg-2">{error}</p>
          </div>
        </div>
      )}

      {/* COMMIT SUCCESS SCREEN */}
      {commitData && (
        <div className="space-y-5 py-4">
          <div className="border-edge bg-surface/50 rounded-xl border p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-fg text-xl font-bold tracking-tight">
              Data Import Successfully Committed!
            </h3>
            <p className="text-fg-muted mx-auto mt-1 max-w-lg text-sm">
              Records were processed with Python, validated, and stored in the SQLite
              database. Dataset provenance metadata and original file are preserved.
            </p>
          </div>

          <KpiStrip className="grid-cols-2 sm:grid-cols-4">
            <StatTile
              variant="card"
              label="Dataset ID"
              value={commitData.datasetId.slice(0, 8)}
              subtext="Unique batch identifier"
              icon={<Database className="h-4 w-4 text-sky-400" />}
            />
            <StatTile
              variant="card"
              label="Facilities Saved"
              value={formatQuantity(commitData.result.facilitiesUpserted)}
              subtext="Master power plant rows"
              icon={<Zap className="h-4 w-4 text-emerald-400" />}
            />
            <StatTile
              variant="card"
              label="Units Upserted"
              value={formatQuantity(commitData.result.unitsUpserted)}
              subtext="Boilers / Turbines"
              icon={<TableIcon className="h-4 w-4 text-amber-400" />}
            />
            <StatTile
              variant="card"
              label="Audit Flags Logged"
              value={formatQuantity(commitData.result.anomaliesLogged)}
              subtext="Sanity anomalies"
              icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
            />
          </KpiStrip>

          <DataPanel className="p-4">
            <div className="mb-3 flex items-center gap-2 border-b border-edge/60 pb-2">
              <FileText className="h-4 w-4 text-emerald-400" />
              <h4 className="text-fg text-xs font-semibold uppercase tracking-wider">
                Data Provenance & Archival
              </h4>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-edge/60 py-1.5">
                <span className="text-fg-muted">Dataset Name</span>
                <span className="text-fg font-mono font-medium">{commitData.result.datasetName}</span>
              </div>
              <div className="flex items-center justify-between border-b border-edge/60 py-1.5">
                <span className="text-fg-muted">Source Channel</span>
                <Badge variant="outline">{commitData.result.source}</Badge>
              </div>
              <div className="flex items-center justify-between border-b border-edge/60 py-1.5">
                <span className="text-fg-muted">Reporting Year</span>
                <span className="text-fg font-mono">{commitData.result.reportingYear}</span>
              </div>
              <div className="flex items-center justify-between border-b border-edge/60 py-1.5">
                <span className="text-fg-muted">Archived Original File</span>
                <span className="text-emerald-400 font-mono">{commitData.preservedFilePath}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-fg-muted">Total Raw Records Processed</span>
                <span className="text-fg font-mono">{commitData.result.rawRecordCount.toLocaleString()}</span>
              </div>
            </div>
          </DataPanel>
        </div>
      )}

      {/* INITIAL DROP ZONE / UPLOAD FORM */}
      {!uploadData && !commitData && (
        <div className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-edge bg-surface/30 hover:border-emerald-500/60 hover:bg-emerald-500/5 group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all duration-150 sm:p-12",
              isDragging && "border-emerald-500 bg-emerald-500/10 shadow-lg",
              isUploading && "pointer-events-none opacity-60",
            )}
          >
            <div className="border-edge bg-surface flex h-14 w-14 items-center justify-center rounded-2xl border shadow-sm transition-transform duration-150 group-hover:scale-105">
              {isUploading ? (
                <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
              ) : (
                <FileUp className="h-7 w-7 text-emerald-400" />
              )}
            </div>

            <h3 className="text-fg mt-4 text-base font-semibold sm:text-lg">
              {isUploading
                ? "Reading and Validating File with Python..."
                : isDragging
                  ? "Drop your dataset file here"
                  : "Drag and drop your dataset here"}
            </h3>

            <p className="text-fg-muted mt-1 max-w-sm text-xs sm:text-sm">
              Supports <strong className="text-fg font-mono">.csv</strong>,{" "}
              <strong className="text-fg font-mono">.tsv</strong>, and{" "}
              <strong className="text-fg font-mono">.xlsx</strong> files up to
              100MB.
            </p>

            <Button
              variant="outline"
              size="sm"
              className="mt-5 pointer-events-none gap-1.5"
            >
              <Upload className="h-3.5 w-3.5 text-emerald-400" />
              Select File from Disk
            </Button>
          </div>

          <div className="border-edge bg-surface/40 rounded-lg border p-4">
            <h4 className="text-fg text-xs font-semibold tracking-wider uppercase">
              Supported CAMPD Datasets & Required Schemas
            </h4>
            <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="border-edge/60 bg-canvas/50 space-y-1 rounded-md border p-3">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <Zap className="h-3.5 w-3.5" />
                  Facilities & Units Registry (e.g. facility-2025.csv)
                </span>
                <p className="text-fg-muted text-xs leading-relaxed">
                  Requires <code className="text-fg">Facility ID</code>,{" "}
                  <code className="text-fg">Facility Name</code>,{" "}
                  <code className="text-fg">State</code>,{" "}
                  <code className="text-fg">Unit ID</code>. Maps to{" "}
                  <code className="text-emerald-400">facilities</code> and{" "}
                  <code className="text-emerald-400">units</code> tables.
                </p>
              </div>

              <div className="border-edge/60 bg-canvas/50 space-y-1 rounded-md border p-3">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-sky-400">
                  <Flame className="h-3.5 w-3.5" />
                  Annual Apportioned Emissions
                </span>
                <p className="text-fg-muted text-xs leading-relaxed">
                  Requires <code className="text-fg">Facility ID</code>,{" "}
                  <code className="text-fg">Unit ID</code>,{" "}
                  <code className="text-fg">Year</code>, Gross Load, Heat Input,
                  CO2 Mass. Maps to{" "}
                  <code className="text-sky-400">annual_records</code> and{" "}
                  <code className="text-sky-400">data_audit_logs</code>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW & VALIDATION REPORT STATE */}
      {uploadData && !commitData && report && (
        <div className="space-y-4">
          {/* KPI Summary strip */}
          <KpiStrip className="grid-cols-2 sm:grid-cols-5">
            <StatTile
              variant="card"
              label="Total Rows"
              value={formatQuantity(report.summary.totalRows)}
              subtext={`${report.availableColumns.length} columns`}
              icon={<TableIcon className="h-4 w-4 text-fg-muted" />}
            />
            <StatTile
              variant="card"
              label="Valid Records"
              value={formatQuantity(report.summary.validCount)}
              valueClassName="text-emerald-400"
              subtext="Ready to import"
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
            />
            <StatTile
              variant="card"
              label="Rejected / Invalid"
              value={formatQuantity(report.summary.invalidCount)}
              valueClassName={report.summary.invalidCount > 0 ? "text-red-400" : undefined}
              subtext="Will be skipped"
              icon={<XCircle className="h-4 w-4 text-red-400" />}
            />
            <StatTile
              variant="card"
              label="Duplicates"
              value={formatQuantity(report.summary.duplicateCount)}
              valueClassName={report.summary.duplicateCount > 0 ? "text-amber-400" : undefined}
              subtext="Facility-Unit-Year"
              icon={<RefreshCw className="h-4 w-4 text-amber-400" />}
            />
            <StatTile
              variant="card"
              label="Audit Anomalies"
              value={formatQuantity(report.summary.flaggedCount)}
              valueClassName={report.summary.flaggedCount > 0 ? "text-amber-400" : undefined}
              subtext="Physics sanity flags"
              icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
            />
          </KpiStrip>

          {/* Database Destination Banner */}
          <div className="border-edge bg-surface/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 sm:px-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-fg flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                <Database className="h-3.5 w-3.5 text-emerald-400" />
                Target Database Destination:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {report.destinationTables.map((tbl) => (
                  <Badge key={tbl} variant="secondary" className="font-mono text-xs">
                    {tbl}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isCompatible ? (
                <Badge variant="success" className="gap-1 font-mono text-xs">
                  <CheckCircle2 className="h-3 w-3" />
                  Schema Match: {report.schemaComparison.matchedCount} of{" "}
                  {report.schemaComparison.totalColumns} cols
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1 font-mono text-xs">
                  <AlertTriangle className="h-3 w-3" />
                  Missing Required Schema Fields
                </Badge>
              )}
            </div>
          </div>

          {/* Sub-view switcher */}
          <div className="flex items-center justify-between">
            <SegmentedControl
              value={activeTab}
              onChange={setActiveTab}
              options={[
                {
                  value: "preview",
                  label: `Preview (${previewRows.length})`,
                  icon: <TableIcon className="h-3.5 w-3.5 text-emerald-400" />,
                },
                {
                  value: "report",
                  label: (
                    <>
                      Validation Report{" "}
                      {totalQualityIssues > 0 && (
                        <Badge
                          variant={validationErrors.length > 0 ? "destructive" : "warning"}
                          className="px-1 py-0 font-mono text-[10px]"
                        >
                          {totalQualityIssues}
                        </Badge>
                      )}
                    </>
                  ),
                  icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />,
                },
                {
                  value: "duplicates",
                  label: (
                    <>
                      Duplicates{" "}
                      {duplicates.length > 0 && (
                        <Badge variant="secondary" className="px-1 py-0 font-mono text-[10px]">
                          {duplicates.length}
                        </Badge>
                      )}
                    </>
                  ),
                },
                {
                  value: "schema",
                  label: `Columns & Schema (${report.availableColumns.length})`,
                },
              ]}
            />
          </div>

          {/* TAB 1: DATA PREVIEW */}
          {activeTab === "preview" && (
            <div className="border-edge bg-surface/30 space-y-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-fg-muted font-medium">
                  Showing rows {(previewPage - 1) * pageSize + 1}–
                  {Math.min(previewPage * pageSize, previewRows.length)} of{" "}
                  {previewRows.length} previewed records
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    disabled={previewPage <= 1}
                    onClick={() => setPreviewPage((p) => Math.max(p - 1, 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-fg-muted font-mono text-xs">
                    Page {previewPage} / {totalPreviewPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    disabled={previewPage >= totalPreviewPages}
                    onClick={() =>
                      setPreviewPage((p) => Math.min(p + 1, totalPreviewPages))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border border-edge/60">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-surface-2/60">
                      <TableHead className="w-16 font-mono text-xs">Row #</TableHead>
                      <TableHead className="w-20 font-mono text-xs">Status</TableHead>
                      {report.availableColumns.slice(0, 10).map((col) => (
                        <TableHead key={col} className="whitespace-nowrap font-mono text-xs">
                          {col}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedRows.map((row) => (
                      <TableRow
                        key={row.rowNumber}
                        className={cn(
                          row.status === "invalid" && "bg-red-500/10",
                          row.status === "duplicate" && "bg-purple-500/10",
                          row.status === "warning" && "bg-amber-500/10",
                        )}
                      >
                        <TableCell className="font-mono text-xs font-semibold">
                          #{row.rowNumber}
                        </TableCell>
                        <TableCell>
                          {row.status === "valid" && (
                            <Badge variant="success" className="text-[10px]">
                              Valid
                            </Badge>
                          )}
                          {row.status === "invalid" && (
                            <Badge variant="destructive" className="text-[10px]">
                              Invalid
                            </Badge>
                          )}
                          {row.status === "duplicate" && (
                            <Badge variant="secondary" className="text-[10px]">
                              Duplicate
                            </Badge>
                          )}
                          {row.status === "warning" && (
                            <Badge variant="warning" className="text-[10px]">
                              Anomaly
                            </Badge>
                          )}
                        </TableCell>
                        {report.availableColumns.slice(0, 10).map((col) => (
                          <TableCell
                            key={col}
                            className="max-w-[180px] truncate font-mono text-xs"
                          >
                            {row.data[col] ?? "—"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* TAB 2: DATA QUALITY & VALIDATION REPORT */}
          {activeTab === "report" && (
            <div className="space-y-4">
              {validationErrors.length === 0 && report.anomalies.length === 0 ? (
                <EmptyState
                  variant="success"
                  title="No Data Quality Issues Detected"
                  description="All rows conform strictly to required project schema, non-negative values, coordinate ranges, and thermodynamic physical bounds."
                />
              ) : (
                <div className="space-y-4">
                  {validationErrors.length > 0 && (
                    <DataPanel className="p-4">
                      <div className="mb-2 flex items-center gap-2 border-b border-edge/60 pb-2">
                        <XCircle className="h-4 w-4 text-red-400" />
                        <h4 className="text-fg text-xs font-semibold uppercase tracking-wider">
                          Invalid Records ({validationErrors.length} Rejected)
                        </h4>
                      </div>
                      <p className="text-fg-muted mb-3 text-xs">
                        The system must not silently discard invalid records. These rows
                        contain malformed keys or missing required fields and will be
                        omitted from database commit:
                      </p>
                      <div className="overflow-x-auto rounded-md border border-edge/60">
                        <Table className="text-xs">
                          <TableHeader>
                            <TableRow className="bg-surface-2/60">
                              <TableHead className="w-16 font-mono">Row</TableHead>
                              <TableHead className="font-mono">Facility / Unit</TableHead>
                              <TableHead className="font-mono">Field</TableHead>
                              <TableHead className="font-mono">Received Value</TableHead>
                              <TableHead className="font-mono">Issue Description</TableHead>
                              <TableHead className="font-mono">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {validationErrors.map((err, i) => (
                              <TableRow key={i} className="bg-red-500/5">
                                <TableCell className="font-mono font-semibold">
                                  #{err.rowNumber}
                                </TableCell>
                                <TableCell className="font-mono">
                                  {err.facilityId} : {err.unitId}
                                </TableCell>
                                <TableCell className="font-medium text-amber-400">
                                  {err.field}
                                </TableCell>
                                <TableCell className="font-mono text-red-400">
                                  {err.value ? err.value : "—"}
                                </TableCell>
                                <TableCell>{err.reason}</TableCell>
                                <TableCell>
                                  <Badge variant="destructive">{err.action}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </DataPanel>
                  )}

                  {report.anomalies.length > 0 && (
                    <DataPanel className="p-4">
                      <div className="mb-2 flex items-center gap-2 border-b border-edge/60 pb-2">
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                        <h4 className="text-fg text-xs font-semibold uppercase tracking-wider">
                          Physical Sanity & Thermodynamic Flags ({report.anomalies.length} Flagged)
                        </h4>
                      </div>
                      <p className="text-fg-muted mb-3 text-xs">
                        Records flagged for physics violations will be saved but recorded in
                        the <code className="text-amber-400">data_audit_logs</code> table:
                      </p>
                      <div className="overflow-x-auto rounded-md border border-edge/60">
                        <Table className="text-xs">
                          <TableHeader>
                            <TableRow className="bg-surface-2/60">
                              <TableHead className="w-16 font-mono">Row</TableHead>
                              <TableHead className="font-mono">Plant / Unit</TableHead>
                              <TableHead className="font-mono">Violation Flag</TableHead>
                              <TableHead className="font-mono">Severity</TableHead>
                              <TableHead className="font-mono">Diagnostic Details</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {report.anomalies.map((anom, i) => (
                              <TableRow key={i} className="bg-amber-500/5">
                                <TableCell className="font-mono font-semibold">
                                  #{anom.rowNumber}
                                </TableCell>
                                <TableCell className="font-mono">
                                  Plant #{anom.facilityId} : Unit {anom.unitId}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="font-mono">
                                    {anom.flagType}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={anom.severity === "ERROR" ? "destructive" : "warning"}
                                  >
                                    {anom.severity}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-fg-2">{anom.details}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </DataPanel>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DUPLICATES */}
          {activeTab === "duplicates" && (
            <div className="space-y-3">
              {duplicates.length === 0 ? (
                <EmptyState
                  variant="success"
                  title="No Duplicate Facility-Unit-Year Records"
                  description="All generator rows in this file represent unique facility-unit combinations."
                />
              ) : (
                <div className="border-edge bg-surface/30 space-y-2 rounded-lg border p-4">
                  <p className="text-fg-muted text-xs">
                    Identified {duplicates.length} duplicate facility-unit-year records. In SQLite,
                    subsequent entries will update existing attributes (upsert strategy):
                  </p>
                  <div className="overflow-x-auto rounded-md border border-edge/60">
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow className="bg-surface-2/60">
                          <TableHead className="w-16 font-mono">Row</TableHead>
                          <TableHead className="font-mono">Facility ID</TableHead>
                          <TableHead className="font-mono">Unit ID</TableHead>
                          <TableHead className="font-mono">Year</TableHead>
                          <TableHead className="font-mono">Duplicate Source</TableHead>
                          <TableHead className="font-mono">Resolution</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {duplicates.map((dup, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono font-semibold">
                              #{dup.rowNumber}
                            </TableCell>
                            <TableCell className="font-mono font-semibold text-emerald-400">
                              {dup.facilityId}
                            </TableCell>
                            <TableCell className="font-mono">{dup.unitId}</TableCell>
                            <TableCell className="font-mono">{dup.year}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {dup.firstSeenRow
                                  ? `First seen on row #${dup.firstSeenRow}`
                                  : "Existing in Database"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-fg-muted text-[11px]">
                              {dup.reason}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: COLUMNS & SCHEMA BREAKDOWN */}
          {activeTab === "schema" && (
            <div className="space-y-4">
              <DataPanel className="p-4">
                <div className="mb-3 flex items-center gap-2 border-b border-edge/60 pb-2">
                  <Database className="h-4 w-4 text-emerald-400" />
                  <h4 className="text-fg text-xs font-semibold uppercase tracking-wider">
                    Database Field Mappings & Schema Match
                  </h4>
                </div>
                <div className="overflow-x-auto rounded-md border border-edge/60">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow className="bg-surface-2/60">
                        <TableHead className="font-mono">Uploaded File Column</TableHead>
                        <TableHead className="font-mono">Destination Table</TableHead>
                        <TableHead className="font-mono">Target DB Field</TableHead>
                        <TableHead className="font-mono">Requirement</TableHead>
                        <TableHead className="font-mono">Missing Values in File</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.schemaComparison.tableMappings.map((map, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono font-semibold text-fg">
                            {map.fileColumn}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-mono">
                              {map.targetTable}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-emerald-400">
                            {map.targetColumn}
                          </TableCell>
                          <TableCell>
                            {map.required ? (
                              <Badge variant="success">Required</Badge>
                            ) : (
                              <Badge variant="outline">Optional</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-fg-muted">
                            {report.missingValueCounts[map.fileColumn] ?? 0} missing
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </DataPanel>

              {report.schemaComparison.unmappedColumns.length > 0 && (
                <DataPanel className="p-4">
                  <div className="mb-2 flex items-center gap-2 border-b border-edge/60 pb-2">
                    <ArrowRight className="h-4 w-4 text-fg-muted" />
                    <h4 className="text-fg text-xs font-semibold uppercase tracking-wider">
                      Unmapped Extra Columns ({report.schemaComparison.unmappedColumns.length})
                    </h4>
                  </div>
                  <p className="text-fg-muted mb-2 text-xs">
                    These columns exist in the uploaded file but do not correspond to any active
                    database schema columns. They will be ignored during database commit:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {report.schemaComparison.unmappedColumns.map((col) => (
                      <Badge key={col} variant="outline" className="font-mono text-xs">
                        {col}
                      </Badge>
                    ))}
                  </div>
                </DataPanel>
              )}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
