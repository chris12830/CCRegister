import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { defaultDefinition, type FormDefinition } from "@/lib/enrollment-form";

export function database(): D1Database {
  if (!env.DB) throw new Error("Enrollment database unavailable");
  return env.DB;
}
export async function actor() {
  return getChatGPTUser();
}
export function isSuperAdmin(user: { email: string } | null): boolean {
  return !!user && !!env.SUPER_ADMIN_EMAIL && user.email.toLowerCase() === env.SUPER_ADMIN_EMAIL.toLowerCase();
}
export function isBusinessAdmin(user: { email: string } | null): boolean {
  return !!user && !!env.BUSINESS_ADMIN_EMAIL && user.email.toLowerCase() === env.BUSINESS_ADMIN_EMAIL.toLowerCase();
}
// This demo has one provider. The ID keeps the setting tied to that provider
// and leaves room for tenant membership when additional providers are enabled.
export const BUSINESS_ID = "little_sprouts_early_learning";
export type BusinessLocation = { country: string; region: string; revision: number; updated_at: string; updated_by: string };
export async function businessLocation(db: D1Database): Promise<BusinessLocation> {
  let row = await db.prepare("SELECT country, region, revision, updated_at, updated_by FROM business_settings WHERE business_id = ?")
    .bind(BUSINESS_ID).first<BusinessLocation>();
  if (!row) {
    await db.prepare("INSERT OR IGNORE INTO business_settings (business_id, country, region, revision, updated_at, updated_by) VALUES (?, 'Canada', 'Ontario', 1, ?, 'system')")
      .bind(BUSINESS_ID, new Date().toISOString()).run();
    row = await db.prepare("SELECT country, region, revision, updated_at, updated_by FROM business_settings WHERE business_id = ?")
      .bind(BUSINESS_ID).first<BusinessLocation>();
  }
  if (!row) throw new Error("Provider location unavailable");
  return row;
}
export type VersionRow = { version: number; definition: string; published_at: string; published_by: string };
export async function publishedForm(db: D1Database) {
  let row = await db.prepare("SELECT version, definition, published_at, published_by FROM enrollment_form_versions ORDER BY version DESC LIMIT 1").first<VersionRow>();
  if (!row) {
    await db.prepare("INSERT OR IGNORE INTO enrollment_form_versions (version, definition, published_at, published_by) VALUES (1, ?, ?, 'system')")
      .bind(JSON.stringify(defaultDefinition), new Date().toISOString()).run();
    row = await db.prepare("SELECT version, definition, published_at, published_by FROM enrollment_form_versions ORDER BY version DESC LIMIT 1").first<VersionRow>();
  }
  if (!row) throw new Error("Enrollment form unavailable");
  return { version: row.version, definition: JSON.parse(row.definition) as FormDefinition, publishedAt: row.published_at };
}
export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
