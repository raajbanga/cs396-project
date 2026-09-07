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

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { syncCampdAnnualEmissions } from "~/server/campd/client";
import {
  annualRecords,
  dataAuditLogs,
  facilities,
  units,
} from "~/server/db/schema";

export const facilitiesRouter = createTRPCRouter({
  /**
   * Get overall system metrics, grid stats, and anomaly counts
   */
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

  /**
   * Get filter dropdown options (states, fuels, NERC regions, source categories)
   */
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

    const categoryRows = await ctx.db
      .selectDistinct({ sourceCategory: facilities.sourceCategory })
      .from(facilities)
      .where(
        sql`${facilities.sourceCategory} IS NOT NULL AND ${facilities.sourceCategory} != ''`,
      )
      .orderBy(asc(facilities.sourceCategory));

    return {
      states: stateRows.map((r) => r.stateCode).filter(Boolean),
      fuels: fuelRows
        .map((r) => r.primaryFuel)
        .filter((f): f is string => Boolean(f)),
      nercRegions: nercRows
        .map((r) => r.nercRegion)
        .filter((n): n is string => Boolean(n)),
      sourceCategories: categoryRows
        .map((r) => r.sourceCategory)
        .filter((c): c is string => Boolean(c)),
    };
  }),

  /**
   * Get paginated facilities with search, state, fuel, NERC region, and source category filtering
   */
  getFacilities: publicProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(5).max(100).default(10),
        search: z.string().optional(),
        stateCode: z.string().optional(),
        primaryFuel: z.string().optional(),
        nercRegion: z.string().optional(),
        sourceCategory: z.string().optional(),
        sortBy: z
          .enum(["name", "id", "capacity", "co2"])
          .optional()
          .default("name"),
        sortDir: z.enum(["asc", "desc"]).optional().default("asc"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const {
        page,
        pageSize,
        search,
        stateCode,
        primaryFuel,
        nercRegion,
        sourceCategory,
        sortBy = "name",
        sortDir = "asc",
      } = input;
      const offset = (page - 1) * pageSize;

      const conditions = [];

      if (stateCode && stateCode !== "ALL") {
        conditions.push(eq(facilities.stateCode, stateCode));
      }

      if (nercRegion && nercRegion !== "ALL") {
        conditions.push(eq(facilities.nercRegion, nercRegion));
      }

      if (sourceCategory && sourceCategory !== "ALL") {
        conditions.push(eq(facilities.sourceCategory, sourceCategory));
      }

      if (search && search.trim() !== "") {
        const term = `%${search.trim().toLowerCase()}%`;
        const numericSearch = Number.parseInt(search.trim(), 10);
        if (!Number.isNaN(numericSearch)) {
          conditions.push(
            sql`(${facilities.id} = ${numericSearch} OR lower(${facilities.name}) LIKE ${term} OR lower(${facilities.county}) LIKE ${term} OR lower(${facilities.ownerOperator}) LIKE ${term})`,
          );
        } else {
          conditions.push(
            sql`(lower(${facilities.name}) LIKE ${term} OR lower(${facilities.county}) LIKE ${term} OR lower(${facilities.ownerOperator}) LIKE ${term})`,
          );
        }
      }

      if (primaryFuel && primaryFuel !== "ALL") {
        conditions.push(
          sql`${facilities.id} IN (
            SELECT DISTINCT ${units.facilityId}
            FROM ${units}
            WHERE ${units.primaryFuel} = ${primaryFuel}
          )`,
        );
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const [countResult] = await ctx.db
        .select({ total: count() })
        .from(facilities)
        .where(whereClause);

      const totalCount = countResult?.total ?? 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      let orderClause;
      if (sortBy === "capacity") {
        orderClause =
          sortDir === "asc"
            ? asc(sql`total_capacity_mw`)
            : desc(sql`total_capacity_mw`);
      } else if (sortBy === "co2") {
        orderClause =
          sortDir === "asc"
            ? asc(sql`total_co2_tons`)
            : desc(sql`total_co2_tons`);
      } else if (sortBy === "id") {
        orderClause =
          sortDir === "asc" ? asc(facilities.id) : desc(facilities.id);
      } else {
        orderClause =
          sortDir === "asc" ? asc(facilities.name) : desc(facilities.name);
      }

      const facilityRows = await ctx.db
        .select({
          id: facilities.id,
          name: facilities.name,
          stateCode: facilities.stateCode,
          county: facilities.county,
          latitude: facilities.latitude,
          longitude: facilities.longitude,
          epaRegion: facilities.epaRegion,
          nercRegion: facilities.nercRegion,
          sourceCategory: facilities.sourceCategory,
          ownerOperator: facilities.ownerOperator,
          unitCount: sql<number>`(
            SELECT COUNT(*) FROM "units" WHERE "units"."facility_id" = "facilities"."id"
          )`.as("unit_count"),
          totalCapacityMW: sql<number>`(
            SELECT COALESCE(ROUND(SUM("units"."nameplate_capacity_mw"), 1), 0) FROM "units" WHERE "units"."facility_id" = "facilities"."id"
          )`.as("total_capacity_mw"),
          totalCo2Tons: sql<number>`(
            SELECT COALESCE(ROUND(SUM("annual_records"."co2_mass_tons"), 0), 0) FROM "annual_records" WHERE "annual_records"."facility_id" = "facilities"."id"
          )`.as("total_co2_tons"),
          primaryFuelsRaw: sql<string | null>`(
            SELECT GROUP_CONCAT(DISTINCT "units"."primary_fuel") FROM "units" WHERE "units"."facility_id" = "facilities"."id" AND "units"."primary_fuel" IS NOT NULL AND "units"."primary_fuel" != ''
          )`.as("primary_fuels_raw"),
          carbonIntensityLbsMWh: sql<number | null>`(
            SELECT ROUND(SUM("annual_records"."co2_mass_tons") * 2000.0 / NULLIF(SUM("annual_records"."gross_generation_mwh"), 0))
            FROM "annual_records"
            WHERE "annual_records"."facility_id" = "facilities"."id"
          )`.as("carbon_intensity_lbs_mwh"),
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

  /**
   * Get single facility with its generating units and annual emissions records
   */
  getFacility: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const facility = await ctx.db.query.facilities.findFirst({
        where: eq(facilities.id, input.id),
        with: {
          units: true,
          annualRecords: {
            orderBy: (rec, { desc }) => [desc(rec.year)],
            with: {
              auditLogs: true,
            },
          },
        },
      });

      return facility ?? null;
    }),

  /**
   * Head-to-Head Plant Benchmarking (PRD Section 1.2):
   * Compare 2-4 power plants side-by-side on grid attributes, capacity, and emissions.
   */
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
        const totalCapacityMW = plant.units.reduce(
          (acc, u) => acc + (u.nameplateCapacityMW ?? 0),
          0,
        );

        const primaryFuels = Array.from(
          new Set(plant.units.map((u) => u.primaryFuel).filter(Boolean)),
        );

        const secondaryFuels = Array.from(
          new Set(plant.units.map((u) => u.secondaryFuel).filter(Boolean)),
        );

        const totalGenerationMWh = plant.annualRecords.reduce(
          (acc, r) => acc + r.grossGenerationMWh,
          0,
        );

        const totalOperatingHours = plant.annualRecords.reduce(
          (acc, r) => acc + r.operatingHours,
          0,
        );

        const totalCo2Tons = plant.annualRecords.reduce(
          (acc, r) => acc + r.co2MassTons,
          0,
        );

        const totalSo2Tons = plant.annualRecords.reduce(
          (acc, r) => acc + r.so2MassTons,
          0,
        );

        const totalNoxTons = plant.annualRecords.reduce(
          (acc, r) => acc + r.noxMassTons,
          0,
        );

        const totalHeatInputMMBtu = plant.annualRecords.reduce(
          (acc, r) => acc + r.heatInputMMBtu,
          0,
        );

        const carbonIntensity =
          totalGenerationMWh > 0
            ? Math.round((totalCo2Tons * 2000.0) / totalGenerationMWh)
            : null;

        const heatRate =
          totalGenerationMWh > 0
            ? Number((totalHeatInputMMBtu / totalGenerationMWh).toFixed(2))
            : null;

        const operatingUnitsCount = plant.units.filter((u) =>
          (u.operatingStatus ?? "").toLowerCase().includes("op"),
        ).length;

        const so2ControlledUnits = plant.units.filter((u) =>
          Boolean(u.so2Controls),
        ).length;

        const noxControlledUnits = plant.units.filter((u) =>
          Boolean(u.noxControls),
        ).length;

        const pmControlledUnits = plant.units.filter((u) =>
          Boolean(u.pmControls),
        ).length;

        return {
          id: plant.id,
          name: plant.name,
          stateCode: plant.stateCode,
          county: plant.county,
          nercRegion: plant.nercRegion ?? "Unassigned",
          sourceCategory: plant.sourceCategory ?? "Unassigned",
          ownerOperator: plant.ownerOperator ?? "Unspecified",
          unitCount: plant.units.length,
          operatingUnitsCount,
          totalCapacityMW: Math.round(totalCapacityMW),
          primaryFuels,
          secondaryFuels,
          totalOperatingHours: Math.round(totalOperatingHours),
          totalGenerationMWh: Math.round(totalGenerationMWh),
          totalCo2Tons: Math.round(totalCo2Tons),
          totalSo2Tons: Math.round(totalSo2Tons),
          totalNoxTons: Math.round(totalNoxTons),
          carbonIntensityLbsMWh: carbonIntensity,
          heatRateMMBtuMWh: heatRate,
          so2ControlledUnits,
          noxControlledUnits,
          pmControlledUnits,
          units: plant.units,
        };
      });
    }),

  /**
   * Data Quality Audit Log Viewer (PRD Section 1.4 & 3.3):
   * Query records flagged by the physical sanity anomaly engine.
   */
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

  /**
   * Trigger EPA CAMPD API synchronization directly from the client.
   */
  syncCampdData: publicProcedure
    .input(
      z.object({
        year: z.number().min(2010).max(2026).default(2022),
        stateCode: z.string().optional(),
        limit: z.number().min(10).max(500).default(100),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await syncCampdAnnualEmissions({
        year: input.year,
        stateCode: input.stateCode,
        perPage: input.limit,
        maxPages: 1, // 1 page per on-demand click
      });

      return result;
    }),
});
