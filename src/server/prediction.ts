import { and, between, desc, eq, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import {
  modelInputs,
  predict,
  type ModelArtifact,
  type ModelRaw,
} from "~/lib/model";
import { getFuelTheme } from "~/lib/map-utils";
import { sample } from "~/server/analysis";
import { db } from "~/server/db";
import { annualRecords, facilities, models, units } from "~/server/db/schema";

/** Phase 2 §5–§6: registered models, baseline unit-years, and test-year predictions. */

const prev = alias(annualRecords, "prev");

/** Unit-years in ml/train.py's raw shape, plus identity and the actual NOₓ. */
async function modelRows(where: SQL | undefined, limit?: number) {
  const query = db
    .select({
      year: annualRecords.year,
      primary_fuel: units.primaryFuel,
      unit_type: units.unitType,
      nameplate_capacity_mw: units.nameplateCapacityMW,
      commercial_op_date: units.commercialOpDate,
      operating_hours: annualRecords.operatingHours,
      gross_generation_mwh: annualRecords.grossGenerationMWh,
      heat_input_mmbtu: annualRecords.heatInputMMBtu,
      nox_controls: annualRecords.noxControls,
      prev_nox_mass_tons: prev.noxMassTons,
      prev_heat_input_mmbtu: prev.heatInputMMBtu,
      prev_operating_hours: prev.operatingHours,
      facilityId: annualRecords.facilityId,
      facilityName: facilities.name,
      unitId: units.unitId,
      noxMassTons: annualRecords.noxMassTons,
    })
    .from(annualRecords)
    .innerJoin(units, eq(annualRecords.unitInternalId, units.id))
    .innerJoin(facilities, eq(annualRecords.facilityId, facilities.id))
    .leftJoin(
      prev,
      and(
        eq(prev.unitInternalId, annualRecords.unitInternalId),
        eq(prev.year, sql`${annualRecords.year} - 1`),
      ),
    )
    .where(where)
    .orderBy(desc(annualRecords.noxMassTons))
    .$dynamic();
  return limit ? query.limit(limit) : query;
}

export async function listModels() {
  const rows = await db.select().from(models).orderBy(models.id);
  return rows.map((m) => ({
    ...m,
    artifact: m.artifact as unknown as ModelArtifact,
  }));
}

/** Unit-years a user can pick as a sensitivity baseline: by facility name or ID, largest NOₓ first. */
export async function baselineOptions(search: string, year: number) {
  const term = search.trim();
  const num = Number.parseInt(term, 10);
  const match = term
    ? Number.isNaN(num)
      ? sql`lower(${facilities.name}) LIKE ${`%${term.toLowerCase()}%`}`
      : eq(facilities.id, num)
    : undefined;
  const rows = await modelRows(
    and(
      eq(annualRecords.year, year),
      sql`${annualRecords.noxMassTons} IS NOT NULL`,
      match,
    ),
    40,
  );
  return rows.map((r) => ({
    facilityId: r.facilityId,
    unitId: r.unitId,
    label: `${r.facilityName} (${r.facilityId}) unit ${r.unitId}`,
    fuel: r.primary_fuel,
    noxMassTons: r.noxMassTons,
  }));
}

/** One unit-year's model inputs and actual NOₓ. */
export async function baselineUnitYear(
  facilityId: number,
  unitId: string,
  year: number,
) {
  const [row] = await modelRows(
    and(
      eq(annualRecords.facilityId, facilityId),
      eq(units.unitId, unitId),
      eq(annualRecords.year, year),
    ),
  );
  if (!row) return null;
  return {
    label: `${row.facilityName} (${row.facilityId}) unit ${row.unitId}, ${row.year}`,
    actual: row.noxMassTons,
    inputs: modelInputs(row),
  };
}

/** Actual vs predicted NOₓ for an even sample of test-year unit-years, per model (evaluation charts). */
export async function testPredictions(from: number, to: number, max = 3000) {
  const [rows, registered] = await Promise.all([
    modelRows(
      and(
        between(annualRecords.year, from, to),
        sql`${annualRecords.noxMassTons} IS NOT NULL`,
      ),
    ),
    listModels(),
  ]);
  return sample(rows, max).map((r) => {
    const inputs = modelInputs(r);
    return {
      label: `${r.facilityName} (${r.facilityId}) unit ${r.unitId}, ${r.year}`,
      fuel: getFuelTheme(r.primary_fuel).name,
      actual: r.noxMassTons!,
      predicted: Object.fromEntries(
        registered.map((m) => [m.kind, predict(m.artifact, inputs)]),
      ),
    };
  });
}
