import {
  deriveRates,
  evaluatePhysicalSanityRules,
  type EmissionTotals,
} from "./emissions-metrics";
import {
  countDiff,
  diffRecord,
  emptyDiffCounts,
  recordKey,
  type DiffCounts,
} from "./record-diff";

/** Upload contract shared by the import dialog, `/api/upload`, and `scripts/parse_import.py`. */

export const UPLOAD_EXTENSIONS = [".csv", ".tsv", ".xlsx", ".xlsm"];
const MAX_UPLOAD_MB = 100;

/** Why `file` can't be uploaded, or null. Checked in the browser and again by the API. */
export function checkUploadFile({
  name,
  size,
}: {
  name: string;
  size: number;
}) {
  const ext = /\.[^.]+$/.exec(name)?.[0].toLowerCase() ?? "";
  if (!UPLOAD_EXTENSIONS.includes(ext)) {
    return `Unsupported file type "${ext || name}". Upload a CSV or Excel (.xlsx) file.`;
  }
  if (size === 0) return "The file is empty.";
  const mb = size / 1024 ** 2;
  if (mb > MAX_UPLOAD_MB) {
    return `The file is ${mb.toFixed(1)} MB; the limit is ${MAX_UPLOAD_MB} MB.`;
  }
  return null;
}

export type RowStatus = "valid" | "flagged" | "duplicate" | "invalid";
type Cell = string | number | null;

export interface ParsedAnnualRecord extends EmissionTotals {
  rowNumber: number;
  facilityId: number;
  unitId: string;
  year: number;
}

/** JSON printed by `scripts/parse_import.py`. */
export interface ParsedUpload {
  targetSchema: "FACILITIES_AND_UNITS" | "ANNUAL_EMISSIONS" | "UNRECOGNIZED";
  destinationTables: string[];
  availableColumns: string[];
  tableMappings: {
    fileColumn: string;
    targetTable: string;
    targetColumn: string;
    required: boolean;
  }[];
  missingRequired: { table: string; column: string }[];
  unmappedColumns: string[];
  missingValueCounts: Record<string, number>;
  reportingYear: number | null;
  summary: {
    totalRows: number;
    validCount: number;
    invalidCount: number;
    duplicateCount: number;
  };
  validationErrors: {
    rowNumber: number;
    facilityId: string;
    unitId: string;
    field: string;
    value: string;
    reason: string;
  }[];
  duplicates: {
    rowNumber: number;
    firstSeenRow?: number;
    facilityId: number;
    unitId: string;
    year: Cell;
    reason: string;
  }[];
  previewRows: {
    rowNumber: number;
    status: RowStatus;
    data: Record<string, string>;
  }[];
  /** Every rejected/duplicate row, uncapped; stored in `import_issues`, not sent to the browser. */
  rejectedRows: {
    rowNumber: number;
    kind: "REJECTED" | "DUPLICATE";
    reason: string;
    data: Record<string, string>;
  }[];
  records: {
    facilities: (Record<string, Cell> & {
      id: number;
      name: string | null;
      stateCode: string | null;
    })[];
    units: (Record<string, Cell> & { facilityId: number; unitId: string })[];
    annual: ParsedAnnualRecord[];
  };
}

/** What the dialog previews: the parse report, the sanity flags the import will log, and how its records compare with the database. */
export type ImportReport = Omit<ParsedUpload, "records" | "rejectedRows"> & {
  diff: DiffCounts;
  anomalies: (ReturnType<typeof evaluatePhysicalSanityRules>[number] & {
    id: string;
    rowNumber: number;
  })[];
};

export interface ImportResult {
  datasetId: string;
  datasetName: string;
  source: string;
  facilities: number;
  units: number;
  annualRecords: number;
  anomalies: number;
  issues: number;
  archivedFile: string | null;
  diff: DiffCounts;
}

export const canImport = (
  r: Pick<ParsedUpload, "missingRequired" | "summary">,
) => r.missingRequired.length === 0 && r.summary.validCount > 0;

/**
 * Adds physical-sanity flags (the rules the import will log to `data_audit_logs`) and compares each
 * annual record with the stored facility-unit-year (`stored`, keyed by recordKey): new, changed, or unchanged.
 */
export function buildImportReport(
  { records, rejectedRows: _rejected, ...report }: ParsedUpload,
  stored: Map<string, EmissionTotals>,
): ImportReport {
  const diffs = records.annual.map((r) => ({
    r,
    ...diffRecord(r, stored.get(recordKey(r.facilityId, r.unitId, r.year))),
  }));
  const anomalies = records.annual.flatMap((r) =>
    evaluatePhysicalSanityRules({ ...r, ...deriveRates(r) }).map((flag) => ({
      ...flag,
      id: `${r.rowNumber}:${flag.flagType}`,
      rowNumber: r.rowNumber,
      details: `Row ${r.rowNumber} (plant ${r.facilityId}, unit ${r.unitId}): ${flag.details}`,
    })),
  );
  const flaggedRows = new Set(anomalies.map((a) => a.rowNumber));

  return {
    ...report,
    diff: diffs.reduce((c, d) => countDiff(c, d.status), emptyDiffCounts()),
    anomalies,
    previewRows: report.previewRows.map((row) =>
      row.status === "valid" && flaggedRows.has(row.rowNumber)
        ? { ...row, status: "flagged" }
        : row,
    ),
    duplicates: [
      ...report.duplicates,
      ...diffs
        .filter((d) => d.status !== "new")
        .map(({ r, status, changes }) => ({
          rowNumber: r.rowNumber,
          facilityId: r.facilityId,
          unitId: r.unitId,
          year: r.year,
          reason:
            status === "unchanged"
              ? "Already in the database with the same values (unchanged)"
              : `Already in the database; the import will update ${changes.map((c) => c.field).join(", ")}`,
        })),
    ],
  };
}
