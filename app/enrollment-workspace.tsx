"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ClipboardList, FilePenLine, FileText, LockKeyhole, Plus, Printer, Save, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Answers, type Field, type FieldType, type FormDefinition, type Person, applies, defaultDefinition, fieldTypes, regions, validateAnswers, validateDefinition } from "@/lib/enrollment-form";
import { adminFields, intakeAnswers, type RegistrationIntake } from "@/lib/registration-intake";

type RecordItem = { id: string; intake_id: string | null; country: string; region: string; form_version: number; status: string; answers: Answers; labels?: Record<string, string>; updated_at: string; submitted_at: string | null };
type LocationItem = { country: string; region: string; revision: number; canManage: boolean };
const emptyPerson = (): Person => ({ name: "", relationship: "", phone: "", email: "", address: "" });
const readJson = async (res: Response) => {
  const data: any = await res.json();
  if (!res.ok) throw new Error(data.error || "Please try again.");
  return data;
};

function JurisdictionSelect({ country, region, onChange }: { country: string; region: string; onChange: (country: string, region: string) => void }) {
  return <label className="enroll-field jurisdiction-picker"><span>Province, territory or state</span>
    <select value={`${country}|${region}`} onChange={e => {
      const [nextCountry, nextRegion] = e.target.value.split("|");
      onChange(nextCountry, nextRegion);
    }}>
      {Object.entries(regions).map(([name, locations]) =>
        <optgroup key={name} label={name === "Canada" ? "Canada — provinces and territories" : "United States — states, DC and territories"}>
          {locations.map(location => <option key={location} value={`${name}|${location}`}>{location}</option>)}
        </optgroup>)}
    </select>
    <small>Canada and the United States are both listed. Selected country: {country}.</small>
  </label>;
}

export function BusinessLocationSettings({ section = "settings", onOpenForm }: { section?: "settings" | "children"; onOpenForm?: () => void }) {
  const [location, setLocation] = useState<LocationItem | null>(null);
  const [country, setCountry] = useState("Canada");
  const [region, setRegion] = useState("Ontario");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    const current: LocationItem = await readJson(await fetch("/api/business-location", { cache: "no-store" }));
    setLocation(current); setCountry(current.country); setRegion(current.region);
  };
  useEffect(() => { load().catch(e => setError(e.message)).finally(() => setLoading(false)); }, []);
  const saveLocation = async () => {
    if (!location?.canManage) return;
    setBusy(true);
    try {
      const updated: LocationItem = await readJson(await fetch("/api/business-location", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, region, expectedRevision: location.revision }),
      }));
      setLocation({ ...updated, canManage: true });
      toast.success("Provider location saved. Guardian forms now use the selected jurisdiction.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  return <div className="enroll-page business-settings-page">
    <div className="enroll-heading"><div><p className="eyebrow">CHILD CARE BUSINESS ADMIN</p><h1>{section === "children" ? "Children & guardians" : "Centre settings"}</h1><p>Set the location used by your guardian registration form.</p></div>{onOpenForm && <Button variant="outline" onClick={onOpenForm}><ClipboardList/> View registration form</Button>}</div>
    <section className="panel business-location-card"><div><h2>Provider jurisdiction</h2><p>This province, territory or state controls the local questions in each child&apos;s registration. Guardians see the saved location as read-only. Only an authorized child care business administrator can change it.</p></div>
      {loading ? <p>Loading provider location…</p> : error ? <div><p role="alert">{error}</p><Button variant="outline" onClick={() => { setError(""); setLoading(true); load().catch(e => setError(e.message)).finally(() => setLoading(false)); }}>Try again</Button></div> : location?.canManage
        ? <div className="business-location-editor"><JurisdictionSelect country={country} region={region} onChange={(c, r) => { setCountry(c); setRegion(r); }}/><Button disabled={busy || (country === location.country && region === location.region)} onClick={saveLocation}><Save/> {busy ? "Saving…" : "Save location"}</Button></div>
        : <div className="enroll-location-locked"><LockKeyhole aria-hidden="true"/><div><strong>{location?.region}, {location?.country}</strong><small>Contact your business administrator to change this location.</small></div></div>}
      {!loading && !error && location?.canManage && <div className="business-guardian-preview"><span>Guardian registration view</span><div className="enroll-location-locked"><LockKeyhole aria-hidden="true"/><div><strong>{location.region}, {location.country}</strong><small>Set by the child care business administrator</small></div></div><small>This display updates after you save a new location.</small></div>}
    </section>
  </div>;
}

export function EnrollmentWorkspace({ role }: { role: "business" | "guardian" | "owner" }) {
  const [definition, setDefinition] = useState<FormDefinition | null>(null);
  const [version, setVersion] = useState(1);
  const [canEdit, setCanEdit] = useState(false);
  const [signedIn, setSignedIn] = useState(true);
  const [tab, setTab] = useState("form");
  const [country, setCountry] = useState("Canada");
  const [region, setRegion] = useState("Ontario");
  const [canExport, setCanExport] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [intakes, setIntakes] = useState<RegistrationIntake[]>([]);
  const [intakeId, setIntakeId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | undefined>();
  const [sectionIndex, setSectionIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(null);
  const [attachmentNames, setAttachmentNames] = useState<Record<string, string>>({});
  const [locationChanged, setLocationChanged] = useState(false);

  const refresh = async () => {
    const location: LocationItem = await readJson(await fetch("/api/business-location", { cache: "no-store" }));
    setCountry(location.country); setRegion(location.region);
    setCanExport(location.canManage);
    const form = await readJson(await fetch("/api/enrollment-form", { cache: "no-store" }));
    setDefinition(form.definition); setVersion(form.version); setCanEdit(form.canEdit);
    const mineResponse = await fetch("/api/enrollments", { cache: "no-store" });
    if (mineResponse.status === 401) { setSignedIn(false); return form; }
    const mine = await readJson(mineResponse);
    setRecords(mine.records);
    const assigned: RegistrationIntake[] = role === "guardian" ? (await readJson(await fetch("/api/registration-intakes", { cache: "no-store" }))).intakes : [];
    setIntakes(assigned);
    const fromLink = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("registration") : null;
    const chosen = assigned.find(item => item.id === fromLink && item.status !== "submitted") || assigned.find(item => item.status === "ready" || item.status === "in_progress");
    setIntakeId(chosen?.id || null);
    const lastDraft = (mine.records as RecordItem[]).find(r => r.status === "draft" && r.intake_id === chosen?.id) || (!chosen ? (mine.records as RecordItem[]).find(r => r.status === "draft" && !r.intake_id) : undefined);
    if (lastDraft) {
      setDraftId(lastDraft.id); setAnswers(chosen ? intakeAnswers(chosen, lastDraft.answers) : lastDraft.answers);
      setLocationChanged(lastDraft.country !== location.country || lastDraft.region !== location.region);
      const files = await readJson(await fetch(`/api/enrollment-attachments?submissionId=${encodeURIComponent(lastDraft.id)}`, { cache: "no-store" }));
      setAttachmentNames(Object.fromEntries(files.attachments.map((a: { id: string; filename: string }) => [a.id, a.filename])));
    } else { setDraftId(undefined); setAnswers(chosen ? intakeAnswers(chosen) : {}); setLocationChanged(false); setAttachmentNames({}); }
    return form;
  };
  useEffect(() => { refresh().catch(e => setLoadError(e.message)).finally(() => setLoading(false)); }, []);
  const sections = definition?.sections || [];
  const selectedIntake = intakes.find(item => item.id === intakeId) || null;
  const active = sections[Math.min(sectionIndex, sections.length - 1)];
  const visible = useMemo(() => definition?.fields.filter(field => applies(field, country, region, answers)) || [], [definition, country, region, answers]);
  const usedSections = sections.filter(s => visible.some(f => f.section === s.id));

  const changeAnswer = (id: string, value: string | Person[]) => setAnswers(current => ({ ...current, [id]: value }));
  const save = async (status: "draft" | "submitted") => {
    if (!definition || !signedIn) { toast.error("Sign in to save or submit enrollment answers."); return; }
    const error = validateAnswers(definition, country, region, answers, status === "submitted");
    if (error) {
      const bad = definition.fields.find(f => error.includes(f.label));
      if (bad) setSectionIndex(Math.max(0, sections.findIndex(s => s.id === bad.section)));
      toast.error(error); return;
    }
    setBusy(true);
    try {
      const result = await readJson(await fetch("/api/enrollments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draftId, intakeId: selectedIntake?.id, country, region, formVersion: version, status, answers }),
      }));
      setDraftId(status === "draft" ? result.id : undefined);
      setLocationChanged(false);
      toast.success(status === "draft" ? "Draft saved. You can return later." : "Enrollment submitted for review.");
      if (status === "submitted") { setSubmitted(true); setAnswers({}); setSectionIndex(0); if (selectedIntake) { setIntakes(current => current.map(item => item.id === selectedIntake.id ? { ...item, status: "submitted" } : item)); setIntakeId(null); } }
      const mine = await readJson(await fetch("/api/enrollments", { cache: "no-store" }));
      setRecords(mine.records);
      return result.id as string;
    } catch (e) {
      if ((e as Error).message.includes("provider location changed")) {
        try {
          const location: LocationItem = await readJson(await fetch("/api/business-location", { cache: "no-store" }));
          setCountry(location.country); setRegion(location.region); setLocationChanged(true);
        } catch { /* Keep answers on this page if the location lookup fails. */ }
      }
      toast.error((e as Error).message);
    }
    finally { setBusy(false); }
  };
  const upload = async (field: Field, file: File) => {
    const id = await save("draft");
    if (!id) return;
    setBusy(true);
    try {
      const form = new FormData(); form.set("submissionId", id); form.set("fieldId", field.id); form.set("file", file);
      const result = await readJson(await fetch("/api/enrollment-attachments", { method: "POST", body: form }));
      changeAnswer(field.id, result.id); setAttachmentNames(current => ({ ...current, [result.id]: result.filename }));
      toast.success(`${result.filename} uploaded. Save your draft to keep the link.`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const removeUpload = async (field: Field) => {
    const id = answers[field.id];
    if (typeof id !== "string" || !id) return;
    setBusy(true);
    try {
      await readJson(await fetch("/api/enrollment-attachments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }));
      const nextAnswers = { ...answers, [field.id]: "" };
      setAnswers(nextAnswers);
      if (draftId) await readJson(await fetch("/api/enrollments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: draftId, country, region, formVersion: version, status: "draft", answers: nextAnswers }) }));
      setAttachmentNames(current => { const next = { ...current }; delete next[id]; return next; });
      toast.success("Document removed.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const publish = async (next: FormDefinition) => {
    const checked = validateDefinition(next);
    if (!checked) { toast.error("Review the question labels, location rules and answer choices."); return; }
    setBusy(true);
    try {
      const result = await readJson(await fetch("/api/enrollment-form", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ definition: checked, expectedVersion: version }),
      }));
      setDefinition(checked); setVersion(result.version);
      toast.success(`Version ${result.version} published for all locations.`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const chooseIntake = async (intake: RegistrationIntake) => {
    setIntakeId(intake.id); setSectionIndex(0); setSubmitted(false);
    const draft = records.find(record => record.status === "draft" && record.intake_id === intake.id);
    setDraftId(draft?.id);
    setAnswers(intakeAnswers(intake, draft?.answers));
    setAttachmentNames({});
    if (draft) {
      try {
        const files = await readJson(await fetch(`/api/enrollment-attachments?submissionId=${encodeURIComponent(draft.id)}`, { cache: "no-store" }));
        setAttachmentNames(Object.fromEntries(files.attachments.map((file: { id: string; filename: string }) => [file.id, file.filename])));
      } catch (e) { toast.error((e as Error).message); }
    }
  };
  if (loading) return <div className="enroll-page"><div className="panel enrollment-state">Loading the enrollment form…</div></div>;
  if (loadError || !definition) return <div className="enroll-page"><div className="panel enrollment-state"><h2>Form unavailable</h2><p>{loadError || "Please try again."}</p><Button onClick={() => { setLoadError(""); setLoading(true); refresh().catch(e => setLoadError(e.message)).finally(() => setLoading(false)); }}>Try again</Button></div></div>;

  return <div className="enroll-page enrollment-workspace">
    <div className="enroll-heading">
      <div><p className="eyebrow">{role === "owner" ? "SUPER ADMIN" : role === "guardian" ? "GUARDIAN REGISTRATION" : "REGISTRATION FORM SETUP"}</p><h1>Child enrollment form</h1><p>One family form with questions tailored to the provider&apos;s location.</p></div>
      <div className="enroll-version"><Badge variant="outline">Published v{version}</Badge><span>{Object.values(regions).reduce((sum, items) => sum + items.length, 0)} jurisdictions</span></div>
    </div>
    {role === "owner" && canEdit ? <Tabs value={tab} onValueChange={setTab}><TabsList className="enroll-tabs"><TabsTrigger value="form"><ClipboardList/> Form preview</TabsTrigger><TabsTrigger value="builder"><FilePenLine/> Edit form</TabsTrigger><TabsTrigger value="responses"><Users/> Submissions</TabsTrigger></TabsList></Tabs> : <div className="enroll-note">{role === "business" ? "The published questions are managed by the Super Admin. Review the complete form for your provider location below." : "You can save a draft and return to it later. Required answers are checked before you submit."}</div>}
    {role === "business" && signedIn && canExport && <div className="registration-form-actions"><a href="/api/enrollment-form/pdf" target="_blank" rel="noreferrer"><FileText/> View full form as PDF</a><a href="/registration-form/print" target="_blank" rel="noreferrer"><Printer/> Print entire form</a><span>Both copies include every section and conditional question for {region}, {country}.</span></div>}
    {role === "owner" && tab === "builder" && canEdit
      ? <FormBuilder key={version} definition={definition} version={version} busy={busy} onPublish={publish} />
      : role === "owner" && tab === "responses" && canEdit
        ? <SubmissionList records={records} selected={selectedRecord} onSelect={setSelectedRecord} refresh={async () => { try { const data = await readJson(await fetch("/api/enrollments?scope=all", { cache: "no-store" })); setRecords(data.records); } catch (e) { toast.error((e as Error).message); } }} />
        : <>
          {submitted && <div className="enroll-success"><Check/> Enrollment submitted. The provider can now review the answers.</div>}
          {!signedIn && <div className="enroll-note">Sign in with ChatGPT to save a draft or submit this form. <a href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in</a></div>}
          {role === "guardian" && <section className="panel intake-panel guardian-intake-note"><h2>Admin first page</h2><p>Your child care administrator sets the first page and reserves your requested care dates. The guardian completes the family, health and consent sections.</p>{intakes.some(item => item.status !== "submitted") && <div className="guardian-intake-choices">{intakes.filter(item => item.status !== "submitted").map(item => <button type="button" className={intakeId === item.id ? "selected" : ""} key={item.id} onClick={() => chooseIntake(item)}><strong>{item.childFirst} {item.childLast}</strong><small>{item.roomName} · {item.slots.length} selected dates · {item.status.replace("_", " ")}</small></button>)}</div>}{selectedIntake && <p className="portal-muted">Prime guardian: {selectedIntake.guardianName} · {selectedIntake.guardianEmail}. Assigned classroom: {selectedIntake.roomName}. The provider location and Admin entries are locked.</p>}{!selectedIntake && <p>{intakes.length ? "No registration is awaiting completion. Submitted forms remain with the provider." : "No Admin first page is assigned to this signed-in email. Ask the child care administrator to prepare your registration."}</p>}</section>}
          {(role !== "guardian" || selectedIntake || draftId) && <div className="enroll-layout">
            <aside className="panel enroll-outline">
              <h2>Sections</h2><ol>{usedSections.map((s, index) => <li key={s.id}><button className={s.id === active?.id ? "current" : ""} onClick={() => setSectionIndex(sections.findIndex(part => part.id === s.id))}><span>{index + 1}</span>{s.title}</button></li>)}</ol>
              <p>Required questions are marked *</p>
            </aside>
            <div className="enroll-body">
              <div className="panel enroll-location">
                <div><b>Provider location</b><p>The child care business administrator sets the province, territory or state for this program.</p></div>
                <div className="enroll-location-locked" aria-label={`Provider location: ${region}, ${country}. Set by the child care business administrator.`}><LockKeyhole aria-hidden="true"/><div><strong>{region}, {country}</strong><small>Set by the child care business administrator</small></div></div>
              </div>
              {locationChanged && <div className="enroll-note" role="status">The provider&apos;s location changed since you saved this draft. Review the questions for {region}, {country}, then save again. Your existing answers are still here.</div>}
              <div className="panel enroll-section enroll-current">
                <div className="enroll-section-heading"><span>{sectionIndex + 1} / {sections.length}</span><h2>{active?.title}</h2><p>{active?.help}</p></div>
                <div className="enroll-grid">{visible.filter(field => field.section === active?.id).map(field =>
                  <EnrollmentField key={field.id} field={field} value={answers[field.id]} filename={attachmentNames[String(answers[field.id] || "")]} onUpload={file => upload(field, file)} onRemove={() => removeUpload(field)} onChange={value => changeAnswer(field.id, value)} locked={!!selectedIntake && adminFields.has(field.id)} lockedPrimary={!!selectedIntake && field.id === "guardians"} preview={role !== "guardian"} />)}</div>
                {visible.filter(field => field.section === active?.id).length === 0 && <p>No questions apply to this location in this section.</p>}
              </div>
              <div className="enroll-actions">
                <Button variant="outline" disabled={sectionIndex === 0} onClick={() => setSectionIndex(v => v - 1)}><ArrowLeft/> Back</Button>
                <div>{role === "guardian" && <Button variant="outline" disabled={busy || !signedIn} onClick={() => save("draft")}><Save/> {busy ? "Saving…" : "Save draft"}</Button>}
                  {sectionIndex < sections.length - 1
                    ? <Button onClick={() => setSectionIndex(v => v + 1)}>Next section <ArrowRight/></Button>
                    : role === "guardian" && <Button disabled={busy || !signedIn} onClick={() => save("submitted")}>Submit for review <ArrowRight/></Button>}
                </div>
              </div>
              <p className="enroll-legal-note">The provider may need separate official forms, evidence or signatures for its licence, program and local public health authority. A submitted form is retained with the version used when it was completed.</p>
            </div>
          </div>}
        </>}
  </div>;
}

function EnrollmentField({ field, value, filename, onUpload, onRemove, onChange, locked = false, lockedPrimary = false, preview = false }: { field: Field; value: string | Person[] | undefined; filename?: string; onUpload: (file: File) => void; onRemove: () => void; onChange: (value: string | Person[]) => void; locked?: boolean; lockedPrimary?: boolean; preview?: boolean }) {
  const people = Array.isArray(value) ? value : [];
  if (preview) return <div className="enroll-field guardian-locked-field"><strong>{field.label} {field.required && "*"}</strong>{field.help && <small>{field.help}</small>}<small>{field.type === "people" ? "People and contact details" : field.type === "document" ? "Document upload" : field.type === "select" ? field.options?.join(" · ") : field.type === "textarea" ? "Long answer" : "Answer field"}</small></div>;
  if (locked) return <div className="enroll-field guardian-locked-field"><strong><LockKeyhole aria-hidden="true"/> {field.label}</strong><span>{typeof value === "string" ? value : "—"}</span><small>Set by the child care administrator</small></div>;
  if (field.type === "document") return <div className="enroll-field wide enroll-document"><span>{field.label} {field.required && <strong aria-label="required">*</strong>}</span>{field.help && <small>{field.help}</small>}<label className="enroll-file-control"><input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={e => { if (e.target.files?.[0]) onUpload(e.target.files[0]); e.target.value = ""; }}/><span>Choose PDF, JPG or PNG · up to 10 MB</span></label>{typeof value === "string" && value && <div className="enroll-uploaded"><Check/> <a href={`/api/enrollment-attachments?id=${encodeURIComponent(value)}`} target="_blank" rel="noreferrer">{filename || "View uploaded document"}</a><Button type="button" size="sm" variant="ghost" onClick={onRemove}>Remove document</Button></div>}</div>;
  if (field.type === "people") return <fieldset className="enroll-people">
    <legend>{field.label} {field.required && <span aria-label="required">*</span>}</legend>
    {field.help && <p>{field.help}</p>}
    {people.map((person, index) => lockedPrimary && index === 0 ? <div className="guardian-prime-contact" key={index}><strong><LockKeyhole/> Prime guardian set by Admin</strong><span>{person.name} · {person.phone} · {person.email}</span></div> : <div className="enroll-person" key={index}>
      <div className="enroll-person-title"><strong>Person {index + 1}</strong><Button type="button" size="sm" variant="ghost" onClick={() => onChange(people.filter((_, i) => i !== index))}><Trash2/> Remove</Button></div>
      <div className="enroll-grid">{(["name","relationship","phone","email","address"] as const).map(key => <label key={key} className="enroll-field"><span>{({ name: "Full name", relationship: "Relationship", phone: "Phone", email: "Email", address: "Address" })[key]}</span><input type={key === "phone" ? "tel" : key === "email" ? "email" : "text"} value={person[key] || ""} onChange={e => onChange(people.map((p, i) => i === index ? { ...p, [key]: e.target.value } : p))}/></label>)}</div>
    </div>)}
    <Button type="button" size="sm" variant="outline" onClick={() => onChange([...people, emptyPerson()])}><Plus/> Add person</Button>
  </fieldset>;
  return <label className={field.type === "textarea" ? "enroll-field wide" : "enroll-field"}>
    <span>{field.label} {field.required && <strong aria-label="required">*</strong>}</span>
    {field.help && <small>{field.help}</small>}
    {field.type === "textarea" ? <Textarea value={typeof value === "string" ? value : ""} onChange={e => onChange(e.target.value)} rows={3}/>
      : field.type === "select" ? <select value={typeof value === "string" ? value : ""} onChange={e => onChange(e.target.value)}><option value="">Select an answer</option>{field.options?.map(option => <option key={option}>{option}</option>)}</select>
        : <Input type={field.type} value={typeof value === "string" ? value : ""} onChange={e => onChange(e.target.value)}/>}
  </label>;
}

function FormBuilder({ definition, version, busy, onPublish }: { definition: FormDefinition; version: number; busy: boolean; onPublish: (definition: FormDefinition) => void }) {
  const [draft, setDraft] = useState<FormDefinition>(() => structuredClone(definition));
  const [country, setCountry] = useState("Canada");
  const [region, setRegion] = useState("Ontario");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const change = (next: FormDefinition) => { setDraft(next); setDirty(true); };
  const updateField = (id: string, changes: Partial<Field>) => change({ ...draft, fields: draft.fields.map(f => f.id === id ? { ...f, ...changes } : f) });
  const locationFields = draft.fields.filter(f => (!f.country || f.country === country) && (!f.region || f.region === region));
  const shown = locationFields.filter(f => !search || (f.label + " " + f.id).toLowerCase().includes(search.toLowerCase()));
  const move = (id: string, direction: -1 | 1) => {
    const index = draft.fields.findIndex(f => f.id === id), other = index + direction;
    if (other < 0 || other >= draft.fields.length) return;
    const fields = [...draft.fields]; [fields[index], fields[other]] = [fields[other], fields[index]];
    change({ ...draft, fields });
  };
  const addField = () => {
    const id = `question_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const field: Field = { id, section: draft.sections[0].id, label: "New question", type: "text", required: false, country, region };
    change({ ...draft, fields: [...draft.fields, field] }); setSelected(id);
  };
  const addSection = () => {
    const id = `section_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    change({ ...draft, sections: [...draft.sections, { id, title: "New section" }] });
  };
  return <div className="builder-layout">
    <div className="builder-head panel"><div><Badge variant="outline">Editing published v{version}</Badge><h2>Super Admin form editor</h2><p>Changes stay in this editor until you publish. Every provider location uses this version of the shared form.</p></div><Button disabled={!dirty || busy} onClick={() => onPublish(draft)}>{busy ? "Publishing…" : "Publish changes"}</Button></div>
    <div className="builder-grid">
      <aside className="panel builder-sidebar">
        <h3>Review a location</h3>
        <JurisdictionSelect country={country} region={region} onChange={(nextCountry, nextRegion) => { setCountry(nextCountry); setRegion(nextRegion); setSelected(null); }}/>
        <div className="builder-count"><strong>{locationFields.length}</strong><span>questions shown for {region}</span></div>
        <h3>Sections</h3>
        {draft.sections.map((section, index) => <div className="builder-section-editor" key={section.id}><Label htmlFor={`section-${section.id}`}>{index + 1}. Section title</Label><Input id={`section-${section.id}`} value={section.title} onChange={e => change({ ...draft, sections: draft.sections.map(s => s.id === section.id ? { ...s, title: e.target.value } : s) })}/><Label htmlFor={`help-${section.id}`}>Section guidance</Label><Textarea id={`help-${section.id}`} value={section.help || ""} rows={2} onChange={e => change({ ...draft, sections: draft.sections.map(s => s.id === section.id ? { ...s, help: e.target.value } : s) })}/></div>)}
        <Button size="sm" variant="outline" onClick={addSection}><Plus/> Add section</Button>
        <div className="builder-guidance"><LockKeyhole/><p>Only the authenticated Super Admin can publish. Other users see the published form and cannot edit its structure.</p></div>
      </aside>
      <div className="builder-main">
        <div className="builder-toolbar"><div className="search"><Search/><input aria-label="Search questions" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions"/></div><Button onClick={addField}><Plus/> Add question</Button></div>
        <div className="builder-review"><b>Jurisdiction review</b><p>The shared catalog covers common enrollment information across Canada and the U.S. Local licensing and health requirements can differ by licence type and municipality. Review each location and add or require its additional questions before enrollment use.</p><div><a href="https://childcare.gov/state-resources" target="_blank" rel="noreferrer">U.S. state and territory resources</a><a href="https://www.ontario.ca/document/child-care-centre-licensing-manual/part-11-administrative-matters" target="_blank" rel="noreferrer">Ontario records</a><a href="https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/332_2007" target="_blank" rel="noreferrer">BC child records</a></div></div>
        <div className="builder-list">{shown.map(field => <article className={selected === field.id ? "builder-item selected" : "builder-item"} key={field.id}>
          <button type="button" className="builder-item-summary" onClick={() => setSelected(selected === field.id ? null : field.id)} aria-expanded={selected === field.id}><span><b>{field.label}</b><small>{draft.sections.find(s => s.id === field.section)?.title} · {field.type} · {field.country ? field.region || field.country : "All locations"}</small></span><Badge variant={field.required ? "default" : "outline"}>{field.required ? "Required" : "Optional"}</Badge></button>
          {selected === field.id && <div className="builder-fields">
            <label className="enroll-field"><span>Question label</span><Input value={field.label} onChange={e => updateField(field.id, { label: e.target.value })}/></label>
            <label className="enroll-field"><span>Answer type</span><select value={field.type} onChange={e => updateField(field.id, { type: e.target.value as FieldType, options: e.target.value === "select" ? field.options || ["Yes","No"] : undefined })}>{fieldTypes.map(type => <option key={type}>{type}</option>)}</select></label>
            <label className="enroll-field"><span>Section</span><select value={field.section} onChange={e => updateField(field.id, { section: e.target.value })}>{draft.sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
            <label className="enroll-field"><span>Show for</span><select value={field.region ? "region" : field.country ? "country" : "all"} onChange={e => { const scope = e.target.value; updateField(field.id, { country: scope === "all" ? undefined : country, region: scope === "region" ? region : undefined }); }}><option value="all">All locations</option><option value="country">This country</option><option value="region">This province, territory or state</option></select></label>
            {field.country && <label className="enroll-field"><span>Country</span><select value={field.country} onChange={e => updateField(field.id, { country: e.target.value, region: field.region ? regions[e.target.value][0] : undefined })}>{Object.keys(regions).map(c => <option key={c}>{c}</option>)}</select></label>}
            {field.region && <label className="enroll-field"><span>Specific location</span><select value={field.region} onChange={e => updateField(field.id, { region: e.target.value })}>{regions[field.country!].map(r => <option key={r}>{r}</option>)}</select></label>}
            <label className="builder-required"><input type="checkbox" checked={field.required} onChange={e => updateField(field.id, { required: e.target.checked })}/> Require an answer before submission</label>
            {field.type === "select" && <label className="enroll-field wide"><span>Answer choices (one per line)</span><Textarea value={(field.options || []).join("\n")} rows={4} onChange={e => updateField(field.id, { options: e.target.value.split("\n").filter(Boolean) })}/></label>}
            <label className="enroll-field wide"><span>Help for guardians</span><Textarea value={field.help || ""} rows={2} onChange={e => updateField(field.id, { help: e.target.value })}/></label>
            <label className="enroll-field"><span>Only show when</span><select value={field.when?.field || ""} onChange={e => updateField(field.id, { when: e.target.value ? { field: e.target.value, value: draft.fields.find(f => f.id === e.target.value)?.options?.[0] || "Yes" } : undefined })}><option value="">Always</option>{draft.fields.slice(0, draft.fields.findIndex(f => f.id === field.id)).filter(f => f.type === "select").map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
            {field.when && <label className="enroll-field"><span>Equals</span><select value={field.when.value} onChange={e => updateField(field.id, { when: { ...field.when!, value: e.target.value } })}>{draft.fields.find(f => f.id === field.when?.field)?.options?.map(o => <option key={o}>{o}</option>)}</select></label>}
            <label className="enroll-field wide"><span>Official source URL (optional)</span><Input type="url" value={field.sourceUrl || ""} onChange={e => updateField(field.id, { sourceUrl: e.target.value || undefined })}/></label>
            <div className="builder-item-actions"><Button size="sm" variant="outline" onClick={() => move(field.id, -1)}><ArrowUp/> Move up</Button><Button size="sm" variant="outline" onClick={() => move(field.id, 1)}><ArrowDown/> Move down</Button>{confirmDelete === field.id ? <><Button size="sm" variant="destructive" onClick={() => { change({ ...draft, fields: draft.fields.filter(f => f.id !== field.id) }); setSelected(null); setConfirmDelete(null); }}>Confirm delete</Button><Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button></> : <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(field.id)}><Trash2/> Delete question</Button>}</div>
          </div>}
        </article>)}</div>
      </div>
    </div>
  </div>;
}

function SubmissionList({ records, selected, onSelect, refresh }: { records: RecordItem[]; selected: RecordItem | null; onSelect: (record: RecordItem | null) => void; refresh: () => void }) {
  useEffect(() => { refresh(); }, []);
  if (selected) return <div className="panel response-details"><Button variant="ghost" onClick={() => onSelect(null)}><ArrowLeft/> All submissions</Button><h2>{String(selected.answers.child_first || "")} {String(selected.answers.child_last || "")}</h2><p>{selected.region}, {selected.country} · Form v{selected.form_version} · {selected.status} · {selected.submitted_at ? new Date(selected.submitted_at).toLocaleString() : "Draft"}</p>{Object.entries(selected.answers).map(([id, answer]) => <div key={id}><b>{selected.labels?.[id] || id.replace(/_/g, " ")}</b><span>{typeof answer === "string" && /^[0-9a-f-]{36}$/.test(answer) ? <a href={`/api/enrollment-attachments?id=${encodeURIComponent(answer)}`} target="_blank" rel="noreferrer">View uploaded document</a> : typeof answer === "string" ? answer : answer.map(p => [p.name, p.relationship, p.phone].filter(Boolean).join(" · ")).join("; ")}</span></div>)}</div>;
  return <div className="panel response-list"><h2>Enrollment submissions</h2><p>Each submission retains the form version used by the guardian.</p>{records.filter(r => r.status === "submitted").length === 0 ? <p className="response-empty">No submitted enrollments yet.</p> : records.filter(r => r.status === "submitted").map(r => <button type="button" key={r.id} onClick={() => onSelect(r)}><span><b>{String(r.answers.child_first || "")} {String(r.answers.child_last || "")}</b><small>{r.region}, {r.country} · v{r.form_version}</small></span><span>{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : ""} <ArrowRight/></span></button>)}</div>;
}
