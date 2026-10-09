import { actor, BUSINESS_ID, businessLocation, database, isBusinessAdmin, isSuperAdmin, jsonError, publishedForm } from "@/lib/enrollment-server";
import { applies, type Answers, validateAnswers } from "@/lib/enrollment-form";
import { intakeAnswers } from "@/lib/registration-intake";
import { findIntake } from "@/lib/registration-intake-server";

export const dynamic = "force-dynamic";
type Submission = { id: string; intake_id: string | null; user_id: string; country: string; region: string; form_version: number; status: string; answers: string; created_at: string; updated_at: string; submitted_at: string | null };

export async function GET(request: Request) {
  const user = await actor();
  if (!user) return jsonError("Sign in to view enrollment records.", 401);
  try {
    const scope = new URL(request.url).searchParams.get("scope");
    if (scope === "business" && !isBusinessAdmin(user)) return jsonError("Only the business administrator can view submitted registrations.", 403);
    if (scope === "all" && !isSuperAdmin(user)) return jsonError("Only the Super Admin can view all registration records.", 403);
    const db = database();
    const query = scope === "all"
      ? db.prepare("SELECT * FROM enrollment_submissions ORDER BY updated_at DESC LIMIT 100")
      : scope === "business"
        ? db.prepare("SELECT * FROM enrollment_submissions WHERE status = 'submitted' ORDER BY submitted_at DESC LIMIT 100")
        : db.prepare("SELECT * FROM enrollment_submissions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100").bind(user.userId);
    const result = await query.all<Submission>();
    const versions = await db.prepare("SELECT version, definition FROM enrollment_form_versions").all<{ version: number; definition: string }>();
    const labels = new Map(versions.results.map(v => [v.version, Object.fromEntries((JSON.parse(v.definition) as { fields: { id: string; label: string }[] }).fields.map(f => [f.id, f.label]))]));
    return Response.json({ records: result.results.map(r => ({ ...r, answers: JSON.parse(r.answers), labels: labels.get(r.form_version) || {} })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not read enrollments", error);
    return jsonError("Enrollment records are temporarily unavailable.", 503);
  }
}

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return jsonError("Sign in to save this enrollment.", 401);
  let body: { id?: string; intakeId?: string; country?: string; region?: string; formVersion?: number; status?: string; answers?: Answers };
  try { body = await request.json(); } catch { return jsonError("Invalid enrollment.", 400); }
  if (!body || (body.status !== "draft" && body.status !== "submitted") || typeof body.country !== "string" || typeof body.region !== "string" || !Number.isSafeInteger(body.formVersion) || !body.answers || typeof body.answers !== "object" || Array.isArray(body.answers) || (body.intakeId && !/^[0-9a-f-]{36}$/.test(body.intakeId))) return jsonError("Review the enrollment details.", 400);
  try {
    const db = database();
    const location = await businessLocation(db);
    if (body.country !== location.country || body.region !== location.region)
      return jsonError("The provider location changed. Reload the form and review the local questions before saving.", 409);
    const form = await publishedForm(db);
    if (body.formVersion !== form.version) return jsonError("The form was updated. Reload and review the latest questions before saving.", 409);
    if (!body.intakeId && !body.id) return jsonError("Your provider must complete the first registration page before you can start.", 403);
    const intake = body.intakeId ? await findIntake(body.intakeId) : null;
    if (body.intakeId && (!intake || intake.guardianEmail.toLowerCase() !== user.email.toLowerCase() || intake.status === "cancelled")) return jsonError("This registration is not assigned to your account.", 403);
    if (intake?.status === "submitted") return jsonError("This registration has already been submitted.", 409);
    if (intake && (intake.country !== location.country || intake.region !== location.region)) return jsonError("The provider location changed. Ask the administrator to prepare a new registration.", 409);
    const supplied = intake ? intakeAnswers(intake, body.answers as Answers) : body.answers as Answers;
    const validation = validateAnswers(form.definition, body.country, body.region, supplied, body.status === "submitted");
    if (validation) return jsonError(validation, 400);
    for (const field of form.definition.fields) {
      if (field.type !== "document" || !applies(field, body.country, body.region, supplied)) continue;
      const value = supplied?.[field.id];
      if (!value) continue;
      const attachment = typeof value === "string" && body.id
        ? await db.prepare("SELECT id FROM enrollment_attachments WHERE id = ? AND submission_id = ? AND user_id = ? AND field_id = ?").bind(value, body.id, user.userId, field.id).first()
        : null;
      if (!attachment) return jsonError(`Upload or remove ${field.label} before saving.`, 400);
    }
    const answers: Answers = {};
    for (const field of form.definition.fields) if (applies(field, body.country, body.region, supplied) && supplied?.[field.id] !== undefined) answers[field.id] = supplied[field.id];
    const now = new Date().toISOString();
    const id = body.id || crypto.randomUUID();
    let change: D1PreparedStatement;
    if (body.id) {
      const old = await db.prepare("SELECT user_id, status, intake_id FROM enrollment_submissions WHERE id = ?").bind(id).first<{ user_id: string; status: string; intake_id: string | null }>();
      if (!old || old.user_id !== user.userId || old.status !== "draft" || old.intake_id !== (intake?.id || null)) return jsonError("This draft cannot be changed.", 403);
      const base = "UPDATE enrollment_submissions SET country = ?, region = ?, form_version = ?, status = ?, answers = ?, updated_at = ?, submitted_at = ? WHERE id = ? AND user_id = ? AND status = 'draft' AND EXISTS (SELECT 1 FROM business_settings WHERE business_id = ? AND country = ? AND region = ?)";
      change = intake
        ? db.prepare(`${base} AND EXISTS (SELECT 1 FROM registration_intakes WHERE id = ? AND status IN ('ready', 'in_progress'))`).bind(body.country, body.region, form.version, body.status, JSON.stringify(answers), now, body.status === "submitted" ? now : null, id, user.userId, BUSINESS_ID, body.country, body.region, intake.id)
        : db.prepare(base).bind(body.country, body.region, form.version, body.status, JSON.stringify(answers), now, body.status === "submitted" ? now : null, id, user.userId, BUSINESS_ID, body.country, body.region);
    } else {
      if (!intake) return jsonError("The provider must prepare the first registration page.", 403);
      change = db.prepare("INSERT INTO enrollment_submissions (id, intake_id, user_id, country, region, form_version, status, answers, created_at, updated_at, submitted_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM business_settings WHERE business_id = ? AND country = ? AND region = ?) AND EXISTS (SELECT 1 FROM registration_intakes WHERE id = ? AND status = 'ready')")
        .bind(id, intake.id, user.userId, body.country, body.region, form.version, body.status, JSON.stringify(answers), now, now, body.status === "submitted" ? now : null, BUSINESS_ID, body.country, body.region, intake.id);
    }
    if (intake) {
      const [saved, marked] = await db.batch([
        change,
        db.prepare("UPDATE registration_intakes SET status = ?, updated_at = ? WHERE id = ? AND business_id = ? AND status IN ('ready', 'in_progress') AND EXISTS (SELECT 1 FROM enrollment_submissions WHERE id = ? AND user_id = ? AND updated_at = ?)")
          .bind(body.status === "submitted" ? "submitted" : "in_progress", now, intake.id, BUSINESS_ID, id, user.userId, now),
      ]);
      if (saved.meta.changes !== 1 || marked.meta.changes !== 1) return jsonError("This registration or provider location changed. Reload and review the form.", 409);
    } else {
      const saved = await change.run();
      if (saved.meta.changes !== 1) return jsonError("The provider location or draft changed. Reload and review the form before saving.", 409);
    }
    return Response.json({ id, status: body.status, savedAt: now }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not save enrollment", error);
    return jsonError("The enrollment could not be saved. Your answers are still on this page.", 503);
  }
}
