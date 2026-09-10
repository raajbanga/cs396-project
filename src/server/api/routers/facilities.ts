import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  inArray,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import {
  computeCo2IntensityLbsMWh,
  computeHeatRateMMBtuMWh,
} from "~/lib/emissions-metrics";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { syncCampdAnnualEmissions } from "~/server/campd/client";
import {
  buildFacilityFilterConditions,
  facilityCarbonIntensitySubquery,
  facilityFilterSchema,
  facilityTotalCapacitySubquery,
  facilityTotalCo2Subquery,
  facilityUnitCountSubquery,
  fetchFacilityWithRelations,
} from "~/server/db/facility-queries";
import {
  annualRecords,
  dataAuditLogs,
  facilities,
  units,
} from "~/server/db/schema";

const CURRENT_YEAR = new Date().getFullYear();
const STALE_DATA_YEAR_THRESHOLD = CURRENT_YEAR - 2;
const SYNC_YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1];

/** In-process guard to avoid duplicate CAMPD syncs during a single server instance. */
const syncedFacilityIds = new Set<number>();

export const facilitiesRouter = createTRPCRouter({
  getStats: publicProcedure.query(async ({ ctx }) => {
    const [facilitiesCountRes] = await ctx.db
      .select({ total: count() })
      .from(facilities);

    const [unitsCountRes] = await ctx.db
      .select({
        total: count(),
        totalCapacity: sql<number>`COALESCE(SUM(${units.nameplateCapacityMW}), 0)`,
      })
      .from(units);

    const [statesCountRes] = await ctx.db
      .select({ total: countDistinct(facilities.stateCode) })
      .from(facilities);

    const [nercCountRes] = await ctx.db
      .select({ total: countDistinct(facilities.nercRegion) })
      .from(facilities)
      .where(
        sql`${facilities.nercRegion} IS NOT NULL AND ${facilities.nercRegion} != ''`,
      );

    const [emissionsRes] = await ctx.db
      .select({
        totalCo2: sql<number>`COALESCE(SUM(${annualRecords.co2MassTons}), 0)`,
        totalGeneration: sql<number>`COALESCE(SUM(${annualRecords.grossGenerationMWh}), 0)`,
      })
      .from(annualRecords);

    const [anomaliesRes] = await ctx.db
      .select({ total: count() })
      .from(dataAuditLogs);

    const fuelTypes = await ctx.db
      .select({
        fuel: units.primaryFuel,
        count: count(),
      })
      .from(units)
      .where(
        sql`${units.primaryFuel} IS NOT NULL AND ${units.primaryFuel} != ''`,
      )
      .groupBy(units.primaryFuel)
      .orderBy(desc(count()))
      .limit(6);

    const nercBreakdown = await ctx.db
      .select({
        nerc: facilities.nercRegion,
        count: count(),
      })
      .from(facilities)
      .where(
        sql`${facilities.nercRegion} IS NOT NULL AND ${facilities.nercRegion} != ''`,
      )
      .groupBy(facilities.nercRegion)
      .orderBy(desc(count()))
      .limit(5);

    return {
      totalFacilities: facilitiesCountRes?.total ?? 0,
      totalUnits: unitsCountRes?.total ?? 0,
      totalStates: statesCountRes?.total ?? 0,
      totalNercRegions: nercCountRes?.total ?? 0,
      totalCapacityMW: Math.round(unitsCountRes?.totalCapacity ?? 0),
      totalCo2Tons: Math.round(emissionsRes?.totalCo2 ?? 0),
      totalGenerationMWh: Math.round(emissionsRes?.totalGeneration ?? 0),
      totalAnomalies: anomaliesRes?.total ?? 0,
      topFuels: fuelTypes.map((f) => ({
        fuel: f.fuel ?? "Unknown",
        count: f.count,
      })),
      topNerc: nercBreakdown.map((n) => ({
        nerc: n.nerc ?? "Unknown",
        count: n.count,
      })),
    };
  }),

  getFilterOptions: publicProcedure.query(async ({ ctx }) => {
    const stateRows = await ctx.db
      .selectDistinct({ stateCode: facilities.stateCode })
      .from(facilities)
      .orderBy(asc(facilities.stateCode));

    const fuelRows = await ctx.db
      .selectDistinct({ primaryFuel: units.primaryFuel })
      .from(units)
      .where(
        sql`${units.primaryFuel} IS NOT NULL AND ${units.primaryFuel} != ''`,
      )
      .orderBy(asc(units.primaryFuel));

    const nercRows = await ctx.db
      .selectDistinct({ nercRegion: facilities.nercRegion })
      .from(facilities)
      .where(
        sql`${facilities.nercRegion} IS NOT NULL AND ${facilities.nercRegion} != ''`,
      )
      .orderBy(asc(facilities.nercRegion));

    return {
      states: stateRows.map((r) => r.stateCode).filter(Boolean),
      fuels: fuelRows
        .map((r) => r.primaryFuel)
        .filter((f): f is string => Boolean(f)),
      nercRegions: nercRows
        .map((r) => r.nercRegion)
        .filter((n): n is string => Boolean(n)),
    };
  }),

  getFacilities: publicProcedure
    .input(
      facilityFilterSchema.extend({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(5).max(100).default(10),
        sortBy: z
          .enum(["name", "id", "capacity", "co2"])
          .optional()
          .default("name"),
        sortDir: z.enum(["asc", "desc"]).optional().default("asc"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, sortBy = "name", sortDir = "asc" } = input;
      const offset = (page - 1) * pageSize;

      const conditions = buildFacilityFilterConditions(input);
      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const [countResult] = await ctx.db
        .select({ total: count() })
        .from(facilities)
        .where(whereClause);

      const totalCount = countResult?.total ?? 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      const orderCol =
        sortBy === "capacity"
          ? sql`total_capacity_mw`
          : sortBy === "co2"
            ? sql`total_co2_tons`
            : sortBy === "id"
              ? facilities.id
              : facilities.name;
      const orderClause = sortDir === "asc" ? asc(orderCol) : desc(orderCol);

      const facilityRows = await ctx.db
        .select({
          id: facilities.id,
          name: facilities.name,
          stateCode: facilities.stateCode,
          county: facilities.county,
          nercRegion: facilities.nercRegion,
          sourceCategory: facilities.sourceCategory,
          ownerOperator: facilities.ownerOperator,
          unitCount: facilityUnitCountSubquery,
          totalCapacityMW: facilityTotalCapacitySubquery,
          totalCo2Tons: facilityTotalCo2Subquery,
          primaryFuelsRaw: sql<string | null>`(
            SELECT GROUP_CONCAT(DISTINCT "units"."primary_fuel") FROM "units" WHERE "units"."facility_id" = "facilities"."id" AND "units"."primary_fuel" IS NOT NULL AND "units"."primary_fuel" != ''
          )`.as("primary_fuels_raw"),
          carbonIntensityLbsMWh: facilityCarbonIntensitySubquery,
          controlledUnitsCount: sql<number>`(
            SELECT COUNT(*) FROM "units" WHERE "units"."facility_id" = "facilities"."id" AND ("units"."so2_controls" IS NOT NULL OR "units"."nox_controls" IS NOT NULL)
          )`.as("controlled_units_count"),
          totalOperatingHours: sql<number>`(
            SELECT COALESCE(ROUND(SUM("annual_records"."operating_hours"), 0), 0) FROM "annual_records" WHERE "annual_records"."facility_id" = "facilities"."id"
          )`.as("total_operating_hours"),
        })
        .from(facilities)
        .where(whereClause)
        .orderBy(orderClause)
        .limit(pageSize)
        .offset(offset);

      return {
        items: facilityRows.map((row) => ({
          ...row,
          primaryFuels: row.primaryFuelsRaw
            ? row.primaryFuelsRaw.split(",").filter(Boolean)
            : [],
        })),
        totalCount,
        page,
        pageSize,
        totalPages,
      };
    }),

  getMapFacilities: publicProcedure
    .input(facilityFilterSchema.optional())
    .query(async ({ ctx, input }) => {
      const conditions = [
        sql`${facilities.latitude} IS NOT NULL AND ${facilities.longitude} IS NOT NULL`,
        ...buildFacilityFilterConditions(input),
      ];
      const whereClause = and(...conditions);

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
          totalCapacityMW: facilityTotalCapacitySubquery,
          totalCo2Tons: facilityTotalCo2Subquery,
          unitCount: facilityUnitCountSubquery,
        })
        .from(facilities)
        .where(whereClause);

      return rows.map((r) => ({
        ...r,
        latitude: r.latitude!,
        longitude: r.longitude!,
        primaryFuel: r.primaryFuel ?? "Unknown",
      }));
    }),

  getFacility: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      let facility = await fetchFacilityWithRelations(ctx.db, input.id);

      if (!facility) return null;

      const recordedYears = facility.annualRecords.map((r) => r.year);
      const maxYear = recordedYears.length > 0 ? Math.max(...recordedYears) : 0;

      if (
        maxYear <= STALE_DATA_YEAR_THRESHOLD &&
        !syncedFacilityIds.has(input.id)
      ) {
        syncedFacilityIds.add(input.id);
        try {
          for (const year of SYNC_YEARS) {
            await syncCampdAnnualEmissions({
              year,
              facilityId: input.id,
              maxPages: 1,
            });
          }

          const refreshed = await fetchFacilityWithRelations(ctx.db, input.id);
          if (refreshed) {
            facility = refreshed;
          }
        } catch (err) {
          console.error(
            `Auto-fetch latest CAMPD data for facility ${input.id} failed:`,
            err,
          );
        }
      }

      return facility;
    }),

  compareFacilities: publicProcedure
    .input(z.object({ ids: z.array(z.number()).min(2).max(4) }))
    .query(async ({ ctx, input }) => {
      const plants = await ctx.db.query.facilities.findMany({
        where: inArray(facilities.id, input.ids),
        with: {
          units: true,
          annualRecords: true,
        },
      });

      return plants.map((plant) => {
        let totalCapacityMW = 0;
        let operatingUnitsCount = 0;
        let so2ControlledUnits = 0;
        let noxControlledUnits = 0;
        let pmControlledUnits = 0;
        const primaryFuels = new Set<string>();
        const secondaryFuels = new Set<string>();

        for (const u of plant.units) {
          totalCapacityMW += u.nameplateCapacityMW ?? 0;
          if (u.primaryFuel) primaryFuels.add(u.primaryFuel);
          if (u.secondaryFuel) secondaryFuels.add(u.secondaryFuel);
          if ((u.operatingStatus ?? "").toLowerCase().includes("op"))
            operatingUnitsCount++;
          if (u.so2Controls) so2ControlledUnits++;
          if (u.noxControls) noxControlledUnits++;
          if (u.pmControls) pmControlledUnits++;
        }

        const years = Array.from(
          new Set(plant.annualRecords.map((r) => r.year)),
        );
        const latestYear = years.length > 0 ? Math.max(...years) : null;
        const targetRecords =
          latestYear !== null
            ? plant.annualRecords.filter((r) => r.year === latestYear)
            : plant.annualRecords;

        let totalGen = 0;
        let totalHours = 0;
        let totalCo2 = 0;
        let totalSo2 = 0;
        let totalNox = 0;
        let totalHeat = 0;
        for (const r of targetRecords) {
          totalGen += r.grossGenerationMWh;
          totalHours += r.operatingHours;
          totalCo2 += r.co2MassTons;
          totalSo2 += r.so2MassTons;
          totalNox += r.noxMassTons;
          totalHeat += r.heatInputMMBtu;
        }

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
          operatingUnitsCount,
          totalCapacityMW: Math.round(totalCapacityMW),
          primaryFuels: Array.from(primaryFuels),
          secondaryFuels: Array.from(secondaryFuels),
          totalOperatingHours: Math.round(totalHours),
          totalGenerationMWh: Math.round(totalGen),
          totalCo2Tons: Math.round(totalCo2),
          totalSo2Tons: Math.round(totalSo2),
          totalNoxTons: Math.round(totalNox),
          carbonIntensityLbsMWh: computeCo2IntensityLbsMWh(totalCo2, totalGen),
          heatRateMMBtuMWh: computeHeatRateMMBtuMWh(totalHeat, totalGen),
          so2ControlledUnits,
          noxControlledUnits,
          pmControlledUnits,
          units: plant.units,
        };
      });
    }),

  getAuditLogs: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      const logs = await ctx.db
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
        .limit(input.limit);

      return logs;
    }),
});
