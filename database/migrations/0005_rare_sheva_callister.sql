CREATE TABLE `practice_passage_resets` (
	`passage_id` text PRIMARY KEY NOT NULL,
	`reset_at` integer NOT NULL,
	FOREIGN KEY (`passage_id`) REFERENCES `passages`(`id`) ON UPDATE no action ON DELETE cascade
);
