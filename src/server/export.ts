import { asc, count, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { EXPORT_TYPES, toCsv, type CsvColumn } from "~/lib/csv";
import {
  parseExplorerParams,
  parseFacilityIds,
  type FilterInput,
  type UnitSortField,
} from "~/lib/facility-filters";
import { datasetStatus } from "~/lib/utils";
import {
  datasetHistory,
  rankedFacilities,
  rankedUnitYears,
} from "~/server/api/routers/facilities";
import { db } from "~/server/db";
import {
  annualRecords,
  dataAuditLogs,
  datasets,
  importIssues,
  units,
} from "~/server/db/schema";

/** §10 downloads behind `GET /api/export`: every export is built from the same queries as the explorer. */

/** A bad export request; the route answers with `status`. */
export class ExportError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const requestSchema = z.object({
  type: z.enum(EXPORT_TYPES, {
    errorMap: () => ({
      message: `type must be one of ${EXPORT_TYPES.join(", ")}.`,
    }),
  }),
  id: z.string().optional(),
  ids: z.string().optional(),
  unitIds: z.string().optional(),
});

type UnitYearRow = Awaited<ReturnType<typeof selectUnitYears>>[number];
type FacilityRow = Awaited<ReturnType<typeof selectFacilities>>[number];
type DatasetRow = Awaited<ReturnType<typeof datasetHistory>>[number];

const rankColumn: CsvColumn<{ rank: number }> = ["rank", (r) => r.rank];

const UNIT_YEAR_COLUMNS: CsvColumn<UnitYearRow & { auditFlags: string }>[] = [
  ["facility_id", (r) => r.facilityId],
  ["facility_name", (r) => r.facilityName],
  ["state", (r) => r.stateCode],
  ["county", (r) => r.county],
  ["unit_id", (r) => r.unitId],
  ["unit_type", (r) => r.unitType],
  ["primary_fuel", (r) => r.primaryFuel],
  ["secondary_fuel", (r) => r.secondaryFuel],
  ["so2_controls", (r) => r.so2Controls],
  ["nox_controls", (r) => r.noxControls],
  ["pm_controls", (r) => r.pmControls],
  ["hg_controls", (r) => r.hgControls],
  ["program_code", (r) => r.programCode],
  ["operating_status", (r) => r.operatingStatus],
  ["commercial_op_date", (r) => r.commercialOpDate],
  ["retirement_date", (r) => r.retirementDate],
  ["nameplate_capacity_mw", (r) => r.nameplateCapacityMW],
  ["year", (r) => r.year],
  ["operating_hours", (r) => r.operatingHours],
  ["gross_load_mwh", (r) => r.grossGenerationMWh],
  ["steam_load_klb", (r) => r.steamLoadKlb],
  ["heat_input_mmbtu", (r) => r.heatInputMMBtu],
  ["co2_mass_tons", (r) => r.co2MassTons],
  ["so2_mass_tons", (r) => r.so2MassTons],
  ["nox_mass_tons", (r) => r.noxMassTons],
  ["co2_intensity_lbs_mwh", (r) => r.co2IntensityLbsMWh],
  ["heat_rate_mmbtu_mwh", (r) => r.heatRateMMBtuMWh],
  ["audit_flags", (r) => r.auditFlags],
  ["dataset_id", (r) => r.datasetId],
];

const FACILITY_COLUMNS: CsvColumn<FacilityRow>[] = [
  ["facility_id", (r) => r.id],
  ["facility_name", (r) => r.name],
  ["state", (r) => r.stateCode],
  ["county", (r) => r.county],
  ["nerc_region", (r) => r.nercRegion],
  ["source_category", (r) => r.sourceCategory],
  ["owner_operator", (r) => r.ownerOperator],
  ["primary_fuels", (r) => r.primaryFuelsRaw?.replaceAll(",", "; ")],
  ["unit_count", (r) => r.unitCount],
  ["nameplate_capacity_mw", (r) => r.totalCapacityMW],
  ["co2_mass_tons", (r) => r.totalCo2Tons],
  ["co2_intensity_lbs_mwh", (r) => r.carbonIntensityLbsMWh],
  ["operating_hours", (r) => r.totalOperatingHours],
  ["controlled_units", (r) => r.controlledUnitsCount],
];

const PROVENANCE_COLUMNS: CsvColumn<DatasetRow & { currentRecords: number }>[] =
  [
    ["dataset_id", (r) => r.id],
    ["name", (r) => r.name],
    ["source", (r) => r.source],
    ["reporting_year", (r) => r.reportingYear],
    ["imported_at", (r) => r.importedAt],
    ["status", datasetStatus],
    ["raw_record_count", (r) => r.rawRecordCount],
    ["valid_records", (r) => r.validRecords],
    ["flagged_records", (r) => r.flaggedRecords],
    ["current_records", (r) => r.currentRecords],
    ["original_filename", (r) => r.originalFilename],
    ["archived_path", (r) => r.archivedPath],
    ["query_params", (r) => r.queryParams],
    ["notes", (r) => r.notes],
  ];

const NATURAL_ORDER = { sortBy: "facility", sortDir: "asc" } as const;

async function selectUnitYears(
  input: FilterInput & { sortBy: UnitSortField; sortDir: "asc" | "desc" },
  scope: SQL[],
  naturalOrder: boolean,
) {
  const { ranked, where, orderBy } = rankedUnitYears(db, input, scope);
  return db
    .select()
    .from(ranked)
    .where(where)
    .orderBy(
      ...(naturalOrder
        ? [asc(ranked.facilityId), asc(ranked.unitId), asc(ranked.year)]
        : orderBy),
    );
}

async function selectFacilities(input: Parameters<typeof rankedFacilities>[1]) {
  const { ranked, where, orderBy } = rankedFacilities(db, input);
  return db
    .select()
    .from(ranked)
    .where(where)
    .orderBy(...orderBy);
}

/** Unit-year CSV with each record's audit flags; `ranked` adds the §8.3 rank column. */
async function unitYearCsv(rows: UnitYearRow[], ranked = false) {
  const flags = await db
    .select({
      id: dataAuditLogs.annualRecordId,
      flags: sql<string>`GROUP_CONCAT(DISTINCT ${dataAuditLogs.flagType})`,
    })
    .from(dataAuditLogs)
    .groupBy(dataAuditLogs.annualRecordId);
  const flagsById = new Map(
    flags.map((f) => [f.id, f.flags.replaceAll(",", "; ")]),
  );
  return toCsv(
    rows.map((r) => ({ ...r, auditFlags: flagsById.get(r.id) ?? "" })),
    ranked ? [rankColumn, ...UNIT_YEAR_COLUMNS] : UNIT_YEAR_COLUMNS,
  );
}

async function findDataset(id?: string) {
  if (!id) throw new ExportError("id (a dataset ID) is required.");
  const [dataset] = await datasetHistory(db).where(eq(datasets.id, id));
  if (!dataset) throw new ExportError(`Dataset ${id} not found.`, 404);
  return dataset;
}

const today = () => new Date().toISOString().slice(0, 10);
const datasetLabel = (d: DatasetRow) =>
  `${d.source.toLowerCase()}-${d.reportingYear}-${d.id.slice(0, 8)}`;

/** Every `annual_records` row of a dataset is valid when no physical-sanity rule flagged it. */
const unflagged = sql`NOT EXISTS (SELECT 1 FROM ${dataAuditLogs} WHERE ${dataAuditLogs.annualRecordId} = ${annualRecords.id})`;

/** Builds the CSV for an `/api/export` query string; throws ExportError on a bad request. */
export async function buildExport(params: URLSearchParams) {
  const parsed = requestSchema.safeParse(Object.fromEntries(params));
  if (!parsed.success) {
    throw new ExportError(parsed.error.issues.map((i) => i.message).join(" "));
  }
  const { type, id, ids, unitIds } = parsed.data;

  switch (type) {
    case "dataset":
    case "valid": {
      const dataset = await findDataset(id);
      const scope = [eq(annualRecords.datasetId, dataset.id)];
      if (type === "valid") scope.push(unflagged);
      return {
        filename: `gridpulse_${type}_${datasetLabel(dataset)}_${today()}.csv`,
        csv: await unitYearCsv(
          await selectUnitYears(NATURAL_ORDER, scope, true),
        ),
      };
    }

    case "invalid": {
      // Data-quality report (§6): rows the upload rejected or skipped, plus stored records the
      // physical-sanity rules flagged as questionable (one row per flag).
      const dataset = await findDataset(id);
      const issues = await db
        .select()
        .from(importIssues)
        .where(eq(importIssues.datasetId, dataset.id))
        .orderBy(asc(importIssues.rowNumber));
      const flagged = await db
        .select({
          flagType: dataAuditLogs.flagType,
          severity: dataAuditLogs.severity,
          details: dataAuditLogs.details,
          facilityId: annualRecords.facilityId,
          unitId: units.unitId,
          year: annualRecords.year,
        })
        .from(dataAuditLogs)
        .innerJoin(
          annualRecords,
          eq(dataAuditLogs.annualRecordId, annualRecords.id),
        )
        .innerJoin(units, eq(annualRecords.unitInternalId, units.id))
        .where(eq(annualRecords.datasetId, dataset.id))
        .orderBy(
          asc(annualRecords.facilityId),
          asc(units.unitId),
          asc(annualRecords.year),
        );
      type IssueRow = {
        issue: string;
        severity?: string;
        flagType?: string;
        reason: string;
        rowNumber?: number;
        facilityId?: number;
        unitId?: string;
        year?: number;
        raw: Record<string, string>;
      };
      const rows: IssueRow[] = [
        ...issues.map((i) => ({
          issue: i.kind,
          severity: i.kind === "REJECTED" ? "ERROR" : "WARN",
          reason: i.reason,
          rowNumber: i.rowNumber,
          raw: i.rawRow,
        })),
        ...flagged.map(({ details, ...f }) => ({
          ...f,
          issue: "FLAGGED",
          reason: details,
          raw: {},
        })),
      ];
      const rawColumns = [
        ...new Set(issues.flatMap((i) => Object.keys(i.rawRow))),
      ];
      return {
        filename: `gridpulse_invalid_${datasetLabel(dataset)}_${today()}.csv`,
        csv: toCsv(rows, [
          ["issue", (r) => r.issue],
          ["severity", (r) => r.severity],
          ["flag_type", (r) => r.flagType],
          ["reason", (r) => r.reason],
          ["row_number", (r) => r.rowNumber],
          ["facility_id", (r) => r.facilityId],
          ["unit_id", (r) => r.unitId],
          ["year", (r) => r.year],
          ...rawColumns.map((col): CsvColumn<IssueRow> => [
            col,
            (r) => r.raw[col],
          ]),
        ]),
      };
    }

    case "search": {
      // Same state as the explorer URL (explorerSearchParams); paging is ignored.
      const { tab, filters, table, unitTable } = parseExplorerParams(
        Object.fromEntries(params),
      );
      const ranked = filters.topN !== "ALL";
      if (tab === "units") {
        return {
          filename: `gridpulse_search_units_${today()}.csv`,
          csv: await unitYearCsv(
            await selectUnitYears({ ...filters, ...unitTable }, [], false),
            ranked,
          ),
        };
      }
      const rows = await selectFacilities({ ...filters, ...table });
      return {
        filename: `gridpulse_search_facilities_${today()}.csv`,
        csv: toCsv(
          rows,
          ranked ? [rankColumn, ...FACILITY_COLUMNS] : FACILITY_COLUMNS,
        ),
      };
    }

    case "selection": {
      const facilityIds = parseFacilityIds(ids ?? "");
      const unitList = (unitIds ?? "").split(",").filter(Boolean);
      if (facilityIds === null) {
        throw new ExportError("ids must be facility IDs separated by commas.");
      }
      if (facilityIds.length + unitList.length === 0) {
        throw new ExportError(
          "Select at least one facility (ids) or unit (unitIds).",
        );
      }
      const scope = or(
        facilityIds.length
          ? inArray(annualRecords.facilityId, facilityIds)
          : undefined,
        unitList.length
          ? inArray(annualRecords.unitInternalId, unitList)
          : undefined,
      )!;
      return {
        filename: `gridpulse_selection_${today()}.csv`,
        csv: await unitYearCsv(
          await selectUnitYears(NATURAL_ORDER, [scope], true),
        ),
      };
    }

    case "provenance": {
      const rows = id ? [await findDataset(id)] : await datasetHistory(db);
      const owned = await db
        .select({ id: annualRecords.datasetId, records: count() })
        .from(annualRecords)
        .groupBy(annualRecords.datasetId);
      const ownedById = new Map(owned.map((o) => [o.id, o.records]));
      return {
        filename: `gridpulse_provenance${id ? `_${datasetLabel(rows[0]!)}` : ""}_${today()}.csv`,
        csv: toCsv(
          rows.map((r) => ({ ...r, currentRecords: ownedById.get(r.id) ?? 0 })),
          PROVENANCE_COLUMNS,
        ),
      };
    }
  }
}
