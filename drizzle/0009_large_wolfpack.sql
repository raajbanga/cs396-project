CREATE TABLE `models` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`target` text NOT NULL,
	`features` text NOT NULL,
	`params` text NOT NULL,
	`train_years` text NOT NULL,
	`validation_years` text NOT NULL,
	`test_years` text NOT NULL,
	`metrics` text NOT NULL,
	`artifact` text NOT NULL,
	`artifact_path` text NOT NULL,
	`pipeline_version` text NOT NULL,
	`trained_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `traci_factors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`traci_version` text NOT NULL,
	`pollutant` text NOT NULL,
	`substance` text NOT NULL,
	`cas` text NOT NULL,
	`medium` text NOT NULL,
	`impact_category` text NOT NULL,
	`factor` real NOT NULL,
	`factor_unit` text NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `traci_factor_idx` ON `traci_factors` (`traci_version`,`pollutant`,`medium`,`impact_category`);