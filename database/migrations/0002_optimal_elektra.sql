CREATE TABLE `study_lesson_progress` (
	`lesson_id` text PRIMARY KEY NOT NULL,
	`best_accuracy` integer NOT NULL,
	`best_duration_ms` integer NOT NULL,
	`attempts` integer NOT NULL,
	`passed_at` integer,
	`last_practiced_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `sessions` ADD `study_lesson_id` text;
