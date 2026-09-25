import { and, asc, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { z } from "zod";

import {
  getCampdPublishedYear,
  GRANULARITIES,
} from "~/lib/campd-reporting-period";
import { deriveRates, sumTotals } from "~/lib/emissions-metrics";
import { facilityFilterSchema, SORT_FIELDS } from "~/lib/facility-filters";
import {
  hasAirQualityControls,
  isOperatingStatus,
} from "~/lib/plant-narrative";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  fetchGranularEmissionsForFacility,
  resolveCampdPublishedThrough,
} from "~/server/campd/client";
import { type db as Database } from "~/server/db";
import {
  annualRecords,
  dataAuditLogs,
  facilities,
  units,
} from "~/server/db/schema";

/** Correlated per-facility subqueries over child tables. */
const perFacility = {
  unitCount: sql<number>`(
    SELECT COUNT(*) FROM "units" WHERE "units"."facility_id" = "facilities"."id"
  )`.as("unit_count"),
  totalCapacityMW: sql<number>`(
    SELECT COALESCE(ROUND(SUM("units"."nameplate_capacity_mw"), 1), 0)
    FROM "units" WHERE "units"."facility_id" = "facilities"."id"
  )`.as("total_capacity_mw"),
  totalCo2Tons: sql<number>`(
    SELECT COALESCE(ROUND(SUM("annual_records"."co2_mass_tons"), 0), 0)
    FROM "annual_records" WHERE "annual_records"."facility_id" = "facilities"."id"
  )`.as("total_co2_tons"),
};

const SORT_COLUMNS = {
  name: facilities.name,
  id: facilities.id,
  capacity: sql`total_capacity_mw`,
  co2: sql`total_co2_tons`,
};

const notBlank = (col: SQLiteColumn) =>
  sql`${col} IS NOT NULL AND ${col} != ''`;

function filterConditions(
  filter: z.infer<typeof facilityFilterSchema> = {},
): SQL[] {
  const conditions: SQL[] = [];
  const active = (v?: string) => v && v !== "ALL";

  if (active(filter.stateCode)) {
    conditions.push(eq(facilities.stateCode, filter.stateCode!));
  }
  if (active(filter.nercRegion)) {
    conditions.push(eq(facilities.nercRegion, filter.nercRegion!));
  }
  if (active(filter.primaryFuel)) {
    conditions.push(
      sql`${facilities.id} IN (SELECT ${units.facilityId} FROM ${units} WHERE ${units.primaryFuel} = ${filter.primaryFuel})`,
    );
  }
  const search = filter.search?.trim();
  if (search) {
    const term = `%${search.toLowerCase()}%`;
    const textCond = sql`(lower(${facilities.name}) LIKE ${term} OR lower(${facilities.county}) LIKE ${term} OR lower(${facilities.ownerOperator}) LIKE ${term})`;
    const num = Number.parseInt(search, 10);
    conditions.push(
      Number.isNaN(num)
        ? textCond
        : sql`(${facilities.id} = ${num} OR ${textCond})`,
    );
  }
  return conditions;
}

async function distinctValues(database: typeof Database, column: SQLiteColumn) {
  const rows = await database
    .selectDistinct({ value: column })
    .from(column.table)
    .where(notBlank(column))
    .orderBy(asc(column));
  return rows.map((r) => String(r.value));
}

const uniqueStrings = (values: (string | null)[]) =>
  [...new Set(values)].filter((v): v is string => Boolean(v));

export const facilitiesRouter = createTRPCRouter({
  getStats: publicProcedure.query(async ({ ctx }) => {
    const [stats] = await ctx.db
      .select({
        totalFacilities: count(),
        totalStates: sql<number>`COUNT(DISTINCT ${facilities.stateCode})`,
        totalNercRegions: sql<number>`COUNT(DISTINCT NULLIF(${facilities.nercRegion}, ''))`,
        totalUnits: sql<number>`(SELECT COUNT(*) FROM ${units})`,
        totalCapacityMW: sql<number>`(SELECT ROUND(COALESCE(SUM(${units.nameplateCapacityMW}), 0)) FROM ${units})`,
        totalCo2Tons: sql<number>`(SELECT ROUND(COALESCE(SUM(${annualRecords.co2MassTons}), 0)) FROM ${annualRecords})`,
        totalAnomalies: sql<number>`(SELECT COUNT(*) FROM ${dataAuditLogs})`,
      })
      .from(facilities);
    return stats!;
  }),

  getFilterOptions: publicProcedure.query(async ({ ctx }) => ({
    states: await distinctValues(ctx.db, facilities.stateCode),
    fuels: await distinctValues(ctx.db, units.primaryFuel),
    nercRegions: await distinctValues(ctx.db, facilities.nercRegion),
  })),

  getFacilities: publicProcedure
    .input(
      facilityFilterSchema.extend({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(5).max(100).default(10),
        sortBy: z.enum(SORT_FIELDS).default("name"),
        sortDir: z.enum(["asc", "desc"]).default("asc"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, sortBy, sortDir } = input;
      const where = and(...filterConditions(input));

      const [countResult] = await ctx.db
        .select({ total: count() })
        .from(facilities)
        .where(where);
      const totalCount = countResult?.total ?? 0;

      const rows = await ctx.db
        .select({
          id: facilities.id,
          name: facilities.name,
          stateCode: facilities.stateCode,
          county: facilities.county,
          nercRegion: facilities.nercRegion,
          sourceCategory: facilities.sourceCategory,
          ownerOperator: facilities.ownerOperator,
          ...perFacility,
          primaryFuelsRaw: sql<string | null>`(
            SELECT GROUP_CONCAT(DISTINCT "units"."primary_fuel") FROM "units" WHERE "units"."facility_id" = "facilities"."id" AND "units"."primary_fuel" IS NOT NULL AND "units"."primary_fuel" != ''
          )`.as("primary_fuels_raw"),
          carbonIntensityLbsMWh: sql<number | null>`(
            SELECT ROUND(SUM("annual_records"."co2_mass_tons") * 2000.0 / NULLIF(SUM("annual_records"."gross_generation_mwh"), 0))
            FROM "annual_records" WHERE "annual_records"."facility_id" = "facilities"."id"
          )`.as("carbon_intensity_lbs_mwh"),
          controlledUnitsCount: sql<number>`(
            SELECT COUNT(*) FROM "units" WHERE "units"."facility_id" = "facilities"."id" AND ("units"."so2_controls" IS NOT NULL OR "units"."nox_controls" IS NOT NULL OR "units"."pm_controls" IS NOT NULL OR "units"."hg_controls" IS NOT NULL)
          )`.as("controlled_units_count"),
          totalOperatingHours: sql<number>`(
            SELECT COALESCE(ROUND(SUM("annual_records"."operating_hours"), 0), 0) FROM "annual_records" WHERE "annual_records"."facility_id" = "facilities"."id"
          )`.as("total_operating_hours"),
        })
        .from(facilities)
        .where(where)
        .orderBy((sortDir === "asc" ? asc : desc)(SORT_COLUMNS[sortBy]))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      return {
        items: rows.map(({ primaryFuelsRaw, ...row }) => ({
          ...row,
          primaryFuels: primaryFuelsRaw?.split(",").filter(Boolean) ?? [],
        })),
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      };
    }),

  getMapFacilities: publicProcedure
    .input(facilityFilterSchema.optional())
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: facilities.id,
          name: facilities.name,
          stateCode: facilities.stateCode,
          county: facilities.county,
          latitude: facilities.latitude,
          longitude: facilities.longitude,
          nercRegion: facilities.nercRegion,
          sourceCategory: facilities.sourceCategory,
          ownerOperator: facilities.ownerOperator,
          primaryFuel: sql<string | null>`(
            SELECT "units"."primary_fuel" FROM "units"
            WHERE "units"."facility_id" = "facilities"."id" AND "units"."primary_fuel" IS NOT NULL AND "units"."primary_fuel" != ''
            LIMIT 1
          )`.as("primary_fuel"),
          ...perFacility,
        })
        .from(facilities)
        .where(
          and(
            sql`${facilities.latitude} IS NOT NULL AND ${facilities.longitude} IS NOT NULL`,
            ...filterConditions(input),
          ),
        );

      return rows.map((r) => ({
        ...r,
        latitude: r.latitude!,
        longitude: r.longitude!,
        primaryFuel: r.primaryFuel ?? "Unknown",
      }));
    }),

  getFacility: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ ctx, input }) =>
      ctx.db.query.facilities.findFirst({
        where: eq(facilities.id, input.id),
        with: {
          units: true,
          annualRecords: {
            orderBy: (rec, { desc }) => [desc(rec.year)],
            with: { unit: true, auditLogs: true },
          },
        },
      }),
    ),

  compareFacilities: publicProcedure
    .input(z.object({ ids: z.array(z.number()).min(2).max(4) }))
    .query(async ({ ctx, input }) => {
      const plants = await ctx.db.query.facilities.findMany({
        where: inArray(facilities.id, input.ids),
        with: { units: true, annualRecords: true },
      });

      return plants.map((plant) => {
        const countUnits = (
          pred: (u: (typeof plant.units)[number]) => unknown,
        ) => plant.units.filter(pred).length;
        const availableYears = [
          ...new Set(plant.annualRecords.map((r) => r.year)),
        ].sort((a, b) => b - a);
        const latestYear = availableYears[0] ?? null;
        const totals = sumTotals(
          plant.annualRecords.filter((r) => r.year === latestYear),
        );
        const rates = deriveRates(totals);

        return {
          id: plant.id,
          name: plant.name,
          reportingYear: latestYear,
          stateCode: plant.stateCode,
          county: plant.county,
          nercRegion: plant.nercRegion ?? "Unassigned",
          sourceCategory: plant.sourceCategory ?? "Unassigned",
          ownerOperator: plant.ownerOperator ?? "Unspecified",
          unitCount: plant.units.length,
          operatingUnitsCount: countUnits((u) =>
            isOperatingStatus(u.operatingStatus),
          ),
          totalCapacityMW: Math.round(
            plant.units.reduce(
              (sum, u) => sum + (u.nameplateCapacityMW ?? 0),
              0,
            ),
          ),
          primaryFuels: uniqueStrings(plant.units.map((u) => u.primaryFuel)),
          secondaryFuels: uniqueStrings(
            plant.units.map((u) => u.secondaryFuel),
          ),
          totalOperatingHours: Math.round(totals.operatingHours),
          totalGenerationMWh: Math.round(totals.grossGenerationMWh),
          totalCo2Tons: Math.round(totals.co2MassTons),
          totalSo2Tons: Math.round(totals.so2MassTons),
          totalNoxTons: Math.round(totals.noxMassTons),
          carbonIntensityLbsMWh: rates.co2IntensityLbsMWh,
          heatRateMMBtuMWh: rates.heatRateMMBtuMWh,
          so2ControlledUnits: countUnits((u) => u.so2Controls),
          noxControlledUnits: countUnits((u) => u.noxControls),
          pmControlledUnits: countUnits((u) => u.pmControls),
          controlledUnitsCount: countUnits(hasAirQualityControls),
          availableYears,
          units: plant.units,
        };
      });
    }),

  getAuditLogs: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }))
    .query(({ ctx, input }) =>
      ctx.db
        .select({
          id: dataAuditLogs.id,
          flagType: dataAuditLogs.flagType,
          severity: dataAuditLogs.severity,
          details: dataAuditLogs.details,
          createdAt: dataAuditLogs.createdAt,
          year: annualRecords.year,
          facilityId: annualRecords.facilityId,
          facilityName: facilities.name,
          unitId: units.unitId,
        })
        .from(dataAuditLogs)
        .innerJoin(
          annualRecords,
          eq(dataAuditLogs.annualRecordId, annualRecords.id),
        )
        .innerJoin(facilities, eq(annualRecords.facilityId, facilities.id))
        .innerJoin(units, eq(annualRecords.unitInternalId, units.id))
        .orderBy(desc(dataAuditLogs.createdAt))
        .limit(input.limit),
    ),

  getCampdPublishedThrough: publicProcedure
    .input(z.object({ facilityId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const publishedThrough = await resolveCampdPublishedThrough(
        input?.facilityId,
      );
      return {
        publishedThrough,
        year: getCampdPublishedYear(publishedThrough),
      };
    }),

  getGranularEmissions: publicProcedure
    .input(
      z.object({
        facilityId: z.number(),
        granularity: z.enum(GRANULARITIES).default("monthly"),
        year: z.number().optional(),
        date: z.string().optional(),
        unitId: z.string().optional(),
      }),
    )
    .query(({ input }) => fetchGranularEmissionsForFacility(input)),
});
