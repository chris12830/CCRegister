CREATE TABLE `schedule_items` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`program` text NOT NULL,
	`child_name` text NOT NULL,
	`notes` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_schedule_business_date` ON `schedule_items` (`business_id`,`date`);