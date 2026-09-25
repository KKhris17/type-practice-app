CREATE TABLE `passages` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`word_count` integer NOT NULL,
	`order_index` integer NOT NULL,
	`evidence_json` text NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_passages_source_id` ON `passages` (`source_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`passage_id` text,
	`mode` text NOT NULL,
	`expected_text` text NOT NULL,
	`final_text` text NOT NULL,
	`events_json` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`wpm` integer NOT NULL,
	`accuracy` integer NOT NULL,
	`raw_errors` integer NOT NULL,
	`corrections` integer NOT NULL,
	`completion_kind` text NOT NULL,
	FOREIGN KEY (`passage_id`) REFERENCES `passages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_completed_at` ON `sessions` (`completed_at`);--> statement-breakpoint
CREATE INDEX `idx_sessions_mode_completed_at` ON `sessions` (`mode`,`completed_at`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`original_file_name` text NOT NULL,
	`source_title` text NOT NULL,
	`source_url` text,
	`content_hash` text NOT NULL,
	`imported_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sources_content_hash_unique` ON `sources` (`content_hash`);--> statement-breakpoint
PRAGMA optimize;
