ALTER TABLE `annual_records` ADD `facility_id` integer NOT NULL REFERENCES facilities(id);--> statement-breakpoint
CREATE INDEX `annual_record_facility_idx` ON `annual_records` (`facility_id`);--> statement-breakpoint
ALTER TABLE `facilities` ADD `epa_region` integer;--> statement-breakpoint
ALTER TABLE `facilities` ADD `nerc_region` text;--> statement-breakpoint
ALTER TABLE `facilities` ADD `source_category` text;--> statement-breakpoint
ALTER TABLE `facilities` ADD `owner_operator` text;--> statement-breakpoint
CREATE INDEX `facility_nerc_idx` ON `facilities` (`nerc_region`);--> statement-breakpoint
CREATE INDEX `facility_source_cat_idx` ON `facilities` (`source_category`);--> statement-breakpoint
ALTER TABLE `units` ADD `secondary_fuel` text;--> statement-breakpoint
ALTER TABLE `units` ADD `operating_status` text;--> statement-breakpoint
ALTER TABLE `units` ADD `commercial_op_date` text;--> statement-breakpoint
ALTER TABLE `units` ADD `max_hourly_hi_rate` real;--> statement-breakpoint
ALTER TABLE `units` ADD `nameplate_capacity_mw` real;--> statement-breakpoint
ALTER TABLE `units` ADD `so2_controls` text;--> statement-breakpoint
ALTER TABLE `units` ADD `nox_controls` text;--> statement-breakpoint
ALTER TABLE `units` ADD `pm_controls` text;--> statement-breakpoint
ALTER TABLE `units` ADD `hg_controls` text;--> statement-breakpoint
ALTER TABLE `units` ADD `program_code` text;--> statement-breakpoint
CREATE INDEX `unit_operating_status_idx` ON `units` (`operating_status`);