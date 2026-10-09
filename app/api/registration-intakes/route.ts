import { actor, BUSINESS_ID, businessLocation, database, isBusinessAdmin, jsonError, publishedForm } from "@/lib/enrollment-server";
import { addDate, adminFields, ageGroups, allocateSpaceSections, carePeriods, careTypes, firstMonday, scheduleModes, sectionsFor, type AvailabilityDay, type CareHours, type ProgramRoom, type ScheduleSlot, type SpaceSection, validDate } from "@/lib/registration-intake";
import { findIntake, intakeOutput, type IntakeRow } from "@/lib/registration-intake-server";

export const dynamic = "force-dynamic";
type RoomRow = { id: string; name: string; age_group: string; capacity: number; before_capacity: number; after_capacity: number };
type Reservation = { date: string; section: SpaceSection; space_number: number; intake_id: string };
type Input = { guardianName?: unknown; guardianEmail?: unknown; guardianPhone?: unknown; childFirst?: unknown; childLast?: unknown; childDob?: unknown; careType?: unknown; ageGroup?: unknown; roomId?: unknown; startDate?: unknown; weekStart?: unknown; mode?: unknown; slots?: unknown; hours?: unknown };
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/.test(value);
const roomOutput = (row: RoomRow): ProgramRoom => ({ id: row.id, name: row.name, ageGroup: row.age_group, capacity: row.capacity, beforeCapacity: row.before_capacity, afterCapacity: row.after_capacity });

function availability(room: ProgramRoom, start: string, reservations: Reservation[]): (AvailabilityDay & { day: number })[] {
  const occupied = new Set(reservations.map(row => `${row.date}|${row.section}|${row.space_number}`));
  return Array.from({ length: 28 }, (_, index) => {
    const date = addDate(start, index);
    const free = (section: SpaceSection, cap: number) => Array.from({ length: cap }, (_, number) => number + 1).filter(number => !occupied.has(`${date}|${section}|${number}`)).length;
    return { date, am: free("am", room.capacity), pm: free("pm", room.capacity), before: free("before", room.beforeCapacity), after: free("after", room.afterCapacity), day: Array.from({ length: room.capacity }, (_, number) => number + 1).filter(number => !occupied.has(`${date}|am|${number}`) && !occupied.has(`${date}|pm|${number}`)).length };
  });
}

export async function GET(request: Request) {
  const user = await actor();
  if (!user) return jsonError("Sign in to view registrations.", 401);
  const params = new URL(request.url).searchParams;
  const admin = params.get("scope") === "business";
  if (admin && !isBusinessAdmin(user)) return jsonError("Only the business administrator can view intake records.", 403);
  try {
    const db = database();
    const result = admin
      ? await db.prepare("SELECT i.*, r.name AS room_name FROM registration_intakes i JOIN program_rooms r ON r.id = i.room_id WHERE i.business_id = ? ORDER BY i.created_at DESC LIMIT 100").bind(BUSINESS_ID).all<IntakeRow>()
      : await db.prepare("SELECT i.*, r.name AS room_name FROM registration_intakes i JOIN program_rooms r ON r.id = i.room_id WHERE i.business_id = ? AND LOWER(i.guardian_email) = ? AND i.status != 'cancelled' ORDER BY i.created_at DESC LIMIT 100").bind(BUSINESS_ID, user.email.toLowerCase()).all<IntakeRow>();
    const intakes = result.results.map(intakeOutput);
    if (!admin) return Response.json({ intakes }, { headers: { "Cache-Control": "private, no-store" } });
    const roomId = params.get("roomId"), weekStart = params.get("weekStart");
    if (!roomId || !weekStart) return Response.json({ intakes }, { headers: { "Cache-Control": "private, no-store" } });
    if (!uuid(roomId) || !validDate(weekStart) || firstMonday(weekStart) !== weekStart) return jsonError("Choose a valid classroom and starting Monday.", 400);
    const room = await db.prepare("SELECT id, name, age_group, capacity, before_capacity, after_capacity FROM program_rooms WHERE id = ? AND business_id = ?").bind(roomId, BUSINESS_ID).first<RoomRow>();
    if (!room) return jsonError("Classroom not found.", 404);
    const rows = await db.prepare("SELECT date, section, space_number, intake_id FROM space_section_reservations WHERE room_id = ? AND date BETWEEN ? AND ?").bind(roomId, weekStart, addDate(weekStart, 27)).all<Reservation>();
    return Response.json({ intakes, availability: availability(roomOutput(room), weekStart, rows.results) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { console.error("Could not list intake records", error); return jsonError("Registrations are temporarily unavailable.", 503); }
}

export async function POST(request: Request) {
  const user = await actor();
  if (!isBusinessAdmin(user)) return jsonError("Only the business administrator can start a registration.", 403);
  let body: Input;
  try { body = await request.json(); } catch { return jsonError("Invalid registration intake.", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return jsonError("Invalid registration intake.", 400);
  const shortName = (value: unknown, limit = 120): value is string => typeof value === "string" && !!value.trim() && value.length <= limit;
  if (!shortName(body.guardianName) || !shortName(body.guardianPhone, 40) || !shortName(body.childFirst) || !shortName(body.childLast) || !validDate(body.childDob) || !validDate(body.startDate) || body.childDob > body.startDate || typeof body.guardianEmail !== "string" || body.guardianEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.guardianEmail) || !careTypes.includes(body.careType as typeof careTypes[number]) || !ageGroups.includes(body.ageGroup as typeof ageGroups[number]) || !uuid(body.roomId) || !validDate(body.weekStart) || firstMonday(body.startDate) !== body.weekStart || !scheduleModes.includes(body.mode as typeof scheduleModes[number]) || !Array.isArray(body.slots) || body.slots.length < 1 || body.slots.length > 28)
    return jsonError("Complete the guardian, child, classroom and four week schedule details.", 400);
  const slots = body.slots as ScheduleSlot[], seen = new Set<string>(), last = addDate(body.weekStart, 27);
  for (const slot of slots) {
    if (!slot || !validDate(slot.date) || slot.date < body.startDate || slot.date > last || seen.has(slot.date) || !carePeriods.includes(slot.care) || typeof slot.before !== "boolean" || typeof slot.after !== "boolean" || sectionsFor(slot).length === 0 || (body.mode === "days" && !["day", "none"].includes(slot.care)) || (body.mode === "mornings" && !["morning", "none"].includes(slot.care)) || (body.mode === "afternoons" && !["afternoon", "none"].includes(slot.care))) return jsonError("Select valid dates and care sections in the four week window.", 400);
    seen.add(slot.date);
  }
  const hours = body.hours as CareHours;
  const validTime = (value: unknown) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!hours || typeof hours !== "object" || (["day", "morning", "afternoon", "before", "after"] as const).some(section => !hours[section] || !validTime(hours[section].start) || !validTime(hours[section].end) || hours[section].start >= hours[section].end))
    return jsonError("Enter valid start and end hours for each care section.", 400);
  const cleanSlots = slots.map(slot => ({ date: slot.date, care: slot.care, before: slot.before, after: slot.after }));
  const cleanHours = Object.fromEntries((["day", "morning", "afternoon", "before", "after"] as const).map(section => [section, { start: hours[section].start, end: hours[section].end }])) as CareHours;
  try {
    const db = database();
    const published = await publishedForm(db);
    const byId = new Map(published.definition.fields.map(field => [field.id, field]));
    if ([...adminFields].some(id => !byId.has(id)) || !byId.has("guardians") || !byId.get("program")?.options?.includes(body.ageGroup as string) || !byId.get("care_setting")?.options?.includes(body.careType as string))
      return jsonError("The published form no longer supports this placement. Ask the Super Admin to review its program questions.", 409);
    const roomRow = await db.prepare("SELECT id, name, age_group, capacity, before_capacity, after_capacity FROM program_rooms WHERE id = ? AND business_id = ?").bind(body.roomId, BUSINESS_ID).first<RoomRow>();
    if (!roomRow || roomRow.age_group !== body.ageGroup) return jsonError("Choose a classroom in the selected age group.", 400);
    const room = roomOutput(roomRow);
    if (cleanSlots.some(slot => (slot.before && !room.beforeCapacity) || (slot.after && !room.afterCapacity))) return jsonError("Before or after school is not offered in this classroom.", 400);
    const rows = await db.prepare("SELECT date, section, space_number, intake_id FROM space_section_reservations WHERE room_id = ? AND date BETWEEN ? AND ?").bind(room.id, body.weekStart, last).all<Reservation>();
    const allocation = allocateSpaceSections(room, cleanSlots, rows.results.map(row => ({ date: row.date, section: row.section, spaceNumber: row.space_number })));
    if (!allocation.reservations) return jsonError(`No single space has all selected sections open on ${allocation.unavailableDate}. Change the care combination or date.`, 409);
    const location = await businessLocation(db), id = crypto.randomUUID(), now = new Date().toISOString();
    const statements = [
      db.prepare("INSERT INTO registration_intakes (id, business_id, status, guardian_name, guardian_email, guardian_phone, child_first, child_last, child_dob, care_type, age_group, room_id, start_date, week_start, mode, slots, hours, country, region, created_at, updated_at, updated_by) VALUES (?, ?, 'ready', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, BUSINESS_ID, body.guardianName.trim(), body.guardianEmail.trim().toLowerCase(), body.guardianPhone.trim(), body.childFirst.trim(), body.childLast.trim(), body.childDob, body.careType, body.ageGroup, room.id, body.startDate, body.weekStart, body.mode, JSON.stringify(cleanSlots.sort((a, b) => a.date.localeCompare(b.date))), JSON.stringify(cleanHours), location.country, location.region, now, now, user!.userId),
      ...allocation.reservations.map(item => db.prepare("INSERT INTO space_section_reservations (id, business_id, room_id, intake_id, date, section, space_number) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), BUSINESS_ID, room.id, id, item.date, item.section, item.spaceNumber)),
    ];
    await db.batch(statements);
    const intake = await findIntake(id);
    return Response.json({ intake }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (String(error).includes("UNIQUE")) return jsonError("A selected space was just reserved. Refresh availability and try again.", 409);
    console.error("Could not save registration intake", error); return jsonError("Registration intake could not be saved.", 503);
  }
}

export async function DELETE(request: Request) {
  const user = await actor();
  if (!isBusinessAdmin(user)) return jsonError("Only the business administrator can cancel an intake.", 403);
  let body: { id?: unknown };
  try { body = await request.json(); } catch { return jsonError("Invalid registration intake.", 400); }
  if (!body || !uuid(body.id)) return jsonError("Intake not found.", 404);
  try {
    const db = database(), now = new Date().toISOString();
    const [changed] = await db.batch([
      db.prepare("UPDATE registration_intakes SET status = 'cancelled', updated_at = ?, updated_by = ? WHERE id = ? AND business_id = ? AND status = 'ready'").bind(now, user!.userId, body.id, BUSINESS_ID),
      db.prepare("DELETE FROM space_section_reservations WHERE intake_id = ? AND business_id = ? AND EXISTS (SELECT 1 FROM registration_intakes WHERE id = ? AND status = 'cancelled')").bind(body.id, BUSINESS_ID, body.id),
    ]);
    if (changed.meta.changes !== 1) return jsonError("Only an intake that the guardian has not started can be cancelled.", 409);
    return Response.json({ cancelled: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { console.error("Could not cancel intake", error); return jsonError("Intake could not be cancelled.", 503); }
}
