import { redirect } from "next/navigation";
import { actor, businessLocation, database, isBusinessAdmin, isSuperAdmin, publishedForm } from "@/lib/enrollment-server";
import { type Field } from "@/lib/enrollment-form";
import { PrintButton } from "./print-button";
import "./print-form.css";

export const dynamic = "force-dynamic";

function BlankAnswer({ field }: { field: Field }) {
  if (field.type === "people") return <div className="print-people">{[1, 2].map(person => <div key={person}><strong>Person {person}</strong><div>Name <span/></div><div>Relationship and phone <span/></div><div>Email and address <span/></div></div>)}<small>Attach another sheet for additional people.</small></div>;
  if (field.type === "document") return <div className="print-line">Document attached: <span/></div>;
  return <div className="print-answer-lines">{Array.from({ length: field.type === "textarea" ? 3 : 1 }, (_, index) => <div key={index}/>)}</div>;
}

export default async function PrintRegistrationForm() {
  const user = await actor();
  if (!user) redirect("/signin-with-chatgpt?return_to=%2Fregistration-form%2Fprint");
  if (!isBusinessAdmin(user) && !isSuperAdmin(user)) return <main className="print-form"><h1>Administrator access required</h1><p>Only an authorized administrator can print the full registration form.</p></main>;
  const db = database();
  const [form, location] = await Promise.all([publishedForm(db), businessLocation(db)]);
  const labels = new Map(form.definition.fields.map(field => [field.id, field.label]));
  const forLocation = (field: Field) => (!field.country || field.country === location.country) && (!field.region || field.region === location.region);
  return <main className="print-form">
    <div className="print-toolbar"><a href="/" className="print-back">Back to Admin</a><PrintButton/></div>
    <header><p>Little Sprouts Early Learning</p><h1>Child care registration form</h1><div>{location.region}, {location.country} · Published version {form.version}</div><small>Blank form for review or printing. * Required. Conditional questions are included below with their display conditions.</small></header>
    {form.definition.sections.map(section => {
      const fields = form.definition.fields.filter(field => field.section === section.id && forLocation(field));
      return <section key={section.id} className="print-section"><h2>{section.title}</h2>{section.help && <p className="print-section-help">{section.help}</p>}
        {!fields.length && <p className="print-section-help">No additional questions for {location.region}, {location.country} in this section.</p>}
        {fields.map(field => <div key={field.id} className="print-question"><h3>{field.label} {field.required && <span aria-label="required">*</span>}</h3>
          {field.when && <p className="print-condition">Show if: {labels.get(field.when.field) || field.when.field} = {field.when.value}</p>}
          {field.help && <p>{field.help}</p>}
          {field.type === "select" && field.options && <div className="print-options">{field.options.map(option => <span key={option}><i aria-hidden="true"/>{option}</span>)}</div>}
          <BlankAnswer field={field}/>
        </div>)}
      </section>;
    })}
    <footer>Little Sprouts Early Learning · {location.region}, {location.country} · Form v{form.version}</footer>
  </main>;
}
