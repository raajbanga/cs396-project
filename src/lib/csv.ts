/** §10 CSV downloads: the one CSV writer and the `/api/export` URL contract shared by the dialog and the route. */

export const EXPORT_TYPES = [
  "dataset",
  "valid",
  "invalid",
  "search",
  "selection",
  "provenance",
] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];

type CsvValue = string | number | boolean | Date | object | null | undefined;

/** A CSV column: header plus how a row's value is read. */
export type CsvColumn<T> = [header: string, value: (row: T) => CsvValue];

/** One RFC 4180 field: quoted when it holds a comma, quote, or line break; quotes doubled. */
export function csvField(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Header line plus one line per row, CRLF-terminated (RFC 4180). */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]) {
  const line = (fields: CsvValue[]) => fields.map(csvField).join(",") + "\r\n";
  return (
    line(columns.map(([header]) => header)) +
    rows.map((row) => line(columns.map(([, value]) => value(row)))).join("")
  );
}

/** `/api/export` link; `query` is extra params, e.g. `explorerSearchParams(...)` for search results. */
export function exportUrl(
  type: ExportType,
  params: Record<string, string | undefined> = {},
  query = "",
) {
  const search = new URLSearchParams({ type });
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return `/api/export?${[search.toString(), query].filter(Boolean).join("&")}`;
}
