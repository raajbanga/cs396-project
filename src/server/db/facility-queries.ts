import { eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { type db as DbInstance } from "~/server/db";
import { facilities, units } from "~/server/db/schema";

export const facilityFilterSchema = z.object({
  search: z.string().optional(),
  stateCode: z.string().optional(),
  primaryFuel: z.string().optional(),
  nercRegion: z.string().optional(),
  sourceCategory: z.string().optional(),
});

export type FacilityFilterInput = z.infer<typeof facilityFilterSchema>;

export const facilityUnitCountSubquery = sql<number>`(
  SELECT COUNT(*) FROM "units" WHERE "units"."facility_id" = "facilities"."id"
)`.as("unit_count");

export const facilityTotalCapacitySubquery = sql<number>`(
  SELECT COALESCE(ROUND(SUM("units"."nameplate_capacity_mw"), 1), 0)
  FROM "units" WHERE "units"."facility_id" = "facilities"."id"
)`.as("total_capacity_mw");

export const facilityTotalCo2Subquery = sql<number>`(
  SELECT COALESCE(ROUND(SUM("annual_records"."co2_mass_tons"), 0), 0)
  FROM "annual_records" WHERE "annual_records"."facility_id" = "facilities"."id"
)`.as("total_co2_tons");

export const facilityCarbonIntensitySubquery = sql<number | null>`(
  SELECT ROUND(SUM("annual_records"."co2_mass_tons") * 2000.0 / NULLIF(SUM("annual_records"."gross_generation_mwh"), 0))
  FROM "annual_records"
  WHERE "annual_records"."facility_id" = "facilities"."id"
)`.as("carbon_intensity_lbs_mwh");

export function buildFacilityFilterConditions(
  filter?: FacilityFilterInput,
): SQL[] {
  const conditions: SQL[] = [];

  if (filter?.stateCode && filter.stateCode !== "ALL") {
    conditions.push(eq(facilities.stateCode, filter.stateCode));
  }

  if (filter?.nercRegion && filter.nercRegion !== "ALL") {
    conditions.push(eq(facilities.nercRegion, filter.nercRegion));
  }

  if (filter?.sourceCategory && filter.sourceCategory !== "ALL") {
    conditions.push(eq(facilities.sourceCategory, filter.sourceCategory));
  }

  if (filter?.search && filter.search.trim() !== "") {
    const term = `%${filter.search.trim().toLowerCase()}%`;
    const num = Number.parseInt(filter.search.trim(), 10);
    const textCond = sql`(lower(${facilities.name}) LIKE ${term} OR lower(${facilities.county}) LIKE ${term} OR lower(${facilities.ownerOperator}) LIKE ${term})`;
    conditions.push(
      !Number.isNaN(num)
        ? sql`(${facilities.id} = ${num} OR ${textCond})`
        : textCond,
    );
  }

  if (filter?.primaryFuel && filter.primaryFuel !== "ALL") {
    conditions.push(
      sql`${facilities.id} IN (
        SELECT DISTINCT ${units.facilityId}
        FROM ${units}
        WHERE ${units.primaryFuel} = ${filter.primaryFuel}
      )`,
    );
  }

  return conditions;
}

export async function fetchFacilityWithRelations(
  database: typeof DbInstance,
  id: number,
) {
  return database.query.facilities.findFirst({
    where: eq(facilities.id, id),
    with: {
      units: true,
      annualRecords: {
        orderBy: (rec, { desc: descFn }) => [descFn(rec.year)],
        with: {
          unit: true,
          auditLogs: true,
        },
      },
    },
  });
}
