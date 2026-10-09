import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const enrollmentFormVersions = sqliteTable("enrollment_form_versions", {
  version: integer("version").primaryKey(),
  definition: text("definition").notNull(),
  publishedAt: text("published_at").notNull(),
  publishedBy: text("published_by").notNull(),
});

export const businessSettings = sqliteTable("business_settings", {
  businessId: text("business_id").primaryKey(),
  country: text("country").notNull(),
  region: text("region").notNull(),
  revision: integer("revision").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
});

export const scheduleItems = sqliteTable("schedule_items", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull(),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  program: text("program").notNull(),
  childName: text("child_name").notNull(),
  notes: text("notes").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
}, table => [index("idx_schedule_business_date").on(table.businessId, table.date)]);

export const programRooms = sqliteTable("program_rooms", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull(),
  name: text("name").notNull(),
  ageGroup: text("age_group").notNull(),
  capacity: integer("capacity").notNull(),
  beforeCapacity: integer("before_capacity").notNull(),
  afterCapacity: integer("after_capacity").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, table => [uniqueIndex("unique_program_room_name").on(table.businessId, table.name), index("idx_program_rooms_business").on(table.businessId)]);

export const registrationIntakes = sqliteTable("registration_intakes", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull(),
  status: text("status").notNull(),
  guardianName: text("guardian_name").notNull(),
  guardianEmail: text("guardian_email").notNull(),
  guardianPhone: text("guardian_phone").notNull(),
  childFirst: text("child_first").notNull(),
  childLast: text("child_last").notNull(),
  childDob: text("child_dob").notNull(),
  careType: text("care_type").notNull(),
  ageGroup: text("age_group").notNull(),
  roomId: text("room_id").notNull(),
  startDate: text("start_date").notNull(),
  weekStart: text("week_start").notNull(),
  mode: text("mode").notNull(),
  slots: text("slots").notNull(),
  hours: text("hours").notNull(),
  country: text("country").notNull(),
  region: text("region").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
}, table => [index("idx_intakes_business").on(table.businessId), index("idx_intakes_guardian").on(table.guardianEmail)]);

export const spaceSectionReservations = sqliteTable("space_section_reservations", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull(),
  roomId: text("room_id").notNull(),
  intakeId: text("intake_id").notNull(),
  date: text("date").notNull(),
  section: text("section").notNull(),
  spaceNumber: integer("space_number").notNull(),
}, table => [uniqueIndex("unique_space_section").on(table.roomId, table.date, table.section, table.spaceNumber), index("idx_space_room_date").on(table.roomId, table.date), index("idx_space_intake").on(table.intakeId)]);

export const enrollmentSubmissions = sqliteTable("enrollment_submissions", {
  id: text("id").primaryKey(),
  intakeId: text("intake_id"),
  userId: text("user_id").notNull(),
  country: text("country").notNull(),
  region: text("region").notNull(),
  formVersion: integer("form_version").notNull(),
  status: text("status").notNull(),
  answers: text("answers").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  submittedAt: text("submitted_at"),
}, table => [index("idx_enrollment_user_updated").on(table.userId, table.updatedAt), uniqueIndex("unique_enrollment_intake").on(table.intakeId)]);

export const enrollmentAttachments = sqliteTable("enrollment_attachments", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull(),
  userId: text("user_id").notNull(),
  fieldId: text("field_id").notNull(),
  objectKey: text("object_key").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  createdAt: text("created_at").notNull(),
}, table => [index("idx_attachment_submission").on(table.submissionId)]);
