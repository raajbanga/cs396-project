import {
  TOTAL_KEYS,
  type EmissionTotals,
  type ReportedTotals,
} from "./emissions-metrics";

/** How an incoming unit-year compares with what the database already holds. */
export type DiffStatus = "new" | "changed" | "unchanged";

/** §7 per-year control and program information stored on each annual record. */
export const RECORD_ATTRIBUTE_KEYS = [
  "so2Controls",
  "noxControls",
  "pmControls",
  "hgControls",
  "programCode",
] as const;
export type RecordAttributes = Record<
  (typeof RECORD_ATTRIBUTE_KEYS)[number],
  string | null
>;

/** A record's comparable fields: metrics, plus the per-year attributes when the source has them. */
export type ComparableRecord = ReportedTotals & Partial<RecordAttributes>;

export interface FieldChange {
  field: keyof EmissionTotals | keyof RecordAttributes;
  database: number | string | null;
  incoming: number | string | null;
}

export interface DiffCounts {
  inserted: number;
  updated: number;
  unchanged: number;
}

/** Natural key of a unit-year record, shared by uploads, CAMPD rows, and stored records. */
export const recordKey = (
  facilityId: number,
  unitId: string,
  year: number | string,
) => `${facilityId}:${unitId}:${year}`;

/**
 * Equal within floating-point noise (relative 1e-9), so re-reading the same CAMPD value counts as
 * unchanged; null (not reported) equals only null.
 */
const sameMetric = (a: number | null, b: number | null) =>
  a === null || b === null
    ? a === b
    : Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/**
 * New when nothing is stored; otherwise every metric that differs from the stored value, and every
 * per-year attribute the incoming record carries (uploads without control columns don't compare them).
 */
export function diffRecord(
  incoming: ComparableRecord,
  stored?: ComparableRecord,
): { status: DiffStatus; changes: FieldChange[] } {
  if (!stored) return { status: "new", changes: [] };
  const changes: FieldChange[] = [
    ...TOTAL_KEYS.filter((k) => !sameMetric(incoming[k], stored[k])),
    ...RECORD_ATTRIBUTE_KEYS.filter(
      (k) =>
        incoming[k] !== undefined &&
        (incoming[k] ?? null) !== (stored[k] ?? null),
    ),
  ].map((field) => ({
    field,
    database: stored[field] ?? null,
    incoming: incoming[field] ?? null,
  }));
  return { status: changes.length ? "changed" : "unchanged", changes };
}

export const emptyDiffCounts = (): DiffCounts => ({
  inserted: 0,
  updated: 0,
  unchanged: 0,
});

export function countDiff(counts: DiffCounts, status: DiffStatus) {
  if (status === "new") counts.inserted++;
  else if (status === "changed") counts.updated++;
  else counts.unchanged++;
  return counts;
}
