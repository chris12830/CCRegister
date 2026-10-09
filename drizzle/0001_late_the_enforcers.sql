CREATE TABLE `enrollment_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`user_id` text NOT NULL,
	`field_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_attachment_submission` ON `enrollment_attachments` (`submission_id`);--> statement-breakpoint
CREATE INDEX `idx_enrollment_user_updated` ON `enrollment_submissions` (`user_id`,`updated_at`);