ALTER TABLE `sources` ADD `collection_id` text;--> statement-breakpoint
ALTER TABLE `sources` ADD `collection_title` text;--> statement-breakpoint
ALTER TABLE `sources` ADD `part_title` text;--> statement-breakpoint
ALTER TABLE `sources` ADD `part_order` integer;--> statement-breakpoint
CREATE INDEX `idx_sources_collection_id` ON `sources` (`collection_id`);
