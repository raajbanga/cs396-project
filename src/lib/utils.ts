import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { SortDirection } from "./facility-filters";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type SortValue = string | number | Date | null | undefined;

const isMissing = (v: SortValue) =>
  v === null || v === undefined || v === "" || v === "—";

/** Dates and formatted numbers ("1,234.5") as numbers; anything else unchanged. */
const sortable = (v: SortValue) =>
  v instanceof Date
    ? v.getTime()
    : typeof v === "string" && /^-?[\d,]*\.?\d+$/.test(v.trim())
      ? Number(v.replace(/,/g, ""))
      : v;

/** Whether a value sorts as a number (so its column starts highest-first). */
export const isNumericValue = (v: SortValue) => typeof sortable(v) === "number";

/** Ascending order for table cells: numbers and dates numerically, text naturally ("Unit 2" < "Unit 10"). */
export function compareValues(a: SortValue, b: SortValue) {
  const x = sortable(a);
  const y = sortable(b);
  return typeof x === "number" && typeof y === "number"
    ? x - y
    : String(x).localeCompare(String(y), undefined, { numeric: true });
}

/** Client-side sort for small tables: stable, and missing values stay last in either direction. */
export function sortRows<T>(
  rows: readonly T[],
  key: (row: T) => SortValue,
  dir: SortDirection,
) {
  return rows
    .map((row, i) => ({ row, i, v: key(row) }))
    .sort((a, b) => {
      if (isMissing(a.v) || isMissing(b.v)) {
        return Number(isMissing(a.v)) - Number(isMissing(b.v)) || a.i - b.i;
      }
      const c = compareValues(a.v, b.v);
      return (dir === "asc" ? c : -c) || a.i - b.i;
    })
    .map(({ row }) => row);
}

/** Distinct non-empty strings, in first-seen order. */
export const uniqueStrings = (values: (string | null | undefined)[]) =>
  [...new Set(values)].filter((v): v is string => Boolean(v));

/** Locale-formatted quantity with an optional unit; zero/missing renders `fallback`. */
export function formatQuantity(
  value: number | null | undefined,
  unit = "",
  { fallback = "—", digits = 0 } = {},
) {
  if (!value) return fallback;
  const num = value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
  return unit ? `${num} ${unit}` : num;
}

/** Plain number for tables and counts; zero/missing renders "0". */
export const formatNumber = (value: number | null | undefined, digits = 0) =>
  formatQuantity(value, "", { digits, fallback: "0" });

/** Display names for `datasets.source`. */
const DATASET_SOURCE_LABELS: Record<string, string> = {
  API: "EPA CAMPD API",
  BULK_CSV: "CSV upload",
  BULK_EXCEL: "Excel upload",
};

export const sourceLabel = (source: string) =>
  DATASET_SOURCE_LABELS[source] ?? source;

/** Where a record came from, e.g. "EPA CAMPD API · 10/7/2026". */
export const datasetOriginLabel = (d: {
  source: string;
  importedAt: Date | number;
}) =>
  `${sourceLabel(d.source)} · ${new Date(d.importedAt).toLocaleDateString()}`;

/** A dataset's history status: a failed retrieval, superseded by a later one, or active. */
export const datasetStatus = (d: {
  notes: string | null;
  superseded: boolean;
}) =>
  d.notes?.startsWith("Error")
    ? ("Error" as const)
    : d.superseded
      ? ("Superseded" as const)
      : ("Active" as const);
