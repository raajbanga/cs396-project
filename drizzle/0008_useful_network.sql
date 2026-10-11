-- Indexes for the per-dataset record counts in the dataset history.
CREATE INDEX `annual_record_dataset_idx` ON `annual_records` (`dataset_id`);--> statement-breakpoint
CREATE INDEX `annual_record_superseded_upload_idx` ON `annual_records` (`superseded_upload_id`);