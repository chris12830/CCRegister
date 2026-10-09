import { actor, database, isSuperAdmin, jsonError, publishedForm } from "@/lib/enrollment-server";
import { validateDefinition } from "@/lib/enrollment-form";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await actor();
  try {
    const form = await publishedForm(database());
    return Response.json({ ...form, canEdit: isSuperAdmin(user) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not read published enrollment form", error);
    return jsonError("The form is temporarily unavailable. Please try again.", 503);
  }
}

export async function POST(request: Request) {
  const user = await actor();
  if (!isSuperAdmin(user)) return jsonError("Only the Super Admin can edit and publish this form.", 403);
  let body: { expectedVersion?: number; definition?: unknown };
  try { body = await request.json(); } catch { return jsonError("Invalid form update.", 400); }
  const definition = validateDefinition(body.definition);
  if (!definition || !Number.isSafeInteger(body.expectedVersion)) return jsonError("Review the questions and try again.", 400);
  try {
    const db = database();
    const current = await publishedForm(db);
    if (body.expectedVersion !== current.version) return jsonError("Another version was published. Reload before making changes.", 409);
    const version = current.version + 1;
    await db.prepare("INSERT INTO enrollment_form_versions (version, definition, published_at, published_by) VALUES (?, ?, ?, ?)")
      .bind(version, JSON.stringify(definition), new Date().toISOString(), user!.userId).run();
    return Response.json({ version, message: "Published for all locations." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (String(error).includes("UNIQUE constraint")) return jsonError("Another version was published. Reload before making changes.", 409);
    console.error("Could not publish enrollment form", error);
    return jsonError("Changes could not be published. Your edits are still on this page.", 503);
  }
}
