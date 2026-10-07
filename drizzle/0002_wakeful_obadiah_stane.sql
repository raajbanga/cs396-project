CREATE TABLE `import_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`dataset_id` text NOT NULL,
	`row_number` integer NOT NULL,
	`kind` text NOT NULL,
	`reason` text NOT NULL,
	`raw_row` text NOT NULL,
	FOREIGN KEY (`dataset_id`) REFERENCES `datasets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `import_issue_dataset_idx` ON `import_issues` (`dataset_id`);--> statement-breakpoint
ALTER TABLE `annual_records` ADD `steam_load_klb` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `datasets` ADD `original_filename` text;--> statement-breakpoint
ALTER TABLE `datasets` ADD `archived_path` text;--> statement-breakpoint
ALTER TABLE `datasets` ADD `query_params` text;--> statement-breakpoint
ALTER TABLE `datasets` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `units` ADD `retirement_date` text;