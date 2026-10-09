import { actor, BUSINESS_ID, database, isBusinessAdmin, jsonError } from "@/lib/enrollment-server";

export const dynamic = "force-dynamic";
const categories = new Set(["Child care", "Transition", "Staff", "Reminder"]);
const dateValue = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const timeValue = (value: unknown): value is string => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
type ScheduleInput = { id?: unknown; date?: unknown; startTime?: unknown; endTime?: unknown; category?: unknown; title?: unknown; program?: unknown; childName?: unknown; notes?: unknown };
type Row = { id: string; date: string; start_time: string; end_time: string; category: string; title: string; program: string; child_name: string; notes: string; created_at: string; updated_at: string };
type BookingRow = { date: string; intake_id: string; child_first: string; child_last: string; room_name: string; sections: string };
const output = (row: Row) => ({ id: row.id, date: row.date, startTime: row.start_time, endTime: row.end_time, category: row.category, title: row.title, program: row.program, childName: row.child_name, notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at });

export async function GET(request: Request) {
  const user = await actor();
  if (!isBusinessAdmin(user)) return jsonError("Only the business administrator can view scheduling.", 403);
  const params = new URL(request.url).searchParams;
  const from = params.get("from"), to = params.get("to");
  if (!dateValue(from) || !dateValue(to) || from > to || Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`) > 35 * 86400000)
    return jsonError("Choose a date range of up to 35 days.", 400);
  try {
    const db = database();
    const result = await db.prepare("SELECT id, date, start_time, end_time, category, title, program, child_name, notes, created_at, updated_at FROM schedule_items WHERE business_id = ? AND date BETWEEN ? AND ? ORDER BY date, start_time, title")
      .bind(BUSINESS_ID, from, to).all<Row>();
    const reservations = await db.prepare("SELECT s.date, i.id AS intake_id, i.child_first, i.child_last, r.name AS room_name, GROUP_CONCAT(s.section) AS sections FROM space_section_reservations s JOIN registration_intakes i ON i.id = s.intake_id JOIN program_rooms r ON r.id = s.room_id WHERE s.business_id = ? AND s.date BETWEEN ? AND ? AND i.status != 'cancelled' GROUP BY s.date, i.id ORDER BY s.date, r.name, i.child_last")
      .bind(BUSINESS_ID, from, to).all<BookingRow>();
    return Response.json({ items: result.results.map(output), bookings: reservations.results.map(row => ({ date: row.date, intakeId: row.intake_id, childName: `${row.child_first} ${row.child_last}`, roomName: row.room_name, sections: row.sections.split(",") })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Could not read scheduling", error);
    return jsonError("Scheduling is temporarily unavailable.", 503);
  }
}

export async function POST(request: Request) {
  const user = await actor();
  if (!isBusinessAdmin(user)) return jsonError("Only the business administrator can change scheduling.", 403);
  let body: ScheduleInput;
  try { body = await request.json(); } catch { return jsonError("Invalid schedule entry.", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return jsonError("Invalid schedule entry.", 400);
  if (!dateValue(body.date) || !timeValue(body.startTime) || !timeValue(body.endTime) || body.startTime >= body.endTime || !categories.has(String(body.category)) || typeof body.title !== "string" || !body.title.trim() || body.title.length > 120 || typeof body.program !== "string" || body.program.length > 100 || typeof body.childName !== "string" || body.childName.length > 120 || typeof body.notes !== "string" || body.notes.length > 500 || (body.id !== undefined && (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/.test(body.id))))
    return jsonError("Enter a date, valid start and end times, and a title. Keep notes under 500 characters.", 400);
  try {
    const db = database();
    const now = new Date().toISOString(), id = typeof body.id === "string" ? body.id : crypto.randomUUID();
    if (body.id) {
      const updated = await db.prepare("UPDATE schedule_items SET date = ?, start_time = ?, end_time = ?, category = ?, title = ?, program = ?, child_name = ?, notes = ?, updated_at = ?, updated_by = ? WHERE id = ? AND business_id = ?")
        .bind(body.date, body.startTime, body.endTime, body.category, body.title.trim(), body.program.trim(), body.childName.trim(), body.notes.trim(), now, user!.userId, id, BUSINESS_ID).run();
      if (updated.meta.changes !== 1) return jsonError("Schedule entry not found.", 404);
    } else {
      await db.prepare("INSERT INTO schedule_items (id, business_id, date, start_time, end_time, category, title, program, child_name, notes, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, BUSINESS_ID, body.date, body.startTime, body.endTime, body.category, body.title.trim(), body.program.trim(), body.childName.trim(), body.notes.trim(), now, now, user!.userId).run();
    }
    return Response.json({ item: { id, date: body.date, startTime: body.startTime, endTime: body.endTime, category: body.category, title: body.title.trim(), program: body.program.trim(), childName: body.childName.trim(), notes: body.notes.trim(), updatedAt: now } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Could not save scheduling", error);
    return jsonError("Schedule entry could not be saved.", 503);
  }
}

export async function DELETE(request: Request) {
  const user = await actor();
  if (!isBusinessAdmin(user)) return jsonError("Only the business administrator can change scheduling.", 403);
  let body: { id?: unknown };
  try { body = await request.json(); } catch { return jsonError("Invalid schedule entry.", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return jsonError("Invalid schedule entry.", 400);
  if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/.test(body.id)) return jsonError("Schedule entry not found.", 404);
  try {
    const deleted = await database().prepare("DELETE FROM schedule_items WHERE id = ? AND business_id = ?").bind(body.id, BUSINESS_ID).run();
    if (deleted.meta.changes !== 1) return jsonError("Schedule entry not found.", 404);
    return Response.json({ deleted: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Could not delete schedule entry", error);
    return jsonError("Schedule entry could not be deleted.", 503);
  }
}
