import { and, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

import {
  deriveRates,
  evaluatePhysicalSanityRules,
  TOTAL_KEYS,
  type ReportedTotals,
} from "~/lib/emissions-metrics";
import {
  countDiff,
  diffRecord,
  emptyDiffCounts,
  RECORD_ATTRIBUTE_KEYS,
  recordKey,
  type ComparableRecord,
  type RecordAttributes,
} from "~/lib/record-diff";
import { db } from "~/server/db";
import {
  annualRecords,
  dataAuditLogs,
  facilities,
  importIssues,
  units,
} from "~/server/db/schema";

/** Shared write path for the CAMPD sync, CSV seed script, and file uploads. */

/** The database or an open transaction: each import runs its writes in one transaction. */
export type Executor =
  typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Runs `insert` over 50-row chunks to respect SQLite's bound-parameter limit. */
async function insertInChunks<T>(
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>,
) {
  for (let i = 0; i < rows.length; i += 50) await insert(rows.slice(i, i + 50));
}

/** Logs a dataset's rejected and duplicate source rows (with their original columns) to `import_issues`. */
export const insertImportIssues = (
  tx: Executor,
  datasetId: string,
  rows: {
    rowNumber: number;
    kind: "REJECTED" | "DUPLICATE";
    reason: string;
    data: Record<string, string>;
  }[],
) =>
  insertInChunks(rows, (chunk) =>
    tx.insert(importIssues).values(
      chunk.map(({ data, ...issue }) => ({
        ...issue,
        datasetId,
        rawRow: data,
      })),
    ),
  );

/** ON CONFLICT updates for every column but `keys`: incoming values win, or with `keepExisting` only non-null ones do. */
function conflictSet(
  table: SQLiteTable,
  keys: string[],
  keepExisting: boolean,
) {
  return Object.fromEntries(
    Object.entries(getTableColumns(table))
      .filter(([key]) => !keys.includes(key))
      .map(([key, { name }]) => [
        key,
        sql.raw(
          keepExisting
            ? `COALESCE(excluded.${name}, ${name})`
            : `excluded.${name}`,
        ),
      ]),
  );
}

/** Upserts facilities, keeping existing attributes where incoming ones are null. */
export const upsertFacilities = (
  rows: (typeof facilities.$inferInsert)[],
  tx: Executor = db,
) =>
  insertInChunks(rows, (chunk) =>
    tx
      .insert(facilities)
      .values(chunk)
      .onConflictDoUpdate({
        target: facilities.id,
        set: conflictSet(facilities, ["id"], true),
      }),
  );

/** Creates facilities that don't exist yet, using placeholder names/states where missing; never overwrites. */
export const insertMissingFacilities = (
  rows: { id: number; name?: string | null; stateCode?: string | null }[],
  tx: Executor = db,
) =>
  insertInChunks(
    rows.map((f) => ({
      ...f,
      name: f.name ?? `Facility #${f.id}`,
      stateCode: f.stateCode ?? "US",
    })),
    (chunk) => tx.insert(facilities).values(chunk).onConflictDoNothing(),
  );

/** Upserts units, keeping existing attributes where incoming ones are null; returns `facilityId:unitId` → internal id. */
export async function upsertUnits(
  rows: Omit<typeof units.$inferInsert, "id">[],
  tx: Executor = db,
) {
  const ids = new Map<string, string>();
  await insertInChunks(rows, async (chunk) => {
    const saved = await tx
      .insert(units)
      .values(chunk)
      .onConflictDoUpdate({
        target: [units.facilityId, units.unitId],
        set: conflictSet(units, ["id", "facilityId", "unitId"], true),
      })
      .returning({
        id: units.id,
        facilityId: units.facilityId,
        unitId: units.unitId,
      });
    for (const u of saved) ids.set(`${u.facilityId}:${u.unitId}`, u.id);
  });
  return ids;
}

/**
 * A unit-year to store. Per-year attributes left undefined (a file without control columns) are
 * inherited from the unit; null means the source reported none.
 */
interface AnnualRecordInput extends ReportedTotals, Partial<RecordAttributes> {
  facilityId: number;
  unitInternalId: string;
  year: number;
}

/** Metric and per-year attribute columns: what imports are compared on. */
const comparedColumns = Object.fromEntries(
  [...TOTAL_KEYS, ...RECORD_ATTRIBUTE_KEYS].map((k) => [k, annualRecords[k]]),
) as {
  [
    K in (typeof TOTAL_KEYS)[number] | (typeof RECORD_ATTRIBUTE_KEYS)[number]
  ]: (typeof annualRecords)[K];
};

/**
 * Stored metrics of the unit-years in `years` (optionally only `facilityId`), keyed by
 * recordKey(facilityId, unitId, year): what an upload or CAMPD retrieval is compared against.
 */
export async function storedRecords(years: number[], facilityId?: number[]) {
  if (years.length === 0) return new Map<string, ComparableRecord>();
  const rows = await db
    .select({
      facilityId: annualRecords.facilityId,
      unitId: units.unitId,
      year: annualRecords.year,
      ...comparedColumns,
    })
    .from(annualRecords)
    .innerJoin(units, eq(annualRecords.unitInternalId, units.id))
    .where(
      and(
        inArray(annualRecords.year, years),
        facilityId?.length
          ? inArray(annualRecords.facilityId, facilityId)
          : undefined,
      ),
    );
  return new Map(
    rows.map((r) => [recordKey(r.facilityId, r.unitId, r.year), r]),
  );
}

/** Runs `select` over the distinct `ids` in 500-id chunks (SQLite's bound-parameter limit) and concatenates the rows. */
async function selectInChunks<T>(
  ids: string[],
  select: (chunk: string[]) => Promise<T[]>,
) {
  const unique = [...new Set(ids)];
  const rows: T[] = [];
  for (let i = 0; i < unique.length; i += 500)
    rows.push(...(await select(unique.slice(i, i + 500))));
  return rows;
}

/** Stored metrics by `${unitInternalId}_${year}` for the records about to be written. */
async function storedByUnitYear(records: AnnualRecordInput[], tx: Executor) {
  const rows = await selectInChunks(
    records.map((r) => r.unitInternalId),
    (chunk) =>
      tx
        .select({
          unitInternalId: annualRecords.unitInternalId,
          year: annualRecords.year,
          ...comparedColumns,
        })
        .from(annualRecords)
        .where(inArray(annualRecords.unitInternalId, chunk)),
  );
  return new Map<string, ComparableRecord>(
    rows.map((r) => [`${r.unitInternalId}_${r.year}`, r]),
  );
}

/** Current control/program values of `unitIds`, by unit id. */
async function unitAttributes(unitIds: string[], tx: Executor) {
  const rows = await selectInChunks(unitIds, (chunk) =>
    tx
      .select({
        id: units.id,
        ...Object.fromEntries(RECORD_ATTRIBUTE_KEYS.map((k) => [k, units[k]])),
      } as { id: typeof units.id } & {
        [K in keyof RecordAttributes]: (typeof units)[K];
      })
      .from(units)
      .where(inArray(units.id, chunk)),
  );
  return new Map<string, RecordAttributes>(
    rows.map(({ id, ...attributes }) => [id, attributes]),
  );
}

/**
 * On conflict: an upload writing the record clears the marker; an API sync taking over an uploaded
 * record remembers that upload; otherwise the marker is kept.
 */
const supersededUpload = sql.raw(`CASE
  WHEN (SELECT source FROM datasets WHERE id = excluded.dataset_id) != 'API' THEN NULL
  WHEN (SELECT source FROM datasets WHERE id = annual_records.dataset_id) != 'API' THEN annual_records.dataset_id
  ELSE annual_records.superseded_upload_id
END`);

/**
 * Upserts annual records with derived rates and replaces each record's physical-sanity audit flags.
 * Returns how the records compared with what was stored before (inserted / updated / unchanged).
 */
export async function upsertAnnualRecords(
  datasetId: string,
  records: AnnualRecordInput[],
  tx: Executor = db,
) {
  const stored = await storedByUnitYear(records, tx);
  const diff = records.reduce(
    (counts, r) =>
      countDiff(
        counts,
        diffRecord(r, stored.get(`${r.unitInternalId}_${r.year}`)).status,
      ),
    emptyDiffCounts(),
  );
  // Sources without control/program columns: keep the year's stored values, or for a new record
  // take the unit's current ones.
  const unitDefaults = await unitAttributes(
    records
      .filter((r) => RECORD_ATTRIBUTE_KEYS.some((k) => r[k] === undefined))
      .map((r) => r.unitInternalId),
    tx,
  );
  const rows = records.map((r) => {
    const id = `${r.unitInternalId}_${r.year}`;
    const fallback = stored.get(id) ?? unitDefaults.get(r.unitInternalId);
    const attributes = Object.fromEntries(
      RECORD_ATTRIBUTE_KEYS.map((k) => [
        k,
        r[k] !== undefined ? r[k] : (fallback?.[k] ?? null),
      ]),
    ) as RecordAttributes;
    return { ...r, ...attributes, ...deriveRates(r), id, datasetId };
  });
  const flags = rows.flatMap((r) =>
    evaluatePhysicalSanityRules(r).map((flag) => ({
      ...flag,
      annualRecordId: r.id,
    })),
  );

  await insertInChunks(rows, (chunk) =>
    tx
      .insert(annualRecords)
      .values(chunk)
      .onConflictDoUpdate({
        target: [annualRecords.unitInternalId, annualRecords.year],
        set: {
          ...conflictSet(
            annualRecords,
            ["id", "facilityId", "unitInternalId", "year"],
            false,
          ),
          supersededUploadId: supersededUpload,
        },
      }),
  );
  await insertInChunks(rows, (chunk) =>
    tx.delete(dataAuditLogs).where(
      inArray(
        dataAuditLogs.annualRecordId,
        chunk.map((r) => r.id),
      ),
    ),
  );
  await insertInChunks(flags, (chunk) =>
    tx.insert(dataAuditLogs).values(chunk),
  );

  return {
    ...diff,
    flaggedRecords: new Set(flags.map((f) => f.annualRecordId)).size,
    anomalyCount: flags.length,
  };
}
