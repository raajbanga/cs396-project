import { getTableColumns, inArray, sql } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

import {
  deriveRates,
  evaluatePhysicalSanityRules,
  type EmissionTotals,
} from "~/lib/emissions-metrics";
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

export interface AnnualRecordInput extends EmissionTotals {
  facilityId: number;
  unitInternalId: string;
  year: number;
}

/** Upserts annual records with derived rates and replaces each record's physical-sanity audit flags. */
export async function upsertAnnualRecords(
  datasetId: string,
  records: AnnualRecordInput[],
) {
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
    flaggedRecords: new Set(flags.map((f) => f.annualRecordId)).size,
    anomalyCount: flags.length,
  };
}
