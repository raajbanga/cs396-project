import { TOTAL_KEYS, type EmissionTotals } from "./emissions-metrics";

/** How an incoming unit-year compares with what the database already holds. */
export type DiffStatus = "new" | "changed" | "unchanged";

export interface FieldChange {
  field: keyof EmissionTotals;
  database: number;
  incoming: number;
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

/** Equal within floating-point noise (relative 1e-9), so re-reading the same CAMPD value counts as unchanged. */
const same = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** New when nothing is stored; otherwise every metric that differs from the stored value. */
export function diffRecord(
  incoming: EmissionTotals,
  stored?: EmissionTotals,
): { status: DiffStatus; changes: FieldChange[] } {
  if (!stored) return { status: "new", changes: [] };
  const changes = TOTAL_KEYS.filter((k) => !same(incoming[k], stored[k])).map(
    (field) => ({ field, database: stored[field], incoming: incoming[field] }),
  );
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
