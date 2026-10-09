import { actor, BUSINESS_ID, database, isBusinessAdmin, jsonError } from "@/lib/enrollment-server";
import { ageGroups, type ProgramRoom } from "@/lib/registration-intake";

export const dynamic = "force-dynamic";
type RoomRow = { id: string; name: string; age_group: string; capacity: number; before_capacity: number; after_capacity: number };
export const roomOutput = (row: RoomRow): ProgramRoom => ({ id: row.id, name: row.name, ageGroup: row.age_group, capacity: row.capacity, beforeCapacity: row.before_capacity, afterCapacity: row.after_capacity });

export async function GET() {
  const user = await actor();
  if (!isBusinessAdmin(user)) return jsonError("Only the business administrator can manage classrooms.", 403);
  try {
    const result = await database().prepare("SELECT id, name, age_group, capacity, before_capacity, after_capacity FROM program_rooms WHERE business_id = ? ORDER BY age_group, name").bind(BUSINESS_ID).all<RoomRow>();
    return Response.json({ rooms: result.results.map(roomOutput) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { console.error("Could not list classrooms", error); return jsonError("Classrooms are temporarily unavailable.", 503); }
}

export async function POST(request: Request) {
  const user = await actor();
  if (!isBusinessAdmin(user)) return jsonError("Only the business administrator can manage classrooms.", 403);
  let body: { id?: unknown; name?: unknown; ageGroup?: unknown; capacity?: unknown; beforeCapacity?: unknown; afterCapacity?: unknown };
  try { body = await request.json(); } catch { return jsonError("Invalid classroom.", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.name !== "string" || !body.name.trim() || body.name.length > 100 || typeof body.ageGroup !== "string" || !ageGroups.includes(body.ageGroup as typeof ageGroups[number]) || !Number.isInteger(body.capacity) || (body.capacity as number) < 1 || (body.capacity as number) > 300 || !Number.isInteger(body.beforeCapacity) || (body.beforeCapacity as number) < 0 || (body.beforeCapacity as number) > (body.capacity as number) || !Number.isInteger(body.afterCapacity) || (body.afterCapacity as number) < 0 || (body.afterCapacity as number) > (body.capacity as number) || (body.id !== undefined && (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/.test(body.id))))
    return jsonError("Enter a classroom, age group and 1–300 day spaces. Before and after spaces cannot exceed day capacity.", 400);
  const name = body.name.trim(), ageGroup = body.ageGroup, capacity = body.capacity as number, beforeCapacity = body.beforeCapacity as number, afterCapacity = body.afterCapacity as number;
  try {
    const db = database(), now = new Date().toISOString();
    if (typeof body.id === "string") {
      const existing = await db.prepare("SELECT id, name, age_group FROM program_rooms WHERE id = ? AND business_id = ?").bind(body.id, BUSINESS_ID).first<RoomRow>();
      if (!existing) return jsonError("Classroom not found.", 404);
      const active = await db.prepare("SELECT COUNT(*) AS count FROM registration_intakes WHERE room_id = ? AND status != 'cancelled'").bind(body.id).first<{ count: number }>();
      if (active?.count && (name !== existing.name || ageGroup !== existing.age_group)) return jsonError("Classroom name and age group are locked while registrations use this room.", 409);
      const highest = await db.prepare("SELECT section, MAX(space_number) AS highest FROM space_section_reservations WHERE room_id = ? GROUP BY section").bind(body.id).all<{ section: string; highest: number }>();
      const caps: Record<string, number> = { am: capacity, pm: capacity, before: beforeCapacity, after: afterCapacity };
      if (highest.results.some(row => row.highest > caps[row.section])) return jsonError("This change would remove a reserved space section. Keep capacity above the highest assigned space.", 409);
      await db.prepare("UPDATE program_rooms SET name = ?, age_group = ?, capacity = ?, before_capacity = ?, after_capacity = ?, updated_at = ? WHERE id = ? AND business_id = ?")
        .bind(name, ageGroup, capacity, beforeCapacity, afterCapacity, now, body.id, BUSINESS_ID).run();
      return Response.json({ room: { id: body.id, name, ageGroup, capacity, beforeCapacity, afterCapacity } }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const id = crypto.randomUUID();
    await db.prepare("INSERT INTO program_rooms (id, business_id, name, age_group, capacity, before_capacity, after_capacity, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, BUSINESS_ID, name, ageGroup, capacity, beforeCapacity, afterCapacity, now, now).run();
    return Response.json({ room: { id, name, ageGroup, capacity, beforeCapacity, afterCapacity } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (String(error).includes("UNIQUE")) return jsonError("A classroom with this name already exists.", 409);
    console.error("Could not save classroom", error); return jsonError("Classroom could not be saved.", 503);
  }
}
