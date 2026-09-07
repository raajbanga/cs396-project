CREATE TABLE `annual_records` (
	`id` text PRIMARY KEY NOT NULL,
	`dataset_id` text,
	`unit_internal_id` text NOT NULL,
	`year` integer NOT NULL,
	`operating_hours` real DEFAULT 0 NOT NULL,
	`gross_generation_mwh` real DEFAULT 0 NOT NULL,
	`heat_input_mmbtu` real DEFAULT 0 NOT NULL,
	`co2_mass_tons` real DEFAULT 0 NOT NULL,
	`so2_mass_tons` real DEFAULT 0 NOT NULL,
	`nox_mass_tons` real DEFAULT 0 NOT NULL,
	`co2_intensity_lbs_mwh` real,
	`heat_rate_mmbtu_mwh` real,
	FOREIGN KEY (`dataset_id`) REFERENCES `datasets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`unit_internal_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `annual_record_unit_year_idx` ON `annual_records` (`unit_internal_id`,`year`);--> statement-breakpoint
CREATE INDEX `annual_record_year_co2_idx` ON `annual_records` (`year`,`co2_mass_tons`);--> statement-breakpoint
CREATE TABLE `data_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`annual_record_id` text NOT NULL,
	`flag_type` text NOT NULL,
	`severity` text NOT NULL,
	`details` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`annual_record_id`) REFERENCES `annual_records`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_annual_record_idx` ON `data_audit_logs` (`annual_record_id`);--> statement-breakpoint
CREATE TABLE `datasets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`source` text NOT NULL,
	`reporting_year` integer NOT NULL,
	`imported_at` integer DEFAULT (unixepoch()) NOT NULL,
	`raw_record_count` integer DEFAULT 0 NOT NULL,
	`valid_records` integer DEFAULT 0 NOT NULL,
	`flagged_records` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `facilities` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`state_code` text(2) NOT NULL,
	`county` text,
	`latitude` real,
	`longitude` real
);
--> statement-breakpoint
CREATE INDEX `facility_state_idx` ON `facilities` (`state_code`);--> statement-breakpoint
CREATE INDEX `facility_name_idx` ON `facilities` (`name`);--> statement-breakpoint
CREATE TABLE `units` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text NOT NULL,
	`facility_id` integer NOT NULL,
	`unit_type` text,
	`primary_fuel` text,
	FOREIGN KEY (`facility_id`) REFERENCES `facilities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unit_facility_unit_idx` ON `units` (`facility_id`,`unit_id`);--> statement-breakpoint
CREATE INDEX `unit_facility_id_idx` ON `units` (`facility_id`);--> statement-breakpoint
CREATE INDEX `unit_primary_fuel_idx` ON `units` (`primary_fuel`);