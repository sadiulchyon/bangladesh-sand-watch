CREATE TABLE `backfill_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`status` text NOT NULL,
	`checked_at` text
);
--> statement-breakpoint
CREATE TABLE `discovery_log` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_url` text NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `search_log` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`checked_at` text NOT NULL
);
