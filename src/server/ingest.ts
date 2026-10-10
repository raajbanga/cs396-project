import { and, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

import {
  deriveRates,
  evaluatePhysicalSanityRules,
  TOTAL_KEYS,
  type EmissionTotals,
} from "~/lib/emissions-metrics";
import {
  countDiff,
  diffRecord,
  emptyDiffCounts,
  recordKey,
} from "~/lib/record-diff";
import { db } from "~/server/db";
import {
  annualRecords,
  dataAuditLogs,
  facilities,
  units,
} from "~/server/db/schema";

/** Shared write path for the CAMPD sync, CSV seed script, and file uploads. */

/** Runs `insert` over 50-row chunks to respect SQLite's bound-parameter limit. */
export async function insertInChunks<T>(
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>,
) {
  for (let i = 0; i < rows.length; i += 50) await insert(rows.slice(i, i + 50));
}

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
export const upsertFacilities = (rows: (typeof facilities.$inferInsert)[]) =>
  insertInChunks(rows, (chunk) =>
    db
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
) =>
  insertInChunks(
    rows.map((f) => ({
      ...f,
      name: f.name ?? `Facility #${f.id}`,
      stateCode: f.stateCode ?? "US",
    })),
    (chunk) => db.insert(facilities).values(chunk).onConflictDoNothing(),
  );

/** Upserts units, keeping existing attributes where incoming ones are null; returns `facilityId:unitId` → internal id. */
export async function upsertUnits(
  rows: Omit<typeof units.$inferInsert, "id">[],
) {
  const ids = new Map<string, string>();
  await insertInChunks(rows, async (chunk) => {
    const saved = await db
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

interface AnnualRecordInput extends EmissionTotals {
  facilityId: number;
  unitInternalId: string;
  year: number;
}

const metricColumns = Object.fromEntries(
  TOTAL_KEYS.map((k) => [k, annualRecords[k]]),
) as { [K in (typeof TOTAL_KEYS)[number]]: (typeof annualRecords)[K] };

/**
 * Stored metrics of the unit-years in `years` (optionally only `facilityId`), keyed by
 * recordKey(facilityId, unitId, year): what an upload or CAMPD retrieval is compared against.
 */
export async function storedRecords(years: number[], facilityId?: number[]) {
  if (years.length === 0) return new Map<string, EmissionTotals>();
  const rows = await db
    .select({
      facilityId: annualRecords.facilityId,
      unitId: units.unitId,
      year: annualRecords.year,
      ...metricColumns,
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

/** Stored metrics by `${unitInternalId}_${year}` for the records about to be written. */
async function storedByUnitYear(records: AnnualRecordInput[]) {
  const stored = new Map<string, EmissionTotals>();
  const ids = [...new Set(records.map((r) => r.unitInternalId))];
  for (let i = 0; i < ids.length; i += 500) {
    const rows = await db
      .select({
        unitInternalId: annualRecords.unitInternalId,
        year: annualRecords.year,
        ...metricColumns,
      })
      .from(annualRecords)
      .where(inArray(annualRecords.unitInternalId, ids.slice(i, i + 500)));
    for (const r of rows) stored.set(`${r.unitInternalId}_${r.year}`, r);
  }
  return stored;
}

/**
 * Upserts annual records with derived rates and replaces each record's physical-sanity audit flags.
 * Returns how the records compared with what was stored before (inserted / updated / unchanged).
 */
export async function upsertAnnualRecords(
  datasetId: string,
  records: AnnualRecordInput[],
) {
  const stored = await storedByUnitYear(records);
  const diff = records.reduce(
    (counts, r) =>
      countDiff(
        counts,
        diffRecord(r, stored.get(`${r.unitInternalId}_${r.year}`)).status,
      ),
    emptyDiffCounts(),
  );
  const rows = records.map((r) => ({
    ...r,
    ...deriveRates(r),
    id: `${r.unitInternalId}_${r.year}`,
    datasetId,
  }));
  const flags = rows.flatMap((r) =>
    evaluatePhysicalSanityRules(r).map((flag) => ({
      ...flag,
      annualRecordId: r.id,
    })),
  );

  await insertInChunks(rows, (chunk) =>
    db
      .insert(annualRecords)
      .values(chunk)
      .onConflictDoUpdate({
        target: [annualRecords.unitInternalId, annualRecords.year],
        set: conflictSet(
          annualRecords,
          ["id", "facilityId", "unitInternalId", "year"],
          false,
        ),
      }),
  );
  await insertInChunks(rows, (chunk) =>
    db.delete(dataAuditLogs).where(
      inArray(
        dataAuditLogs.annualRecordId,
        chunk.map((r) => r.id),
      ),
    ),
  );
  await insertInChunks(flags, (chunk) =>
    db.insert(dataAuditLogs).values(chunk),
  );

  return {
    ...diff,
    flaggedRecords: new Set(flags.map((f) => f.annualRecordId)).size,
    anomalyCount: flags.length,
  };
}
