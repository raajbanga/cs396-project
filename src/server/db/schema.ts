import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Facilities: Master table representing power plants / generating facilities (EPA ORISPL).
 * Enriched with electric reliability grid region (NERC), industrial category, owner/operator, and EPA region.
 */
export const facilities = sqliteTable(
  "facilities",
  {
    id: integer("id").primaryKey(), // EPA ORISPL / Facility ID
    name: text("name").notNull(),
    stateCode: text("state_code", { length: 2 }).notNull(),
    county: text("county"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    epaRegion: integer("epa_region"), // EPA Region (1-10)
    nercRegion: text("nerc_region"), // e.g. ERCOT, SERC, WECC, RFC, MRO, SPP
    sourceCategory: text("source_category"), // e.g. Electric Utility, Cogeneration, Industrial Boiler
    ownerOperator: text("owner_operator"), // Operating utility and owner entity
  },
  (t) => [
    index("facility_state_idx").on(t.stateCode),
    index("facility_name_idx").on(t.name),
    index("facility_nerc_idx").on(t.nercRegion),
    index("facility_source_cat_idx").on(t.sourceCategory),
  ],
);

export const facilitiesRelations = relations(facilities, ({ many }) => ({
  units: many(units),
  annualRecords: many(annualRecords),
}));

/**
 * Units: Generating units (boilers, combustion turbines, combined cycle trains).
 * Enriched with operating status, nameplate capacity, heat input rating, and environmental controls.
 */
export const units = sqliteTable(
  "units",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    unitId: text("unit_id").notNull(), // EPA Unit ID (e.g. "1", "2", "CT1")
    facilityId: integer("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    unitType: text("unit_type"),
    primaryFuel: text("primary_fuel"),
    secondaryFuel: text("secondary_fuel"),
    operatingStatus: text("operating_status"), // e.g. Operating, Retired
    commercialOpDate: text("commercial_op_date"), // Commissioning date
    maxHourlyHIRate: real("max_hourly_hi_rate"), // Max heat input rate (mmBtu/hr)
    nameplateCapacityMW: real("nameplate_capacity_mw"), // Electric nameplate capacity in MW
    so2Controls: text("so2_controls"), // e.g. Wet Limestone Scrubber
    noxControls: text("nox_controls"), // e.g. Low NOx Burner, SCR, SNCR
    pmControls: text("pm_controls"), // e.g. Electrostatic Precipitator, Fabric Filter
    hgControls: text("hg_controls"), // e.g. Activated Carbon Sorbent Injection
    programCode: text("program_code"), // e.g. ARP, CSNOX, MATS
  },
  (t) => [
    uniqueIndex("unit_facility_unit_idx").on(t.facilityId, t.unitId),
    index("unit_facility_id_idx").on(t.facilityId),
    index("unit_primary_fuel_idx").on(t.primaryFuel),
    index("unit_operating_status_idx").on(t.operatingStatus),
  ],
);

export const unitsRelations = relations(units, ({ one, many }) => ({
  facility: one(facilities, {
    fields: [units.facilityId],
    references: [facilities.id],
  }),
  annualRecords: many(annualRecords),
}));

/**
 * Datasets: Ingestion batch tracking for API syncs or bulk CSV file uploads.
 */
export const datasets = sqliteTable("datasets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  source: text("source").notNull(), // "API" | "BULK_CSV"
  reportingYear: integer("reporting_year").notNull(),
  importedAt: integer("imported_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
  rawRecordCount: integer("raw_record_count").default(0).notNull(),
  validRecords: integer("valid_records").default(0).notNull(),
  flaggedRecords: integer("flagged_records").default(0).notNull(),
});

export const datasetsRelations = relations(datasets, ({ many }) => ({
  annualRecords: many(annualRecords),
}));

/**
 * Annual Records: Apportioned emissions and operational metrics per unit per year.
 */
export const annualRecords = sqliteTable(
  "annual_records",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    datasetId: text("dataset_id").references(() => datasets.id, {
      onDelete: "cascade",
    }),
    facilityId: integer("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    unitInternalId: text("unit_internal_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    operatingHours: real("operating_hours").default(0.0).notNull(),
    grossGenerationMWh: real("gross_generation_mwh").default(0.0).notNull(),
    heatInputMMBtu: real("heat_input_mmbtu").default(0.0).notNull(),
    co2MassTons: real("co2_mass_tons").default(0.0).notNull(),
    so2MassTons: real("so2_mass_tons").default(0.0).notNull(),
    noxMassTons: real("nox_mass_tons").default(0.0).notNull(),

    // Derived Metrics (PRD Section 1.2 & 3.3)
    co2IntensityLbsMWh: real("co2_intensity_lbs_mwh"), // (co2MassTons * 2000) / grossGenerationMWh
    heatRateMMBtuMWh: real("heat_rate_mmbtu_mwh"), // heatInputMMBtu / grossGenerationMWh
  },
  (t) => [
    uniqueIndex("annual_record_unit_year_idx").on(t.unitInternalId, t.year),
    index("annual_record_facility_idx").on(t.facilityId),
    index("annual_record_year_co2_idx").on(t.year, t.co2MassTons),
  ],
);

export const annualRecordsRelations = relations(
  annualRecords,
  ({ one, many }) => ({
    facility: one(facilities, {
      fields: [annualRecords.facilityId],
      references: [facilities.id],
    }),
    unit: one(units, {
      fields: [annualRecords.unitInternalId],
      references: [units.id],
    }),
    dataset: one(datasets, {
      fields: [annualRecords.datasetId],
      references: [datasets.id],
    }),
    auditLogs: many(dataAuditLogs),
  }),
);

/**
 * Data Audit Logs: Recorded anomalies and validation flags for annual records (PRD Section 3.3).
 */
export const dataAuditLogs = sqliteTable(
  "data_audit_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    annualRecordId: text("annual_record_id")
      .notNull()
      .references(() => annualRecords.id, { onDelete: "cascade" }),
    flagType: text("flag_type").notNull(), // "ZERO_EMISSIONS_HIGH_HEAT" | "PHANTOM_GENERATION" | "EXTREME_HEAT_RATE"
    severity: text("severity").notNull(), // "WARN" | "ERROR"
    details: text("details").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
  },
  (t) => [index("audit_annual_record_idx").on(t.annualRecordId)],
);

export const dataAuditLogsRelations = relations(dataAuditLogs, ({ one }) => ({
  annualRecord: one(annualRecords, {
    fields: [dataAuditLogs.annualRecordId],
    references: [annualRecords.id],
  }),
}));

export type Facility = typeof facilities.$inferSelect;
export type NewFacility = typeof facilities.$inferInsert;
export type Unit = typeof units.$inferSelect;
export type NewUnit = typeof units.$inferInsert;
export type Dataset = typeof datasets.$inferSelect;
export type NewDataset = typeof datasets.$inferInsert;
export type AnnualRecord = typeof annualRecords.$inferSelect;
export type NewAnnualRecord = typeof annualRecords.$inferInsert;
export type DataAuditLog = typeof dataAuditLogs.$inferSelect;
export type NewDataAuditLog = typeof dataAuditLogs.$inferInsert;
