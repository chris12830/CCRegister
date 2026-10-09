CREATE TABLE `enrollment_form_versions` (
	`version` integer PRIMARY KEY NOT NULL,
	`definition` text NOT NULL,
	`published_at` text NOT NULL,
	`published_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `enrollment_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`country` text NOT NULL,
	`region` text NOT NULL,
	`form_version` integer NOT NULL,
	`status` text NOT NULL,
	`answers` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`submitted_at` text
);
