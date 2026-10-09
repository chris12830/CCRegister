CREATE TABLE `business_settings` (
	`business_id` text PRIMARY KEY NOT NULL,
	`country` text NOT NULL,
	`region` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
