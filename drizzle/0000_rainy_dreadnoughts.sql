CREATE TABLE `archive_records` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_url` text NOT NULL,
	`doi` text,
	`data` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `archive_records_canonical_url_unique` ON `archive_records` (`canonical_url`);--> statement-breakpoint
CREATE UNIQUE INDEX `archive_records_doi_unique` ON `archive_records` (`doi`);--> statement-breakpoint
CREATE TABLE `collection_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `editorial_reviews` (
	`record_id` text PRIMARY KEY NOT NULL,
	`decision` text NOT NULL,
	`notes` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `archive_records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `source_registry` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`checked_at` text,
	`last_error` text
);
