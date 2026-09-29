export interface ColumnMapping {
  fileColumn: string;
  targetTable: string;
  targetColumn: string;
  required: boolean;
}

export interface MissingRequiredColumn {
  table: string;
  column: string;
  description: string;
}

export interface SchemaComparison {
  targetSchema: string;
  matchedCount: number;
  totalColumns: number;
  tableMappings: ColumnMapping[];
  missingRequired: MissingRequiredColumn[];
  unmappedColumns: string[];
  isSchemaCompatible: boolean;
}

export interface UploadSummary {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  flaggedCount: number;
  canImport: boolean;
}

export interface ValidationErrorItem {
  rowNumber: number;
  facilityId: string | number;
  unitId: string;
  field: string;
  value: string;
  reason: string;
  severity: "ERROR" | "WARN";
  action: string;
}

export interface DuplicateRecordItem {
  rowNumber: number;
  firstSeenRow?: number;
  facilityId: string | number;
  unitId: string;
  year: string;
  duplicateType: string;
  reason: string;
}

export interface AnomalyItem {
  rowNumber: number;
  facilityId: string | number;
  unitId: string;
  flagType: string;
  severity: "WARN" | "ERROR";
  details: string;
}

export interface RowIssue {
  field: string;
  value?: string;
  issue: string;
  severity: "ERROR" | "WARN";
}

export interface PreviewRow {
  rowNumber: number;
  data: Record<string, string>;
  status: "valid" | "warning" | "invalid" | "duplicate";
  issues: RowIssue[];
}

export interface PythonValidationReport {
  fileName: string;
  fileSize: number;
  fileExtension: string;
  totalRows: number;
  availableColumns: string[];
  targetSchema: string;
  destinationTables: string[];
  schemaComparison: SchemaComparison;
  summary: UploadSummary;
  validationErrors: ValidationErrorItem[];
  duplicates: DuplicateRecordItem[];
  anomalies: AnomalyItem[];
  missingValueCounts: Record<string, number>;
  previewRows: PreviewRow[];
  error?: string;
}

export interface PythonCommitResult {
  success: boolean;
  datasetId: string;
  datasetName: string;
  source: string;
  reportingYear: number;
  rawRecordCount: number;
  validRecordsCount: number;
  facilitiesUpserted: number;
  unitsUpserted: number;
  annualRecordsUpserted: number;
  anomaliesLogged: number;
  error?: string;
}

export interface UploadResponse {
  stagedId: string;
  fileName: string;
  fileExtension: string;
  fileSize: number;
  report: PythonValidationReport;
}

export interface CommitResponse {
  success: boolean;
  datasetId: string;
  preservedFilePath: string;
  result: PythonCommitResult;
}
