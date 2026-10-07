import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { eq, inArray } from "drizzle-orm";

import {
  buildImportReport,
  type ImportResult,
  type ParsedUpload,
} from "~/lib/data-import";
import { PYTHON } from "~/lib/python";
import { db } from "~/server/db";
import {
  annualRecords,
  datasets,
  type facilities,
  importIssues,
  units,
} from "~/server/db/schema";
import {
  insertInChunks,
  insertMissingFacilities,
  upsertAnnualRecords,
  upsertFacilities,
  upsertUnits,
} from "~/server/ingest";

const execFileAsync = promisify(execFile);

/** Reads and validates an upload with `scripts/parse_import.py` (via a temp copy). */
export async function parseUpload(
  fileName: string,
  bytes: Buffer,
): Promise<ParsedUpload> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gridpulse-upload-"));
  const filePath = path.join(dir, `upload${path.extname(fileName)}`);
  try {
    await fs.writeFile(filePath, bytes);
    const { stdout } = await execFileAsync(
      PYTHON,
      [path.join(process.cwd(), "scripts", "parse_import.py"), filePath],
      { maxBuffer: 1024 ** 3 },
    );
    return JSON.parse(stdout) as ParsedUpload;
  } catch (err) {
    const { code, stderr } = err as { code?: unknown; stderr?: string };
    throw new Error(
      code === "ENOENT"
        ? "python3 is not installed on the server."
        : (stderr?.trim().split("\n").at(-1) ?? "Could not read the file."),
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

/** Validation report for the dialog, including annual records the import would overwrite. */
export async function previewUpload(parsed: ParsedUpload) {
  const years = [...new Set(parsed.records.annual.map((r) => r.year))];
  const existing = years.length
    ? await db
        .select({
          facilityId: annualRecords.facilityId,
          unitId: units.unitId,
          year: annualRecords.year,
        })
        .from(annualRecords)
        .innerJoin(units, eq(annualRecords.unitInternalId, units.id))
        .where(inArray(annualRecords.year, years))
    : [];
  return buildImportReport(
    parsed,
    new Set(existing.map((r) => `${r.facilityId}:${r.unitId}:${r.year}`)),
  );
}

/** Stores an upload's valid records as a dataset; with `original`, archives the file under `uploads/`. */
export async function importUpload(
  { records, rejectedRows, summary, reportingYear }: ParsedUpload,
  fileName: string,
  original?: Buffer,
): Promise<ImportResult> {
  const datasetId = crypto.randomUUID();
  const datasetName = `Upload: ${fileName}`;
  const source = /\.[ct]sv$/i.test(fileName) ? "BULK_CSV" : "BULK_EXCEL";
  const archivedFile = original
    ? path.join("uploads", `${datasetId}_${fileName.replace(/[^\w.-]/g, "_")}`)
    : null;
  await db.insert(datasets).values({
    id: datasetId,
    name: datasetName,
    source,
    reportingYear: reportingYear ?? new Date().getFullYear(),
    rawRecordCount: summary.totalRows,
    validRecords: summary.validCount,
    originalFilename: fileName,
    archivedPath: archivedFile,
    notes: `${summary.invalidCount} rejected, ${summary.duplicateCount} duplicate rows`,
  });
  await insertInChunks(rejectedRows, (chunk) =>
    db.insert(importIssues).values(
      chunk.map(({ data, ...issue }) => ({
        ...issue,
        datasetId,
        rawRow: data,
      })),
    ),
  );

  // Rows without a name and state may only create placeholder facilities, never overwrite real ones.
  const named = records.facilities.filter((f) => f.name && f.stateCode);
  await upsertFacilities(named as (typeof facilities.$inferInsert)[]);
  await insertMissingFacilities(
    records.facilities.filter((f) => !f.name || !f.stateCode),
  );
  const unitIds = await upsertUnits(records.units);
  const { flaggedRecords, anomalyCount } = await upsertAnnualRecords(
    datasetId,
    records.annual.map((r) => ({
      ...r,
      unitInternalId: unitIds.get(`${r.facilityId}:${r.unitId}`)!,
    })),
  );
  await db
    .update(datasets)
    .set({ flaggedRecords })
    .where(eq(datasets.id, datasetId));

  if (original && archivedFile) {
    await fs.mkdir("uploads", { recursive: true });
    await fs.writeFile(archivedFile, original);
  }

  return {
    datasetId,
    datasetName,
    source,
    facilities: records.facilities.length,
    units: unitIds.size,
    annualRecords: records.annual.length,
    anomalies: anomalyCount,
    issues: rejectedRows.length,
    archivedFile,
  };
}
