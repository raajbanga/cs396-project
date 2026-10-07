import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { z } from "zod";

import {
  getCampdPublishedYear,
  GRANULARITIES,
} from "~/lib/campd-reporting-period";
import { deriveRates, sumTotals } from "~/lib/emissions-metrics";
import {
  campdRetrievalSchema,
  facilityFilterSchema,
  multiValueOptions,
  SORT_FIELDS,
  UNIT_METRICS,
  UNIT_SORT_FIELDS,
  type FilterInput,
  type SortDirection,
  type SortField,
  type UnitSortField,
} from "~/lib/facility-filters";
import {
  hasAirQualityControls,
  isOperatingStatus,
} from "~/lib/plant-narrative";
import { uniqueStrings } from "~/lib/utils";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  fetchGranularEmissionsForFacility,
  getCampdRetrievalOptions,
  resolveCampdPublishedThrough,
  syncCampdAnnualEmissions,
} from "~/server/campd/client";
import { type db as Database } from "~/server/db";
import {
  annualRecords,
  dataAuditLogs,
  datasets,
  facilities,
  units,
} from "~/server/db/schema";

const yearClause = (year?: number) =>
  year === undefined ? sql`` : sql` AND "annual_records"."year" = ${year}`;

/** Correlated per-facility subqueries over child tables; record totals cover `year` when given, else all years. */
const facilityMetrics = (year?: number) => ({
  unitCount: sql<number>`(
    SELECT COUNT(*) FROM "units" WHERE "units"."facility_id" = "facilities"."id"
  )`,
  totalCapacityMW: sql<number>`(
    SELECT COALESCE(ROUND(SUM("units"."nameplate_capacity_mw"), 1), 0)
    FROM "units" WHERE "units"."facility_id" = "facilities"."id"
  )`,
  totalCo2Tons: sql<number>`(
    SELECT COALESCE(ROUND(SUM("annual_records"."co2_mass_tons"), 0), 0)
    FROM "annual_records" WHERE "annual_records"."facility_id" = "facilities"."id"${yearClause(year)}
  )`,
});

const perFacility = (year?: number) => {
  const m = facilityMetrics(year);
  return {
    unitCount: m.unitCount.as("unit_count"),
    totalCapacityMW: m.totalCapacityMW.as("total_capacity_mw"),
    totalCo2Tons: m.totalCo2Tons.as("total_co2_tons"),
  };
};

const facilitySortColumns = (year?: number) => {
  const m = facilityMetrics(year);
  return {
    name: facilities.name,
    id: facilities.id,
    capacity: m.totalCapacityMW,
    co2: m.totalCo2Tons,
  } satisfies Record<SortField, unknown>;
};

const UNIT_SORT_COLUMNS = {
  facility: facilities.name,
  unitId: units.unitId,
  state: facilities.stateCode,
  year: annualRecords.year,
  capacity: units.nameplateCapacityMW,
  operatingHours: annualRecords.operatingHours,
  grossGenerationMWh: annualRecords.grossGenerationMWh,
  heatInputMMBtu: annualRecords.heatInputMMBtu,
  co2MassTons: annualRecords.co2MassTons,
  so2MassTons: annualRecords.so2MassTons,
  noxMassTons: annualRecords.noxMassTons,
  co2Intensity: annualRecords.co2IntensityLbsMWh,
  heatRate: annualRecords.heatRateMMBtuMWh,
} satisfies Record<UnitSortField, SQLiteColumn>;

const pagingSchema = {
  page: z.number().min(1).default(1),
  pageSize: z.number().min(5).max(100).default(10),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
};

/**
 * §8.3 ranking: ROW_NUMBER() over the sort order (NULLs last, `tiebreak` for a stable order),
 * restarting per state when rankGroup is "state". Rows are paged in rank order.
 */
const rankOver = (
  sortExpr: SQL | SQLiteColumn,
  dir: SortDirection,
  tiebreak: SQLiteColumn,
  rankGroup?: string,
) =>
  sql<number>`ROW_NUMBER() OVER (${
    rankGroup === "state" ? sql`PARTITION BY ${facilities.stateCode} ` : sql``
  }ORDER BY ${sortExpr} IS NULL, ${sortExpr} ${sql.raw(dir.toUpperCase())}, ${tiebreak})`.as(
    "rank",
  );

/** Keeps the top N ranks (overall or per state) and returns rank order, grouped by state when ranking per state. */
function rankWindow(
  ranked: { rank: SQL.Aliased<number>; stateCode: SQLiteColumn },
  { topN, rankGroup }: FilterInput,
) {
  const n = Number(topN);
  return {
    where: Number.isInteger(n) && n > 0 ? lte(ranked.rank, n) : undefined,
    orderBy:
      rankGroup === "state"
        ? [asc(ranked.stateCode), asc(ranked.rank)]
        : [asc(ranked.rank)],
  };
}

/**
 * An API sync whose records were all taken over by a later sync of the same year. Kept as
 * retrieval history. Uploads are never marked: facility files own no annual records by design,
 * and neither are retrievals that matched nothing. Qualified by hand: single-table selects
 * drop table prefixes, which would bind "id" to annual_records inside the subquery.
 */
const isSuperseded = sql<boolean>`("datasets"."source" = 'API' AND "datasets"."valid_records" > 0 AND NOT EXISTS (
  SELECT 1 FROM "annual_records" WHERE "annual_records"."dataset_id" = "datasets"."id"
))`;

const notBlank = (col: SQLiteColumn) =>
  sql`${col} IS NOT NULL AND ${col} != ''`;

const active = (v?: string): v is string => Boolean(v?.trim()) && v !== "ALL";

/** Case-insensitive substring match, for multi-valued unit columns ("Coal" matches "Coal, Pipeline Natural Gas"). */
const contains = (col: SQLiteColumn, value: string) =>
  sql`lower(${col}) LIKE ${`%${value.trim().toLowerCase()}%`}`;

/** "1,000" / " 5e5 " → number; undefined when blank or not a number. */
function toNumber(v?: string) {
  const trimmed = v?.replace(/,/g, "").trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

const filterYear = (f: FilterInput) =>
  active(f.year) ? toNumber(f.year) : undefined;

/** Conditions on the facility row. */
function facilityConditions(f: FilterInput): SQL[] {
  const conditions: SQL[] = [];
  if (active(f.stateCode)) {
    conditions.push(eq(facilities.stateCode, f.stateCode));
  }
  if (active(f.nercRegion)) {
    conditions.push(eq(facilities.nercRegion, f.nercRegion));
  }
  if (active(f.county)) conditions.push(eq(facilities.county, f.county));
  const facilityId = toNumber(f.facilityId);
  if (facilityId !== undefined) {
    conditions.push(eq(facilities.id, facilityId));
  }
  const search = f.search?.trim();
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

/** Conditions on the unit's attributes (§8.1); fuels, unit type, and controls match by "contains". */
function unitConditions(f: FilterInput): SQL[] {
  const conditions: SQL[] = [];
  if (f.unitId?.trim()) {
    conditions.push(
      sql`lower(${units.unitId}) = ${f.unitId.trim().toLowerCase()}`,
    );
  }
  const containsFilters = [
    [units.primaryFuel, f.primaryFuel],
    [units.secondaryFuel, f.secondaryFuel],
    [units.unitType, f.unitType],
    [units.so2Controls, f.so2Control],
    [units.noxControls, f.noxControl],
    [units.pmControls, f.pmControl],
  ] as const;
  for (const [col, value] of containsFilters) {
    if (active(value)) conditions.push(contains(col, value));
  }
  return conditions;
}

/** Conditions on the unit-year record: reporting year and §8.2 min/max ranges. */
function recordConditions(f: FilterInput): SQL[] {
  const conditions: SQL[] = [];
  const year = filterYear(f);
  if (year !== undefined) conditions.push(eq(annualRecords.year, year));
  for (const { key } of UNIT_METRICS) {
    const min = toNumber(f[`${key}Min`]);
    const max = toNumber(f[`${key}Max`]);
    if (min !== undefined) conditions.push(gte(annualRecords[key], min));
    if (max !== undefined) conditions.push(lte(annualRecords[key], max));
  }
  return conditions;
}

/**
 * Facility-level filter (Facilities + Map views). Unit and unit-year filters keep facilities with at
 * least one matching unit(-year). IN-subqueries instead of joins: single-table selects render
 * columns unqualified, which a join would make ambiguous.
 */
function filterConditions(f: FilterInput = {}): SQL[] {
  const conditions = facilityConditions(f);
  const unit = unitConditions(f);
  const record = recordConditions(f);
  const unitIds = unit.length
    ? sql`${annualRecords.unitInternalId} IN (SELECT ${units.id} FROM ${units} WHERE ${and(...unit)})`
    : undefined;
  if (record.length) {
    conditions.push(
      sql`${facilities.id} IN (SELECT ${annualRecords.facilityId} FROM ${annualRecords} WHERE ${and(...record, unitIds)})`,
    );
  } else if (unit.length) {
    conditions.push(
      sql`${facilities.id} IN (SELECT ${units.facilityId} FROM ${units} WHERE ${and(...unit)})`,
    );
  }
  return conditions;
}

/**
 * Facilities matching the filters, ranked by the sort (§8.3). Shared by the Facilities view (paged)
 * and the CSV export (every row).
 */
export function rankedFacilities(
  database: typeof Database,
  input: FilterInput & { sortBy: SortField; sortDir: SortDirection },
) {
  const { sortBy, sortDir } = input;
  const year = filterYear(input);
  const yearRecords = yearClause(year);
  const ranked = database
    .select({
      id: facilities.id,
      name: facilities.name,
      stateCode: facilities.stateCode,
      county: facilities.county,
      nercRegion: facilities.nercRegion,
      sourceCategory: facilities.sourceCategory,
      ownerOperator: facilities.ownerOperator,
      ...perFacility(year),
      primaryFuelsRaw: sql<string | null>`(
        SELECT GROUP_CONCAT(DISTINCT "units"."primary_fuel") FROM "units" WHERE "units"."facility_id" = "facilities"."id" AND "units"."primary_fuel" IS NOT NULL AND "units"."primary_fuel" != ''
      )`.as("primary_fuels_raw"),
      carbonIntensityLbsMWh: sql<number | null>`(
        SELECT ROUND(SUM("annual_records"."co2_mass_tons") * 2000.0 / NULLIF(SUM("annual_records"."gross_generation_mwh"), 0))
        FROM "annual_records" WHERE "annual_records"."facility_id" = "facilities"."id"${yearRecords}
      )`.as("carbon_intensity_lbs_mwh"),
      controlledUnitsCount: sql<number>`(
        SELECT COUNT(*) FROM "units" WHERE "units"."facility_id" = "facilities"."id" AND ("units"."so2_controls" IS NOT NULL OR "units"."nox_controls" IS NOT NULL OR "units"."pm_controls" IS NOT NULL OR "units"."hg_controls" IS NOT NULL)
      )`.as("controlled_units_count"),
      totalOperatingHours: sql<number>`(
        SELECT COALESCE(ROUND(SUM("annual_records"."operating_hours"), 0), 0) FROM "annual_records" WHERE "annual_records"."facility_id" = "facilities"."id"${yearRecords}
      )`.as("total_operating_hours"),
      rank: rankOver(
        facilitySortColumns(year)[sortBy],
        sortDir,
        facilities.id,
        input.rankGroup,
      ),
    })
    .from(facilities)
    .where(and(...filterConditions(input)))
    .as("ranked");
  return { ranked, ...rankWindow(ranked, input) };
}

/**
 * Unit-years (annual_records ⨝ units ⨝ facilities) matching the filters and `scope`, ranked by the
 * sort (§8.3). Shared by the Units view (paged) and the CSV exports (every row).
 */
export function rankedUnitYears(
  database: typeof Database,
  input: FilterInput & { sortBy: UnitSortField; sortDir: SortDirection },
  scope: SQL[] = [],
) {
  const { sortBy, sortDir } = input;
  const ranked = database
    .select({
      id: annualRecords.id,
      unitInternalId: annualRecords.unitInternalId,
      facilityId: annualRecords.facilityId,
      facilityName: facilities.name,
      stateCode: facilities.stateCode,
      county: facilities.county,
      unitId: units.unitId,
      unitType: units.unitType,
      primaryFuel: units.primaryFuel,
      secondaryFuel: units.secondaryFuel,
      so2Controls: units.so2Controls,
      noxControls: units.noxControls,
      pmControls: units.pmControls,
      hgControls: units.hgControls,
      programCode: units.programCode,
      operatingStatus: units.operatingStatus,
      commercialOpDate: units.commercialOpDate,
      retirementDate: units.retirementDate,
      nameplateCapacityMW: units.nameplateCapacityMW,
      year: annualRecords.year,
      datasetId: annualRecords.datasetId,
      operatingHours: annualRecords.operatingHours,
      grossGenerationMWh: annualRecords.grossGenerationMWh,
      heatInputMMBtu: annualRecords.heatInputMMBtu,
      steamLoadKlb: annualRecords.steamLoadKlb,
      co2MassTons: annualRecords.co2MassTons,
      so2MassTons: annualRecords.so2MassTons,
      noxMassTons: annualRecords.noxMassTons,
      co2IntensityLbsMWh: annualRecords.co2IntensityLbsMWh,
      heatRateMMBtuMWh: annualRecords.heatRateMMBtuMWh,
      rank: rankOver(
        UNIT_SORT_COLUMNS[sortBy],
        sortDir,
        annualRecords.id,
        input.rankGroup,
      ),
    })
    .from(annualRecords)
    .innerJoin(units, eq(annualRecords.unitInternalId, units.id))
    .innerJoin(facilities, eq(annualRecords.facilityId, facilities.id))
    .where(
      and(
        ...facilityConditions(input),
        ...unitConditions(input),
        ...recordConditions(input),
        ...scope,
      ),
    )
    .as("ranked");
  return { ranked, ...rankWindow(ranked, input) };
}

/** Datasets newest first with their parameters, counts, and superseded status (§5 history, §10 provenance). */
export const datasetHistory = (database: typeof Database) =>
  database
    .select({
      id: datasets.id,
      name: datasets.name,
      source: datasets.source,
      reportingYear: datasets.reportingYear,
      importedAt: datasets.importedAt,
      rawRecordCount: datasets.rawRecordCount,
      validRecords: datasets.validRecords,
      flaggedRecords: datasets.flaggedRecords,
      originalFilename: datasets.originalFilename,
      archivedPath: datasets.archivedPath,
      queryParams: datasets.queryParams,
      notes: datasets.notes,
      superseded: isSuperseded.mapWith(Boolean),
    })
    .from(datasets)
    .orderBy(desc(datasets.importedAt), desc(datasets.reportingYear))
    .$dynamic();

async function distinctValues(database: typeof Database, column: SQLiteColumn) {
  const rows = await database
    .selectDistinct({ value: column })
    .from(column.table)
    .where(notBlank(column))
    .orderBy(asc(column));
  return rows.map((r) => String(r.value));
}

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
    const coverage = await ctx.db
      .select({ year: annualRecords.year, records: count() })
      .from(annualRecords)
      .groupBy(annualRecords.year)
      .orderBy(annualRecords.year);
    const sources = await ctx.db
      .select({
        source: datasets.source,
        datasets: sql<number>`SUM(NOT ${isSuperseded})`,
        superseded: sql<number>`SUM(${isSuperseded})`,
        lastImportedAt: sql<number>`MAX(${datasets.importedAt})`.mapWith(
          datasets.importedAt,
        ),
      })
      .from(datasets)
      .groupBy(datasets.source)
      .orderBy(datasets.source);
    return { ...stats!, coverage, sources };
  }),

  getFilterOptions: publicProcedure.query(async ({ ctx }) => {
    const tokens = async (column: SQLiteColumn) =>
      multiValueOptions(await distinctValues(ctx.db, column));
    return {
      states: await distinctValues(ctx.db, facilities.stateCode),
      fuels: await tokens(units.primaryFuel),
      nercRegions: await distinctValues(ctx.db, facilities.nercRegion),
      counties: await ctx.db
        .selectDistinct({
          county: facilities.county,
          stateCode: facilities.stateCode,
        })
        .from(facilities)
        .where(notBlank(facilities.county))
        .orderBy(asc(facilities.county), asc(facilities.stateCode))
        .then((rows) =>
          rows.map((r) => ({ county: r.county!, stateCode: r.stateCode })),
        ),
      years: (await distinctValues(ctx.db, annualRecords.year))
        .map(Number)
        .reverse(),
      secondaryFuels: await tokens(units.secondaryFuel),
      unitTypes: await tokens(units.unitType),
      so2Controls: await tokens(units.so2Controls),
      noxControls: await tokens(units.noxControls),
      pmControls: await tokens(units.pmControls),
    };
  }),

  getFacilities: publicProcedure
    .input(
      facilityFilterSchema.extend({
        ...pagingSchema,
        sortBy: z.enum(SORT_FIELDS).default("name"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize } = input;
      const { ranked, where, orderBy } = rankedFacilities(ctx.db, input);

      const [countResult] = await ctx.db
        .select({ total: count() })
        .from(ranked)
        .where(where);
      const totalCount = countResult?.total ?? 0;
      const rows = await ctx.db
        .select()
        .from(ranked)
        .where(where)
        .orderBy(...orderBy)
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

  /** §8 Units view: one row per facility-unit-year (annual_records ⨝ units ⨝ facilities), filtered, ranked, paged. */
  getUnitYears: publicProcedure
    .input(
      facilityFilterSchema.extend({
        ...pagingSchema,
        sortBy: z.enum(UNIT_SORT_FIELDS).default("co2MassTons"),
        sortDir: z.enum(["asc", "desc"]).default("desc"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize } = input;
      const { ranked, where, orderBy } = rankedUnitYears(ctx.db, input);

      const [countResult] = await ctx.db
        .select({ total: count() })
        .from(ranked)
        .where(where);
      const totalCount = countResult?.total ?? 0;
      const items = await ctx.db
        .select()
        .from(ranked)
        .where(where)
        .orderBy(...orderBy)
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      return {
        items,
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
          ...perFacility(input && filterYear(input)),
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
            with: {
              unit: true,
              auditLogs: true,
              dataset: {
                columns: { name: true, source: true, importedAt: true },
              },
            },
          },
        },
      }),
    ),

  /** Unit detail (§8.4): identification, fuels + controls, and every reporting year with its source dataset. */
  getUnit: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.query.units.findFirst({
        where: eq(units.id, input.id),
        with: {
          facility: true,
          annualRecords: {
            orderBy: (rec, { desc }) => [desc(rec.year)],
            with: {
              auditLogs: true,
              dataset: {
                columns: { name: true, source: true, importedAt: true },
              },
            },
          },
        },
      }),
    ),

  /** Compare dock: 2–4 entries, each a whole facility (`ids`) or a single unit (`unitIds`, §8.3 unit compare). */
  compareFacilities: publicProcedure
    .input(
      z
        .object({
          ids: z.array(z.number()).default([]),
          unitIds: z.array(z.string()).default([]),
        })
        .refine((i) => {
          const n = i.ids.length + i.unitIds.length;
          return n >= 2 && n <= 4;
        }, "Compare 2 to 4 facilities or units."),
    )
    .query(async ({ ctx, input }) => {
      const facilityRows = input.ids.length
        ? await ctx.db.query.facilities.findMany({
            where: inArray(facilities.id, input.ids),
            with: { units: true, annualRecords: true },
          })
        : [];
      const unitRows = input.unitIds.length
        ? await ctx.db.query.units.findMany({
            where: inArray(units.id, input.unitIds),
            with: { facility: true, annualRecords: true },
          })
        : [];
      const plants = [
        ...facilityRows.map((f) => ({
          ...f,
          key: `facility:${f.id}`,
          unitInternalId: null,
        })),
        ...unitRows.map(({ facility, annualRecords, ...unit }) => ({
          ...facility,
          name: `${facility.name} · Unit ${unit.unitId}`,
          key: `unit:${unit.id}`,
          unitInternalId: unit.id,
          units: [unit],
          annualRecords,
        })),
      ];

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
          key: plant.key,
          unitInternalId: plant.unitInternalId,
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

  /** Retrieval history (§5): every dataset, newest first, with its parameters and counts. */
  getDatasets: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }))
    .query(({ ctx, input }) => datasetHistory(ctx.db).limit(input.limit)),

  getRetrievalOptions: publicProcedure.query(() => getCampdRetrievalOptions()),

  /** Pulls CAMPD annual emissions for each year in the range, one dataset per year; stops at the first error. */
  retrieveCampd: publicProcedure
    .input(campdRetrievalSchema)
    .mutation(async ({ input: { fromYear, toYear, ...filters } }) => {
      const results: Awaited<ReturnType<typeof syncCampdAnnualEmissions>>[] =
        [];
      for (let year = fromYear; year <= toYear; year++) {
        try {
          results.push(await syncCampdAnnualEmissions({ year, filters }));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return { results, error: `${year}: ${message}` };
        }
      }
      return { results, error: null };
    }),

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
