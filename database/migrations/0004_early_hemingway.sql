CREATE TABLE `practice_passage_progress` (
	`passage_id` text PRIMARY KEY NOT NULL,
	`completions` integer NOT NULL,
	`first_completed_at` integer NOT NULL,
	`last_completed_at` integer NOT NULL,
	FOREIGN KEY (`passage_id`) REFERENCES `passages`(`id`) ON UPDATE no action ON DELETE cascade
);
