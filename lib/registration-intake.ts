import type { Answers, Person } from "@/lib/enrollment-form";

export const ageGroups = ["Infant", "Toddler", "Preschool", "Kindergarten", "School age", "Other"] as const;
export const careTypes = ["Licensed child care centre", "Licensed home or family child care", "School age program", "Head Start or Early Head Start", "Other"] as const;
export const carePeriods = ["none", "day", "morning", "afternoon"] as const;
export const scheduleModes = ["days", "mornings", "afternoons", "custom"] as const;
export type SpaceSection = "am" | "pm" | "before" | "after";
export type CarePeriod = typeof carePeriods[number];
export type ScheduleMode = typeof scheduleModes[number];
export type ScheduleSlot = { date: string; care: CarePeriod; before: boolean; after: boolean };
export type CareHours = Record<"day" | "morning" | "afternoon" | "before" | "after", { start: string; end: string }>;
export const defaultCareHours = (): CareHours => ({ day: { start: "08:00", end: "17:00" }, morning: { start: "08:00", end: "12:00" }, afternoon: { start: "12:00", end: "17:00" }, before: { start: "07:00", end: "09:00" }, after: { start: "15:00", end: "18:00" } });
export type ProgramRoom = { id: string; name: string; ageGroup: string; capacity: number; beforeCapacity: number; afterCapacity: number };
export type RegistrationIntake = {
  id: string; status: "ready" | "in_progress" | "submitted" | "cancelled";
  guardianName: string; guardianEmail: string; guardianPhone: string;
  childFirst: string; childLast: string; childDob: string;
  careType: string; ageGroup: string; roomId: string; roomName: string;
  startDate: string; weekStart: string; mode: ScheduleMode; slots: ScheduleSlot[]; hours: CareHours;
  country: string; region: string; createdAt: string; updatedAt: string;
};
export type AvailabilityDay = { date: string; am: number; pm: number; before: number; after: number };
export type ReservedSection = { date: string; section: SpaceSection; spaceNumber: number };

export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function addDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function firstMonday(date: string): string {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDate(date, -((day + 6) % 7));
}
export function sectionsFor(slot: ScheduleSlot): SpaceSection[] {
  return [...(slot.care === "day" ? ["am", "pm"] as const : slot.care === "morning" ? ["am"] as const : slot.care === "afternoon" ? ["pm"] as const : []), ...(slot.before ? ["before"] as const : []), ...(slot.after ? ["after"] as const : [])];
}
export function allocateSpaceSections(room: ProgramRoom, slots: ScheduleSlot[], occupiedSections: ReservedSection[]): { reservations: ReservedSection[]; unavailableDate?: never } | { reservations?: never; unavailableDate: string } {
  const occupied = new Set(occupiedSections.map(item => `${item.date}|${item.section}|${item.spaceNumber}`));
  const limits: Record<SpaceSection, number> = { am: room.capacity, pm: room.capacity, before: room.beforeCapacity, after: room.afterCapacity };
  const reservations: ReservedSection[] = [];
  for (const slot of slots) {
    const sections = sectionsFor(slot);
    if (!sections.length) continue;
    const number = Array.from({ length: Math.min(...sections.map(section => limits[section])) }, (_, index) => index + 1)
      .find(candidate => sections.every(section => !occupied.has(`${slot.date}|${section}|${candidate}`)));
    if (!number) return { unavailableDate: slot.date };
    for (const section of sections) reservations.push({ date: slot.date, section, spaceNumber: number });
  }
  return { reservations };
}
export function scheduleSummary(intake: RegistrationIntake): string {
  const labels: Record<CarePeriod, string> = { none: "", day: "Day", morning: "Morning", afternoon: "Afternoon" };
  const used = new Set(intake.slots.flatMap(slot => [slot.care !== "none" ? slot.care : "", slot.before ? "before" : "", slot.after ? "after" : ""].filter(Boolean)));
  const hours = (["day", "morning", "afternoon", "before", "after"] as const).filter(section => used.has(section))
    .map(section => `${section === "before" ? "Before School" : section === "after" ? "After School" : `${section[0].toUpperCase()}${section.slice(1)}`}: ${intake.hours[section].start}–${intake.hours[section].end}`).join(", ");
  return `${intake.mode === "custom" ? "Custom four week schedule" : `${intake.mode[0].toUpperCase()}${intake.mode.slice(1)} four week schedule`} · Hours: ${hours} · ${intake.slots.map(slot => `${slot.date}: ${[labels[slot.care], slot.before ? "Before School" : "", slot.after ? "After School" : ""].filter(Boolean).join(" + ")}`).join("; ")}`;
}
export function intakeAnswers(intake: RegistrationIntake, existing: Answers = {}): Answers {
  const people = Array.isArray(existing.guardians) ? existing.guardians.slice(1) as Person[] : [];
  return {
    ...existing,
    child_first: intake.childFirst, child_last: intake.childLast, child_dob: intake.childDob,
    start_date: intake.startDate, program: intake.ageGroup, care_setting: intake.careType,
    classroom: intake.roomName, schedule: scheduleSummary(intake),
    guardians: [{ name: intake.guardianName, relationship: "Prime guardian", phone: intake.guardianPhone, email: intake.guardianEmail, address: "" }, ...people],
  };
}
export const adminFields = new Set(["child_first", "child_last", "child_dob", "start_date", "program", "care_setting", "classroom", "schedule"]);
