import { actor, BUSINESS_ID, businessLocation, database, isBusinessAdmin, jsonError } from "@/lib/enrollment-server";
import { regions } from "@/lib/enrollment-form";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  const user = await actor();
  try {
    const location = await businessLocation(database());
    return Response.json({ country: location.country, region: location.region, revision: location.revision, canManage: isBusinessAdmin(user) }, { headers: noStore });
  } catch (error) {
    console.error("Could not read provider location", error);
    return jsonError("The provider location is temporarily unavailable.", 503);
  }
}

export async function POST(request: Request) {
  const user = await actor();
  if (!isBusinessAdmin(user)) return jsonError("Only the child care business administrator can set the provider location.", 403);
  let body: { country?: unknown; region?: unknown; expectedRevision?: unknown };
  try { body = await request.json(); } catch { return jsonError("Invalid location update.", 400); }
  if (typeof body.country !== "string" || typeof body.region !== "string" || !regions[body.country]?.includes(body.region) || !Number.isSafeInteger(body.expectedRevision))
    return jsonError("Choose a Canadian province or territory, or a U.S. state or territory.", 400);
  try {
    const db = database();
    await businessLocation(db);
    const now = new Date().toISOString();
    const result = await db.prepare("UPDATE business_settings SET country = ?, region = ?, revision = revision + 1, updated_at = ?, updated_by = ? WHERE business_id = ? AND revision = ?")
      .bind(body.country, body.region, now, user!.userId, BUSINESS_ID, body.expectedRevision).run();
    if (result.meta.changes !== 1) return jsonError("The provider location changed. Reload and review it before saving.", 409);
    return Response.json({ country: body.country, region: body.region, revision: Number(body.expectedRevision) + 1, updatedAt: now }, { headers: noStore });
  } catch (error) {
    console.error("Could not update provider location", error);
    return jsonError("The provider location could not be saved. Please try again.", 503);
  }
}
