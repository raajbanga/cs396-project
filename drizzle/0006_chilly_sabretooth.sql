-- Metrics become nullable (NULL = not reported); per-year control/program columns are added and
-- backfilled from each record's unit until the next CAMPD sync supplies the year's own values.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_annual_records` (
	`id` text PRIMARY KEY NOT NULL,
	`dataset_id` text,
	`facility_id` integer NOT NULL,
	`unit_internal_id` text NOT NULL,
	`year` integer NOT NULL,
	`operating_hours` real,
	`gross_generation_mwh` real,
	`heat_input_mmbtu` real,
	`steam_load_klb` real,
	`co2_mass_tons` real,
	`so2_mass_tons` real,
	`nox_mass_tons` real,
	`so2_controls` text,
	`nox_controls` text,
	`pm_controls` text,
	`hg_controls` text,
	`program_code` text,
	`co2_intensity_lbs_mwh` real,
	`heat_rate_mmbtu_mwh` real,
	FOREIGN KEY (`dataset_id`) REFERENCES `datasets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`facility_id`) REFERENCES `facilities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`unit_internal_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_annual_records`("id", "dataset_id", "facility_id", "unit_internal_id", "year", "operating_hours", "gross_generation_mwh", "heat_input_mmbtu", "steam_load_klb", "co2_mass_tons", "so2_mass_tons", "nox_mass_tons", "so2_controls", "nox_controls", "pm_controls", "hg_controls", "program_code", "co2_intensity_lbs_mwh", "heat_rate_mmbtu_mwh") SELECT "id", "dataset_id", "facility_id", "unit_internal_id", "year", "operating_hours", "gross_generation_mwh", "heat_input_mmbtu", "steam_load_klb", "co2_mass_tons", "so2_mass_tons", "nox_mass_tons", (SELECT `so2_controls` FROM `units` WHERE `units`.`id` = `annual_records`.`unit_internal_id`), (SELECT `nox_controls` FROM `units` WHERE `units`.`id` = `annual_records`.`unit_internal_id`), (SELECT `pm_controls` FROM `units` WHERE `units`.`id` = `annual_records`.`unit_internal_id`), (SELECT `hg_controls` FROM `units` WHERE `units`.`id` = `annual_records`.`unit_internal_id`), (SELECT `program_code` FROM `units` WHERE `units`.`id` = `annual_records`.`unit_internal_id`), "co2_intensity_lbs_mwh", "heat_rate_mmbtu_mwh" FROM `annual_records`;--> statement-breakpoint
DROP TABLE `annual_records`;--> statement-breakpoint
ALTER TABLE `__new_annual_records` RENAME TO `annual_records`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `annual_record_unit_year_idx` ON `annual_records` (`unit_internal_id`,`year`);--> statement-breakpoint
CREATE INDEX `annual_record_facility_year_idx` ON `annual_records` (`facility_id`,`year`);--> statement-breakpoint
CREATE INDEX `annual_record_year_co2_idx` ON `annual_records` (`year`,`co2_mass_tons`);