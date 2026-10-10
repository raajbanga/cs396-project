DROP INDEX `annual_record_facility_idx`;--> statement-breakpoint
CREATE INDEX `annual_record_facility_year_idx` ON `annual_records` (`facility_id`,`year`);