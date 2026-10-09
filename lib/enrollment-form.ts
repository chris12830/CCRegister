export const regions: Record<string, string[]> = {
  Canada: ["Alberta","British Columbia","Manitoba","New Brunswick","Newfoundland and Labrador","Northwest Territories","Nova Scotia","Nunavut","Ontario","Prince Edward Island","Quebec","Saskatchewan","Yukon"],
  "United States": ["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","District of Columbia","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming","American Samoa","Guam","Northern Mariana Islands","Puerto Rico","U.S. Virgin Islands"],
};

export type FieldType = "text" | "email" | "tel" | "date" | "textarea" | "select" | "people" | "document";
export type Field = {
  id: string;
  section: string;
  label: string;
  type: FieldType;
  required: boolean;
  help?: string;
  options?: string[];
  country?: string;
  region?: string;
  when?: { field: string; value: string };
  sourceUrl?: string;
};
export type FormDefinition = { sections: { id: string; title: string; help?: string }[]; fields: Field[] };
export type Person = { name: string; relationship: string; phone: string; email: string; address: string };
export type Answers = Record<string, string | Person[]>;
export const fieldTypes: FieldType[] = ["text","email","tel","date","textarea","select","people","document"];
const f = (id: string, section: string, label: string, type: FieldType = "text", required = false, extra: Partial<Field> = {}): Field =>
  ({ id, section, label, type, required, ...extra });
const yesNo = ["Yes", "No"];

// A common intake catalog. Region rules are versioned by the Super Admin and
// can be extended for licence type, local public health rules and program policy.
export const defaultDefinition: FormDefinition = {
  sections: [
    { id: "child", title: "Child and enrollment", help: "Use the child's legal name for licensing records. Tell us the care schedule you need." },
    { id: "family", title: "Guardians, emergency contacts and safe pickup", help: "Add everyone who can make decisions, be called in an emergency or collect the child." },
    { id: "health", title: "Health, food and daily care", help: "Give details that staff need to support the child safely, including any individual plans." },
    { id: "agreements", title: "Agreements and permissions", help: "Answer each permission separately. Declining an optional permission is allowed." },
    { id: "local", title: "Location-specific records", help: "These questions depend on where the child care program operates." },
  ],
  fields: [
    f("child_first", "child", "Legal first name", "text", true),
    f("child_middle", "child", "Middle name"),
    f("child_last", "child", "Legal last name", "text", true),
    f("child_preferred", "child", "Name the child uses"),
    f("child_dob", "child", "Date of birth", "date", true),
    f("child_address", "child", "Home address", "textarea", true),
    f("child_sex", "child", "Sex recorded for the child", "select", true, { options: ["Female","Male","Intersex","Another designation","Prefer to discuss"] }),
    f("start_date", "child", "Expected first day", "date", true),
    f("program", "child", "Program or age group", "select", true, { options: ["Infant","Toddler","Preschool","Kindergarten","School age","Other"] }),
    f("care_setting", "child", "Type of care program", "select", true, { options: ["Licensed child care centre","Licensed home or family child care","School age program","Head Start or Early Head Start","Other"] }),
    f("classroom", "child", "Assigned classroom or named group"),
    f("schedule", "child", "Select Program Schedule (Days-Mornings-Afternoons-Custom)", "textarea", true, { help: "The administrator reserves the selected dates and space sections in the four week schedule." }),
    f("previous_care", "child", "Previous child care or school transition notes", "textarea"),
    f("guardians", "family", "Parents and legal guardians", "people", true, { help: "Add every legal guardian involved. The first person is the primary contact." }),
    f("guardian_decisions", "family", "Who may make enrollment and health decisions?", "textarea", true),
    f("guardian_separated", "family", "Are there custody or decision-making orders?", "select", true, { options: yesNo }),
    f("custody_details", "family", "Custody, access and decision-making instructions", "textarea", true, { when: { field: "guardian_separated", value: "Yes" }, help: "Give current restrictions and the location of supporting documents." }),
    f("custody_document", "family", "Current custody or access order", "document", false, { when: { field: "guardian_separated", value: "Yes" }, help: "Upload the relevant pages, if available. The provider must review the current order." }),
    f("emergency_contacts", "family", "Additional emergency contacts", "people", true, { help: "Add at least one person other than a guardian." }),
    f("pickup_people", "family", "Additional authorized pickup people", "people", false, { help: "Include relationship and phone number for each person. Guardians are already listed above." }),
    f("pickup_restrictions", "family", "People prohibited from access or pickup", "textarea", false, { help: "Name any restrictions and provide supporting documentation directly to the program." }),
    f("pickup_permission", "family", "May the provider release the child to the listed authorized people?", "select", true, { options: yesNo }),
    f("alternate_emergency", "family", "Emergency plan if no listed contact answers", "textarea"),
    f("health_provider", "health", "Health care provider name", "text", true, { help: "If the child does not have one, enter 'None' and discuss emergency care with the provider." }),
    f("health_phone", "health", "Health care provider phone", "tel", true, { help: "If unavailable, enter 'None'." }),
    f("allergies", "health", "Allergies, triggers, reactions and treatment", "textarea", true, { help: "Enter 'None known' when appropriate. Include anaphylaxis or food allergies." }),
    f("medical_needs", "health", "Medical conditions, disabilities and accessibility support", "textarea", true, { help: "Enter 'None known' when appropriate. Include asthma, seizures and additional support needs." }),
    f("care_plan", "health", "Individual care plan, accommodations and emergency steps", "textarea", false, { help: "List the current plan and who supplied it; arrange for required signed plans with the provider." }),
    f("care_plan_file", "health", "Care or emergency treatment plan", "document", false),
    f("medication_needed", "health", "Will staff need to administer medication?", "select", true, { options: yesNo }),
    f("medication_details", "health", "Medication, dose, timing and administration instructions", "textarea", true, { when: { field: "medication_needed", value: "Yes" } }),
    f("medication_permission", "health", "Do you authorize staff to administer medication under the agreed plan?", "select", true, { options: yesNo, when: { field: "medication_needed", value: "Yes" } }),
    f("immunization_status", "health", "Immunization status", "select", true, { options: ["Up to date","In progress","Exemption or deferral","Unknown / discuss with provider"] }),
    f("immunization_document", "health", "Immunization record or exemption document details", "textarea", false, { help: "The provider may require an official record or exemption form before attendance." }),
    f("immunization_file", "health", "Immunization record or exemption", "document", false),
    f("health_assessment", "health", "Recent health assessment, physician report or exam details", "textarea"),
    f("health_assessment_file", "health", "Physician or health assessment document", "document", false),
    f("diet", "health", "Food restrictions, dietary needs and meal instructions", "textarea", true, { help: "Enter 'None' if there are no restrictions." }),
    f("feeding", "health", "Feeding instructions, breast milk or formula", "textarea", false, { when: { field: "program", value: "Infant" } }),
    f("sleep", "health", "Sleep arrangements and routines", "textarea", false, { when: { field: "program", value: "Infant" } }),
    f("toileting", "health", "Toileting and diapering support", "textarea"),
    f("development", "health", "Development, communication, languages and inclusion needs", "textarea"),
    f("comfort", "health", "Comfort strategies or other daily care notes", "textarea"),
    f("emergency_medical", "agreements", "Do you authorize emergency medical care if we cannot reach you?", "select", true, { options: yesNo }),
    f("emergency_ambulance", "agreements", "May staff call an ambulance or health professional if needed?", "select", true, { options: yesNo }),
    f("handbook", "agreements", "I have reviewed the parent handbook and program policies", "select", true, { options: yesNo }),
    f("fee_agreement", "agreements", "I have reviewed the fees, payment terms and withdrawal policy", "select", true, { options: yesNo }),
    f("field_trips", "agreements", "Field trips and local walks", "select", true, { options: yesNo }),
    f("transport", "agreements", "Transportation by the provider, if offered", "select", true, { options: yesNo }),
    f("photo", "agreements", "Photos or video for internal learning records", "select", true, { options: yesNo }),
    f("media", "agreements", "Public or promotional media use", "select", true, { options: yesNo }),
    f("topicals", "agreements", "Sunscreen and topical products", "select", true, { options: yesNo }),
    f("screenings", "agreements", "Health and developmental screening, if offered", "select", true, { options: yesNo }),
    f("payer", "agreements", "Person responsible for payment", "text", true),
    f("payer_address", "agreements", "Billing address", "textarea", true),
    f("subsidy", "agreements", "Fee subsidy or funding arrangement", "textarea"),
    f("signature", "agreements", "Guardian's full legal name as electronic signature", "text", true, { help: "Typing your name records your acknowledgement with the submission time. The provider may also require a separate signed document." }),
    f("signature_date", "agreements", "Date signed", "date", true),
    f("bc_health_number", "local", "BC Medical Services Plan number", "text", true, { country: "Canada", region: "British Columbia", sourceUrl: "https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/332_2007" }),
    f("bc_identification", "local", "Child identification photo or description reference", "textarea", true, { country: "Canada", region: "British Columbia", sourceUrl: "https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/332_2007" }),
    f("bc_child_photo", "local", "Child identification photograph", "document", true, { country: "Canada", region: "British Columbia", sourceUrl: "https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/332_2007" }),
    f("bc_special_instructions", "local", "Written special care instructions agreed with the provider", "textarea", false, { country: "Canada", region: "British Columbia", sourceUrl: "https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/332_2007" }),
    f("ca_forms", "local", "California admission and health form status", "select", true, { country: "United States", region: "California", options: ["LIC 700, LIC 702 and LIC 627 supplied","Provider will collect official forms separately"], sourceUrl: "https://www.cdss.ca.gov/inforesources/forms-brochures/forms-alphabetic-list/i-l", help: "California publishes separate official forms. This answer does not replace a required official form." }),
    f("ca_official_forms", "local", "California official admission forms", "document", false, { country: "United States", region: "California", sourceUrl: "https://www.cdss.ca.gov/inforesources/forms-brochures/forms-alphabetic-list/i-l" }),
  ],
};

export function applies(field: Field, country: string, region: string, answers: Answers): boolean {
  if (field.country && field.country !== country) return false;
  if (field.region && field.region !== region) return false;
  if (field.when && answers[field.when.field] !== field.when.value) return false;
  return true;
}

export function validateDefinition(value: unknown): FormDefinition | null {
  if (!value || typeof value !== "object") return null;
  const form = value as FormDefinition;
  if (!Array.isArray(form.sections) || !Array.isArray(form.fields) || form.sections.length < 1 || form.sections.length > 30 || form.fields.length > 250) return null;
  const sections = new Set<string>(), fields = new Set<string>();
  for (const section of form.sections) {
    if (!section || typeof section.id !== "string" || !/^[a-z0-9_-]{1,50}$/.test(section.id) || sections.has(section.id) || typeof section.title !== "string" || !section.title.trim() || section.title.length > 120 || (section.help && (typeof section.help !== "string" || section.help.length > 500))) return null;
    sections.add(section.id);
  }
  for (const field of form.fields) {
    if (!field || typeof field.id !== "string" || !/^[a-z0-9_-]{1,70}$/.test(field.id) || fields.has(field.id) || !sections.has(field.section) || typeof field.label !== "string" || !field.label.trim() || field.label.length > 160 || !fieldTypes.includes(field.type) || typeof field.required !== "boolean" || (field.help && (typeof field.help !== "string" || field.help.length > 500))) return null;
    if (field.country && !regions[field.country]) return null;
    if (field.region && (!field.country || !regions[field.country]?.includes(field.region))) return null;
    if (field.type === "select" && (!Array.isArray(field.options) || field.options.length < 2 || field.options.length > 30 || field.options.some(option => typeof option !== "string" || !option.trim() || option.length > 100))) return null;
    if (field.when && (typeof field.when.field !== "string" || typeof field.when.value !== "string" || !fields.has(field.when.field))) return null;
    if (field.sourceUrl && (typeof field.sourceUrl !== "string" || !/^https:\/\//.test(field.sourceUrl) || field.sourceUrl.length > 400)) return null;
    fields.add(field.id);
  }
  return form;
}

export function validateAnswers(definition: FormDefinition, country: string, region: string, answers: Answers, submitting: boolean): string | null {
  if (!regions[country]?.includes(region)) return "Choose a valid provider location.";
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return "Enter the enrollment details.";
  const fields = new Set(definition.fields.map(f => f.id));
  if (Object.keys(answers).some(k => !fields.has(k))) return "This form has changed. Refresh and review the answers.";
  if (JSON.stringify(answers).length > 70000) return "The answers are too long.";
  for (const field of definition.fields) {
    if (!applies(field, country, region, answers)) continue;
    const answer = answers[field.id];
    if (field.type === "people") {
      if (answer !== undefined && (!Array.isArray(answer) || answer.length > 20 || answer.some(p => !p || typeof p.name !== "string" || typeof p.relationship !== "string" || typeof p.phone !== "string" || typeof p.email !== "string" || typeof p.address !== "string" || JSON.stringify(p).length > 1500))) return `Review ${field.label}.`;
      if (submitting && field.required && (!Array.isArray(answer) || !answer.some(p => p.name.trim() && p.phone.trim() && p.relationship.trim()))) return `Add a name, relationship and phone for ${field.label}.`;
      if (submitting && Array.isArray(answer) && answer.some(p => (p.name || p.phone || p.relationship || p.email || p.address) && (!p.name.trim() || !p.phone.trim() || !p.relationship.trim()))) return `Finish each person listed under ${field.label}, or remove an incomplete person.`;
    } else {
      if (answer !== undefined && (typeof answer !== "string" || answer.length > 4000)) return `Review ${field.label}.`;
      if (submitting && field.required && (typeof answer !== "string" || !answer.trim())) return `Complete ${field.label}.`;
      if (typeof answer === "string" && field.type === "select" && answer && !field.options?.includes(answer)) return `Review ${field.label}.`;
      if (submitting && typeof answer === "string" && answer && field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)) return `Enter a valid email for ${field.label}.`;
      if (submitting && typeof answer === "string" && answer && field.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(answer)) return `Enter a valid date for ${field.label}.`;
    }
  }
  return null;
}
