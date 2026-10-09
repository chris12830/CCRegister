import { env } from "cloudflare:workers";
import { actor, database, isBusinessAdmin, isSuperAdmin, jsonError, publishedForm } from "@/lib/enrollment-server";
import { applies } from "@/lib/enrollment-form";

export const dynamic = "force-dynamic";
const allowed = new Set(["application/pdf", "image/jpeg", "image/png"]);
type Attachment = { id: string; submission_id: string; user_id: string; field_id: string; object_key: string; filename: string; content_type: string; size: number };

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return jsonError("Sign in to upload a document.", 401);
  if (!env.BUCKET) return jsonError("Document storage is unavailable.", 503);
  let form: FormData;
  try { form = await request.formData(); } catch { return jsonError("Could not read the document.", 400); }
  const file = form.get("file"), submissionId = form.get("submissionId"), fieldId = form.get("fieldId");
  if (!(file instanceof File) || typeof submissionId !== "string" || typeof fieldId !== "string" || !allowed.has(file.type) || file.size < 1 || file.size > 10_000_000 || file.name.length > 150) return jsonError("Use a PDF, JPG or PNG smaller than 10 MB.", 400);
  try {
    const db = database();
    const draft = await db.prepare("SELECT user_id, status, country, region, answers FROM enrollment_submissions WHERE id = ?").bind(submissionId).first<{ user_id: string; status: string; country: string; region: string; answers: string }>();
    if (!draft || draft.user_id !== user.userId || draft.status !== "draft") return jsonError("Save an editable draft before uploading.", 403);
    const published = await publishedForm(db);
    const field = published.definition.fields.find(f => f.id === fieldId && f.type === "document");
    if (!field || !applies(field, draft.country, draft.region, JSON.parse(draft.answers))) return jsonError("This document question is not available.", 400);
    const id = crypto.randomUUID(), objectKey = `enrollments/${submissionId}/${id}`;
    await env.BUCKET.put(objectKey, file.stream(), { httpMetadata: { contentType: file.type } });
    try {
      await db.prepare("INSERT INTO enrollment_attachments (id, submission_id, user_id, field_id, object_key, filename, content_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, submissionId, user.userId, fieldId, objectKey, file.name, file.type, file.size, new Date().toISOString()).run();
    } catch (error) { await env.BUCKET.delete(objectKey); throw error; }
    return Response.json({ id, filename: file.name }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not store enrollment attachment", error);
    return jsonError("Document upload failed. Your form answers are still here.", 503);
  }
}

export async function GET(request: Request) {
  const user = await actor();
  if (!user) return jsonError("Sign in to view the document.", 401);
  const query = new URL(request.url).searchParams;
  const submissionId = query.get("submissionId");
  if (submissionId) {
    try {
      const owner = await database().prepare("SELECT user_id, status FROM enrollment_submissions WHERE id = ?").bind(submissionId).first<{ user_id: string; status: string }>();
      if (!owner || (!isSuperAdmin(user) && owner.user_id !== user.userId && !(isBusinessAdmin(user) && owner.status === "submitted"))) return jsonError("Documents not found.", 404);
      const rows = await database().prepare("SELECT id, field_id, filename, size FROM enrollment_attachments WHERE submission_id = ?").bind(submissionId).all();
      return Response.json({ attachments: rows.results }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) { console.error("Could not list attachments", error); return jsonError("Documents unavailable.", 503); }
  }
  const id = query.get("id");
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return jsonError("Document not found.", 404);
  try {
    const db = database();
    const attachment = await db.prepare("SELECT a.*, s.status AS submission_status FROM enrollment_attachments a JOIN enrollment_submissions s ON s.id = a.submission_id WHERE a.id = ?").bind(id).first<Attachment & { submission_status: string }>();
    if (!attachment || (!isSuperAdmin(user) && attachment.user_id !== user.userId && !(isBusinessAdmin(user) && attachment.submission_status === "submitted"))) return jsonError("Document not found.", 404);
    const object = await env.BUCKET?.get(attachment.object_key);
    if (!object) return jsonError("Document unavailable.", 404);
    const safeName = attachment.filename.replace(/[\r\n"\\]/g, "_");
    return new Response(object.body, { headers: {
      "Content-Type": attachment.content_type,
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    console.error("Could not read enrollment attachment", error);
    return jsonError("The document is temporarily unavailable.", 503);
  }
}

export async function DELETE(request: Request) {
  const user = await actor();
  if (!user) return jsonError("Sign in to manage documents.", 401);
  let body: { id?: string };
  try { body = await request.json(); } catch { return jsonError("Invalid document request.", 400); }
  if (!body.id || !/^[0-9a-f-]{36}$/.test(body.id)) return jsonError("Document not found.", 404);
  try {
    const db = database();
    const file = await db.prepare("SELECT a.object_key, a.user_id, a.submission_id, s.status FROM enrollment_attachments a JOIN enrollment_submissions s ON s.id = a.submission_id WHERE a.id = ?")
      .bind(body.id).first<{ object_key: string; user_id: string; submission_id: string; status: string }>();
    if (!file || file.user_id !== user.userId || file.status !== "draft") return jsonError("This document cannot be removed.", 403);
    await env.BUCKET?.delete(file.object_key);
    await db.prepare("DELETE FROM enrollment_attachments WHERE id = ? AND user_id = ?").bind(body.id, user.userId).run();
    return Response.json({ removed: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not remove enrollment attachment", error);
    return jsonError("Document could not be removed. Please try again.", 503);
  }
}
