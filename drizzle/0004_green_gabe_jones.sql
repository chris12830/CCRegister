CREATE TABLE `program_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`age_group` text NOT NULL,
	`capacity` integer NOT NULL,
	`before_capacity` integer NOT NULL,
	`after_capacity` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_program_room_name` ON `program_rooms` (`business_id`,`name`);--> statement-breakpoint
CREATE INDEX `idx_program_rooms_business` ON `program_rooms` (`business_id`);--> statement-breakpoint
CREATE TABLE `registration_intakes` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`status` text NOT NULL,
	`guardian_name` text NOT NULL,
	`guardian_email` text NOT NULL,
	`guardian_phone` text NOT NULL,
	`child_first` text NOT NULL,
	`child_last` text NOT NULL,
	`child_dob` text NOT NULL,
	`care_type` text NOT NULL,
	`age_group` text NOT NULL,
	`room_id` text NOT NULL,
	`start_date` text NOT NULL,
	`week_start` text NOT NULL,
	`mode` text NOT NULL,
	`slots` text NOT NULL,
	`country` text NOT NULL,
	`region` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_intakes_business` ON `registration_intakes` (`business_id`);--> statement-breakpoint
CREATE INDEX `idx_intakes_guardian` ON `registration_intakes` (`guardian_email`);--> statement-breakpoint
CREATE TABLE `space_section_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`room_id` text NOT NULL,
	`intake_id` text NOT NULL,
	`date` text NOT NULL,
	`section` text NOT NULL,
	`space_number` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_space_section` ON `space_section_reservations` (`room_id`,`date`,`section`,`space_number`);--> statement-breakpoint
CREATE INDEX `idx_space_room_date` ON `space_section_reservations` (`room_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_space_intake` ON `space_section_reservations` (`intake_id`);--> statement-breakpoint
ALTER TABLE `enrollment_submissions` ADD `intake_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `unique_enrollment_intake` ON `enrollment_submissions` (`intake_id`);--> statement-breakpoint
INSERT INTO enrollment_form_versions (version, definition, published_at, published_by)
SELECT current.version + 1,
  json_set(current.definition, '$.fields[' || (SELECT item.key FROM json_each(current.definition, '$.fields') AS item WHERE json_extract(item.value, '$.id') = 'schedule') || '].label', 'Select Program Schedule (Days-Mornings-Afternoons-Custom)'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'system:program-schedule'
FROM enrollment_form_versions AS current
WHERE current.version = (SELECT MAX(version) FROM enrollment_form_versions)
  AND EXISTS (SELECT 1 FROM json_each(current.definition, '$.fields') AS item WHERE json_extract(item.value, '$.id') = 'schedule' AND json_extract(item.value, '$.label') = 'Requested days and hours');
