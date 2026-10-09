import { BUSINESS_ID, database } from "@/lib/enrollment-server";
import { type CareHours, type RegistrationIntake, type ScheduleSlot } from "@/lib/registration-intake";

export type IntakeRow = {
  id: string; business_id: string; status: RegistrationIntake["status"];
  guardian_name: string; guardian_email: string; guardian_phone: string;
  child_first: string; child_last: string; child_dob: string;
  care_type: string; age_group: string; room_id: string; room_name: string;
  start_date: string; week_start: string; mode: RegistrationIntake["mode"]; slots: string; hours: string;
  country: string; region: string; created_at: string; updated_at: string;
};
export function intakeOutput(row: IntakeRow): RegistrationIntake {
  return {
    id: row.id, status: row.status,
    guardianName: row.guardian_name, guardianEmail: row.guardian_email, guardianPhone: row.guardian_phone,
    childFirst: row.child_first, childLast: row.child_last, childDob: row.child_dob,
    careType: row.care_type, ageGroup: row.age_group, roomId: row.room_id, roomName: row.room_name,
    startDate: row.start_date, weekStart: row.week_start, mode: row.mode, slots: JSON.parse(row.slots) as ScheduleSlot[], hours: JSON.parse(row.hours) as CareHours,
    country: row.country, region: row.region, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
export async function findIntake(id: string): Promise<RegistrationIntake | null> {
  const row = await database().prepare("SELECT i.*, r.name AS room_name FROM registration_intakes i JOIN program_rooms r ON r.id = i.room_id WHERE i.id = ? AND i.business_id = ?")
    .bind(id, BUSINESS_ID).first<IntakeRow>();
  return row ? intakeOutput(row) : null;
}
