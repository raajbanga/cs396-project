import { strToU8, zipSync } from "fflate";

import { toCsv, type CsvColumn, type CsvValue } from "~/lib/csv";

/**
 * Phase 2 §7 exports: every analysis download is a ZIP of the data as CSV, a metadata.json that
 * makes it reproducible (when, from which data, with which filters, definitions, factors, and
 * model), and the chart image when there is one.
 */

/** What every export from a page shares; tabs add their own fields (variables, model, …). */
export type ExportMetadata = Record<string, unknown>;

export interface ExportTable {
  head: readonly string[];
  rows: readonly CsvValue[][];
}

export const tableCsv = ({ head, rows }: ExportTable) =>
  toCsv(
    rows,
    head.map((h, i): CsvColumn<readonly CsvValue[]> => [h, (r) => r[i]]),
  );

/** ZIP bytes of `<name>.csv`, metadata.json, and an optional `<name>.png`. */
export function zipBundle(
  name: string,
  table: ExportTable,
  metadata: ExportMetadata,
  png?: Uint8Array,
) {
  return zipSync({
    [`${name}.csv`]: strToU8(tableCsv(table)),
    "metadata.json": strToU8(JSON.stringify(metadata, null, 2)),
    ...(png ? { [`${name}.png`]: png } : {}),
  });
}

/** Builds the bundle in the browser and saves it as `<name>.zip`. */
export function downloadBundle(
  name: string,
  table: ExportTable,
  metadata: ExportMetadata,
  png?: Uint8Array,
) {
  const bytes = zipBundle(
    name,
    table,
    {
      ...metadata,
      exportedAt: new Date().toISOString(),
      url: window.location.href,
      files: [`${name}.csv`, ...(png ? [`${name}.png`] : [])],
    },
    png,
  );
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: "application/zip" }),
  );
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: `${name}.zip`,
  });
  a.click();
  URL.revokeObjectURL(url);
}
