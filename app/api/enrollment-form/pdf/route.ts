import { actor, businessLocation, database, isBusinessAdmin, isSuperAdmin, jsonError, publishedForm } from "@/lib/enrollment-server";
import { createRegistrationPdf } from "@/lib/registration-pdf";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await actor();
  if (!user) return jsonError("Sign in to view the registration PDF.", 401);
  if (!isBusinessAdmin(user) && !isSuperAdmin(user)) return jsonError("Only administrators can view the full registration PDF.", 403);
  try {
    const db = database();
    const [form, location] = await Promise.all([publishedForm(db), businessLocation(db)]);
    const pdf = await createRegistrationPdf(form.definition, form.version, location.country, location.region);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="child-registration-form-v${form.version}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Could not create registration PDF", error);
    return jsonError("The registration PDF could not be created. Please try again.", 503);
  }
}
