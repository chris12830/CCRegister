"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowRight, Baby, CheckCircle2, Download, FileHeart, FileText, HeartPulse, LockKeyhole, Search, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Answers, Person } from "@/lib/enrollment-form";
import { firstMonday, validDate, type ProgramRoom } from "@/lib/registration-intake";

type Role = "business" | "guardian" | "staff" | "owner";
type Enrollment = { id: string; country: string; region: string; form_version: number; status: string; answers: Answers; labels: Record<string, string>; updated_at: string; submitted_at: string | null };
type Props = { role: Role; section: string; onNavigate: (section: string) => void };
const readJSON = async (response: Response) => {
  const result = await response.json() as { error?: string; records?: Enrollment[]; attachments?: { id: string; field_id: string; filename: string; size: number }[]; rooms?: ProgramRoom[]; availability?: { date: string; day: number; am: number; pm: number; before: number; after: number }[] };
  if (!response.ok) throw new Error(result.error || "Please try again.");
  return result;
};
const answer = (record: Enrollment, field: string) => typeof record.answers[field] === "string" ? String(record.answers[field]) : "";
const people = (record: Enrollment, field: string): Person[] => Array.isArray(record.answers[field]) ? record.answers[field] as Person[] : [];
const childName = (record: Enrollment) => [answer(record, "child_first"), answer(record, "child_last")].filter(Boolean).join(" ") || "Unnamed child";
const primaryGuardian = (record: Enrollment) => people(record, "guardians")[0]?.name || "Guardian not listed";
const dateLabel = (date?: string | null) => date ? new Date(date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
const sampleChildren = [
  { name: "Mia Chen", program: "Preschool A", guardian: "Maya Chen", alert: "Peanut allergy", care: "EpiPen plan on file", status: "Active" },
  { name: "Noah Williams", program: "Toddler 2", guardian: "Daniel Williams", alert: "Medication consent review", care: "Check current medication instructions", status: "Review" },
  { name: "Amelia Brown", program: "Infant 1", guardian: "Alexis Brown", alert: "No dietary alerts", care: "Infant feeding routine on file", status: "Pending" },
  { name: "Leo Martin", program: "Preschool B", guardian: "Clara Martin", alert: "Asthma", care: "Asthma action plan on file", status: "Active" },
];

function useEnrollments(scope: "business" | "mine") {
  const [records, setRecords] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch(`/api/enrollments${scope === "business" ? "?scope=business" : ""}`, { cache: "no-store" })
      .then(readJSON).then(data => { if (active) setRecords(data.records || []); })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [scope]);
  return { records, loading, error };
}

function Heading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className="portal-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}
function Summary({ items }: { items: { label: string; value: string | number; detail?: string }[] }) {
  return <div className="portal-summary">{items.map(item => <div className="panel" key={item.label}><span>{item.label}</span><strong>{item.value}</strong>{item.detail && <small>{item.detail}</small>}</div>)}</div>;
}
function Empty({ children }: { children: React.ReactNode }) { return <div className="panel portal-empty">{children}</div>; }
function ErrorState({ message }: { message: string }) { return <div className="portal-error" role="alert">{message}</div>; }
function SampleNote() { return <p className="portal-sample"><LockKeyhole/> The examples below are illustrative. Saved data appears in registration, classroom capacity, scheduling, and family record views.</p>; }
function SearchField({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return <label className="portal-search"><Search/><span className="sr-only">{label}</span><Input aria-label={label} value={value} onChange={event => onChange(event.target.value)} placeholder={label}/></label>;
}
function PersonList({ title, entries }: { title: string; entries: Person[] }) {
  return <div className="portal-person-list"><h3>{title}</h3>{entries.length ? entries.map((person, index) => <div key={`${person.name}-${index}`}><strong>{person.name || "Name not supplied"}</strong><span>{[person.relationship, person.phone, person.email].filter(Boolean).join(" · ")}</span>{person.address && <small>{person.address}</small>}</div>) : <p>No people listed.</p>}</div>;
}

function BusinessRegistrations({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { records, loading, error } = useEnrollments("business");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const filtered = records.filter(record => `${childName(record)} ${primaryGuardian(record)} ${answer(record, "program")}`.toLowerCase().includes(query.toLowerCase()));
  const active = records.find(record => record.id === selected);
  const programs = new Set(records.map(record => answer(record, "program")).filter(Boolean));
  return <div className="portal-page"><Heading eyebrow="CHILD CARE ADMIN" title="Registrations" description="Review completed guardian forms and the child care details submitted for your business." action={<Button onClick={() => onNavigate("Registration Form Setup")}>Open form setup <ArrowRight/></Button>}/>
    {error ? <ErrorState message={error}/> : loading ? <Empty>Loading registrations…</Empty> : <><Summary items={[{ label: "Submitted", value: records.length, detail: "Guardian forms" }, { label: "Programs requested", value: programs.size, detail: "Across submitted forms" }, { label: "Most recent", value: dateLabel(records[0]?.submitted_at), detail: "Submission date" }]}/>
      <div className="portal-two-column"><section className="panel portal-list-panel"><div className="portal-panel-head"><div><h2>Submitted forms</h2><p>Select a child to review their answers.</p></div><SearchField value={query} onChange={setQuery} label="Search child, guardian or program"/></div>
        {filtered.length ? filtered.map(record => <button type="button" className={`portal-list-row ${selected === record.id ? "selected" : ""}`} key={record.id} onClick={() => setSelected(record.id)}><span><strong>{childName(record)}</strong><small>{primaryGuardian(record)} · {answer(record, "program") || "Program not listed"}</small></span><span>{dateLabel(record.submitted_at)} <ArrowRight/></span></button>) : <div className="portal-list-empty">{query ? "No registrations match your search." : "No submitted registrations yet. Completed guardian forms will appear here."}</div>}</section>
        <section className="panel portal-detail-panel">{active ? <><Badge variant="outline">Submitted</Badge><h2>{childName(active)}</h2><p>{active.region}, {active.country} · Form v{active.form_version} · {dateLabel(active.submitted_at)}</p><div className="portal-detail-grid"><div><span>Program</span><strong>{answer(active, "program") || "—"}</strong></div><div><span>Classroom</span><strong>{answer(active, "classroom") || "—"}</strong></div><div><span>Expected start</span><strong>{answer(active, "start_date") || "—"}</strong></div><div><span>Date of birth</span><strong>{answer(active, "child_dob") || "—"}</strong></div><div><span>Allergies</span><strong>{answer(active, "allergies") || "—"}</strong></div></div>{answer(active, "schedule") && <div className="portal-schedule-summary"><strong>Reserved program schedule</strong><p>{answer(active, "schedule")}</p></div>}<PersonList title="Parents and guardians" entries={people(active, "guardians")}/><PersonList title="Emergency contacts" entries={people(active, "emergency_contacts")}/><details className="portal-all-answers"><summary>View all submitted answers</summary>{Object.entries(active.answers).map(([key, value]) => <div key={key}><b>{active.labels?.[key] || key.replaceAll("_", " ")}</b><span>{Array.isArray(value) ? value.map(person => [person.name, person.relationship, person.phone].filter(Boolean).join(" · ")).join("; ") : /^[0-9a-f-]{36}$/.test(value) ? <a href={`/api/enrollment-attachments?id=${encodeURIComponent(value)}`} target="_blank" rel="noreferrer">Open document</a> : value}</span></div>)}</details></> : <div className="portal-detail-empty"><FileText/><h2>Choose a registration</h2><p>Submitted child, guardian, health, and consent information will appear here.</p></div>}</section></div>
    </>}
  </div>;
}

export function BusinessChildDirectory() {
  const { records, loading, error } = useEnrollments("business");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const filtered = records.filter(record => `${childName(record)} ${primaryGuardian(record)}`.toLowerCase().includes(query.toLowerCase()));
  const active = records.find(record => record.id === selected);
  return <section className="portal-page portal-followup"><div className="portal-panel-head"><div><h2>Registered children and guardians</h2><p>Children appear here after a guardian submits the enrollment form.</p></div><SearchField value={query} onChange={setQuery} label="Search child or guardian"/></div>
    {error ? <ErrorState message={error}/> : loading ? <Empty>Loading child records…</Empty> : <div className="portal-two-column"><div className="panel portal-list-panel">{filtered.length ? filtered.map(record => <button type="button" className={`portal-list-row ${selected === record.id ? "selected" : ""}`} key={record.id} onClick={() => setSelected(record.id)}><span><strong>{childName(record)}</strong><small>{primaryGuardian(record)} · {answer(record, "program") || "Program not listed"}</small></span><ArrowRight/></button>) : <div className="portal-list-empty">{query ? "No matching children." : "No submitted child records yet."}</div>}</div><div className="panel portal-detail-panel">{active ? <><h2>{childName(active)}</h2><p>{active.region}, {active.country} · Submitted {dateLabel(active.submitted_at)}</p><div className="portal-detail-grid"><div><span>Date of birth</span><strong>{answer(active, "child_dob") || "—"}</strong></div><div><span>Program</span><strong>{answer(active, "program") || "—"}</strong></div></div><PersonList title="Parents and guardians" entries={people(active, "guardians")}/><PersonList title="Authorized pickup" entries={people(active, "pickup_people")}/></> : <div className="portal-detail-empty"><Users/><h2>Select a child</h2><p>Guardian and pickup details will appear here.</p></div>}</div></div>}
  </section>;
}

function LiveClassroomCapacity({ onNavigate }: { onNavigate: (section: string) => void }) {
  const [rooms, setRooms] = useState<ProgramRoom[]>([]);
  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [days, setDays] = useState<{ date: string; day: number; am: number; pm: number; before: number; after: number }[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/program-rooms", { cache: "no-store" }).then(readJSON).then(data => setRooms(data.rooms || [])).catch(e => setError(e.message)); }, []);
  useEffect(() => {
    if (!roomId || !validDate(date)) return;
    let active = true;
    fetch(`/api/registration-intakes?scope=business&roomId=${encodeURIComponent(roomId)}&weekStart=${firstMonday(date)}`, { cache: "no-store" }).then(readJSON)
      .then(data => { if (active) { setDays(data.availability || []); setError(""); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [roomId, date]);
  const room = rooms.find(item => item.id === roomId), available = days.find(item => item.date === date);
  return <section className="panel portal-info-card portal-full-width"><div className="portal-panel-head"><div><h2>Configured classrooms and open space sections</h2><p>Live capacity from Admin registrations. Pick a date to see the unreserved sections of each numbered space.</p></div><Button variant="outline" onClick={() => onNavigate("Registration Form Setup")}>Manage classrooms <ArrowRight/></Button></div>
    {error && <ErrorState message={error}/>}{rooms.length ? <><div className="portal-chip-list">{rooms.map(item => <button type="button" className={roomId === item.id ? "selected" : ""} key={item.id} onClick={() => setRoomId(item.id)}>{item.name} · {item.ageGroup}</button>)}</div>{room && <><label className="portal-setting-label">Availability on <Input type="date" value={date} onChange={event => setDate(event.target.value)}/></label><Summary items={[{ label: "Open full days", value: available?.day ?? "…", detail: `${room.capacity} spaces · AM + PM paired` }, { label: "Open mornings", value: available?.am ?? "…" }, { label: "Open afternoons", value: available?.pm ?? "…" }, ...(room.beforeCapacity ? [{ label: "Open before school", value: available?.before ?? "…" }] : []), ...(room.afterCapacity ? [{ label: "Open after school", value: available?.after ?? "…" }] : [])]}/></>}</> : <p>No classrooms configured yet. Add a classroom and its capacities in Registration Form Setup.</p>}
  </section>;
}

function ProgramsAndTransitions({ onNavigate }: { onNavigate: (section: string) => void }) {
  const groups = [
    { name: "Infant", ages: "0–17 months", rooms: ["Infant 1", "Infant 2", "Infant 3"], capacity: 30, next: "Toddler" },
    { name: "Toddler", ages: "18–29 months", rooms: ["Toddler 1"], capacity: 15, next: "Preschool" },
    { name: "Preschool", ages: "30–43 months", rooms: ["Preschool 1"], capacity: 20, next: "Kindergarten" },
    { name: "Kindergarten", ages: "44–67 months", rooms: ["Kindergarten 1"], capacity: 20, next: "School age" },
    { name: "School Age", ages: "68–156 months", rooms: ["School Age 1"], capacity: 20, next: "School exit" },
  ];
  const [selected, setSelected] = useState(groups[0].name);
  const group = groups.find(item => item.name === selected)!;
  return <div className="portal-page"><Heading eyebrow="CHILD CARE ADMIN" title="Programs & transitions" description="Review configured classroom capacity and example transition stages." action={<Button variant="outline" onClick={() => onNavigate("Scheduling")}>Open scheduling <ArrowRight/></Button>}/><LiveClassroomCapacity onNavigate={onNavigate}/><SampleNote/>
    <Summary items={[{ label: "Named groups", value: groups.reduce((sum, item) => sum + item.rooms.length, 0) }, { label: "Sample day spaces", value: groups.reduce((sum, item) => sum + item.capacity, 0) }, { label: "Age ranges", value: groups.length }]}/>
    <div className="portal-two-column"><section className="panel portal-list-panel"><h2>Program groups</h2>{groups.map(item => <button type="button" className={`portal-list-row ${selected === item.name ? "selected" : ""}`} key={item.name} onClick={() => setSelected(item.name)}><span><strong>{item.name}</strong><small>{item.ages} · {item.rooms.length} named {item.rooms.length === 1 ? "group" : "groups"}</small></span><b>{item.capacity} spaces</b></button>)}</section>
      <section className="panel portal-detail-panel"><Badge variant="outline">Example program</Badge><h2>{group.name}</h2><p>{group.ages} · {group.capacity} total day spaces</p><div className="portal-detail-grid"><div><span>Named groups</span><strong>{group.rooms.length}</strong></div><div><span>Next stage</span><strong>{group.next}</strong></div></div><h3>Rooms</h3><div className="portal-chip-list">{group.rooms.map(room => <span key={room}>{room}</span>)}</div><p className="portal-muted">Capacity and transition dates on this example screen are illustrative. Schedule actual dates in Scheduling.</p></section></div>
  </div>;
}

function BusinessEmergencyCards() {
  const { records, loading, error } = useEnrollments("business");
  const [selected, setSelected] = useState<string | null>(null);
  const active = records.find(record => record.id === selected);
  return <div className="portal-page"><Heading eyebrow="CHILD CARE ADMIN" title="Emergency cards" description="Review child health alerts and contacts from submitted registrations." action={active && <Button variant="outline" onClick={() => window.print()}><FileHeart/> Print selected card</Button>}/>
    {error ? <ErrorState message={error}/> : loading ? <Empty>Loading emergency cards…</Empty> : <div className="portal-two-column"><section className="panel portal-list-panel"><h2>Children with submitted records</h2>{records.length ? records.map(record => <button type="button" className={`portal-list-row ${selected === record.id ? "selected" : ""}`} key={record.id} onClick={() => setSelected(record.id)}><span><strong>{childName(record)}</strong><small>{answer(record, "allergies") || "Allergies not listed"}</small></span><ArrowRight/></button>) : <div className="portal-list-empty">No submitted registrations yet. Emergency cards will appear after a guardian submits a form.</div>}</section>
      <section className="panel portal-detail-panel portal-print-card">{active ? <><p className="eyebrow">EMERGENCY CARD</p><h2>{childName(active)}</h2><p>{answer(active, "program") || "Program not listed"} · Date of birth {answer(active, "child_dob") || "—"}</p><div className="portal-safety-grid"><div><strong>Allergies and treatment</strong><p>{answer(active, "allergies") || "Not supplied"}</p></div><div><strong>Medical needs</strong><p>{answer(active, "medical_needs") || "Not supplied"}</p></div><div><strong>Care plan</strong><p>{answer(active, "care_plan") || "Not supplied"}</p></div><div><strong>Pickup restrictions</strong><p>{answer(active, "pickup_restrictions") || "Not supplied"}</p></div></div><PersonList title="Emergency contacts" entries={people(active, "emergency_contacts")}/><PersonList title="Parents and guardians" entries={people(active, "guardians")}/><p className="portal-muted">From the guardian form submitted {dateLabel(active.submitted_at)}. Verify against current signed plans before relying on this card.</p></> : <div className="portal-detail-empty"><FileHeart/><h2>Select a child</h2><p>Emergency information from their submitted registration will appear here.</p></div>}</section></div>}
  </div>;
}

function StaffAccess() {
  const roster = [
    { name: "Jordan Adams", role: "Educator", room: "Preschool A", access: "Room safety details" },
    { name: "Morgan Reed", role: "Supervisor", room: "All rooms", access: "Safety and emergency cards" },
    { name: "Taylor Wong", role: "Supply educator", room: "Toddler 1", access: "Assigned room safety details" },
  ];
  const [selected, setSelected] = useState(roster[0].name);
  const staff = roster.find(person => person.name === selected)!;
  return <div className="portal-page"><Heading eyebrow="CHILD CARE ADMIN" title="Staff access" description="Review the information each staff role is intended to see."/><SampleNote/>
    <div className="portal-two-column"><section className="panel portal-list-panel"><h2>Example staff directory</h2>{roster.map(person => <button type="button" className={`portal-list-row ${selected === person.name ? "selected" : ""}`} key={person.name} onClick={() => setSelected(person.name)}><span><strong>{person.name}</strong><small>{person.role} · {person.room}</small></span><ArrowRight/></button>)}</section><section className="panel portal-detail-panel"><Badge variant="outline">Example staff member</Badge><h2>{staff.name}</h2><p>{staff.role} · {staff.room}</p><div className="portal-detail-grid"><div><span>Access scope</span><strong>{staff.access}</strong></div><div><span>Registration and billing</span><strong>Hidden</strong></div></div><h3>Role rules</h3><ul className="portal-bullets"><li>Staff see child safety information for assigned rooms.</li><li>Guardian billing and enrollment answers stay outside the staff view.</li><li>Business administrators manage operational records.</li></ul><p className="portal-muted">Staff account invitations and role changes are not connected in this demo.</p></section></div>
  </div>;
}

function BusinessReports() {
  const { records, loading, error } = useEnrollments("business");
  const counts = Array.from(new Set(records.map(record => answer(record, "program")).filter(Boolean))).map(program => ({ program, count: records.filter(record => answer(record, "program") === program).length })).sort((a, b) => b.count - a.count);
  const exportCsv = () => {
    const cell = (value: string) => `"${((/^[=+\-@]/.test(value) ? "'" : "") + value).replaceAll('"', '""')}"`;
    const lines = [["Child", "Guardian", "Program", "Submitted", "Jurisdiction"], ...records.map(record => [childName(record), primaryGuardian(record), answer(record, "program"), record.submitted_at || "", `${record.region}, ${record.country}`])].map(row => row.map(cell).join(","));
    const url = URL.createObjectURL(new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "submitted-registrations.csv"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="portal-page"><Heading eyebrow="CHILD CARE ADMIN" title="Reports" description="Summaries of submitted registration records for this business." action={<Button variant="outline" disabled={!records.length || !!error || loading} onClick={exportCsv}><Download/> Export CSV</Button>}/>
    {error ? <ErrorState message={error}/> : loading ? <Empty>Loading report…</Empty> : <><Summary items={[{ label: "Submitted forms", value: records.length }, { label: "Programs requested", value: counts.length }, { label: "Most recent form", value: dateLabel(records[0]?.submitted_at) }]}/><section className="panel portal-report-panel"><h2>Registration requests by program</h2>{counts.length ? counts.map(row => <div className="portal-report-row" key={row.program}><span>{row.program}</span><div><i style={{ width: `${Math.max(7, 100 * row.count / records.length)}%` }}/></div><strong>{row.count}</strong></div>) : <p>No submitted registrations to report yet.</p>}<p className="portal-muted">This report uses forms submitted in the current single-business demo. It does not include draft forms.</p></section></>}
  </div>;
}

function GuardianDocuments({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { records, loading, error } = useEnrollments("mine");
  const [selected, setSelected] = useState<string | null>(null);
  const [fileState, setFileState] = useState<{ forId: string; attachments: { id: string; field_id: string; filename: string; size: number }[]; error: string }>({ forId: "", attachments: [], error: "" });
  const attachments = fileState.forId === selected ? fileState.attachments : [];
  const fileError = fileState.forId === selected ? fileState.error : "";
  const filesLoading = !!selected && fileState.forId !== selected;
  useEffect(() => {
    if (!selected) return;
    let active = true;
    fetch(`/api/enrollment-attachments?submissionId=${encodeURIComponent(selected)}`, { cache: "no-store" }).then(readJSON)
      .then(data => { if (active) setFileState({ forId: selected, attachments: data.attachments || [], error: "" }); })
      .catch(e => { if (active) setFileState({ forId: selected, attachments: [], error: e.message }); });
    return () => { active = false; };
  }, [selected]);
  const record = records.find(item => item.id === selected);
  return <div className="portal-page"><Heading eyebrow="GUARDIAN PORTAL" title="Documents" description="View files you uploaded with a child registration form." action={<Button variant="outline" onClick={() => onNavigate("Child profiles")}>Open registration form <ArrowRight/></Button>}/>
    {error ? <ErrorState message={error}/> : loading ? <Empty>Loading documents…</Empty> : <div className="portal-two-column"><section className="panel portal-list-panel"><h2>Your registration records</h2>{records.length ? records.map(item => <button type="button" className={`portal-list-row ${selected === item.id ? "selected" : ""}`} key={item.id} onClick={() => setSelected(item.id)}><span><strong>{childName(item)}</strong><small>{item.status === "draft" ? "Draft" : "Submitted"} · Updated {dateLabel(item.updated_at)}</small></span><ArrowRight/></button>) : <div className="portal-list-empty">No registration records yet. Start a child profile to upload documents.</div>}</section><section className="panel portal-detail-panel"><h2>{record ? `Files for ${childName(record)}` : "Select a registration"}</h2>{record ? fileError ? <ErrorState message={fileError}/> : filesLoading ? <p>Loading files…</p> : attachments.length ? attachments.map(file => <a className="portal-document-row" href={`/api/enrollment-attachments?id=${encodeURIComponent(file.id)}`} target="_blank" rel="noreferrer" key={file.id}><FileText/><span><strong>{file.filename}</strong><small>{record.labels?.[file.field_id] || "Registration document"} · {(file.size / 1024).toFixed(0)} KB</small></span><Download/></a>) : <p>No files were uploaded for this registration.</p> : <p>Choose a draft or submitted form to see its documents.</p>}</section></div>}
  </div>;
}

function GuardianContacts({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { records, loading, error } = useEnrollments("mine");
  const [selected, setSelected] = useState<string | null>(null);
  const record = records.find(item => item.id === selected) || records[0];
  return <div className="portal-page"><Heading eyebrow="GUARDIAN PORTAL" title="Emergency contacts" description="Review the people and pickup instructions included in your most recent registration." action={<Button variant="outline" onClick={() => onNavigate("Child profiles")}>Open registration form <ArrowRight/></Button>}/>
    {error ? <ErrorState message={error}/> : loading ? <Empty>Loading contacts…</Empty> : records.length ? <><label className="portal-record-choice">Registration for <select value={record.id} onChange={e => setSelected(e.target.value)}>{records.map(item => <option key={item.id} value={item.id}>{childName(item)} · {item.status}</option>)}</select></label><div className="portal-card-grid"><section className="panel portal-detail-panel"><PersonList title="Parents and guardians" entries={people(record, "guardians")}/></section><section className="panel portal-detail-panel"><PersonList title="Emergency contacts" entries={people(record, "emergency_contacts")}/></section><section className="panel portal-detail-panel"><PersonList title="Authorized pickup" entries={people(record, "pickup_people")}/><h3>Pickup restrictions</h3><p>{answer(record, "pickup_restrictions") || "None listed"}</p></section></div><p className="portal-muted">Showing the details saved with this {record.status} registration. Contact your provider directly about urgent changes.</p></> : <Empty>No contacts yet. Add guardians and emergency contacts in the child registration form.</Empty>}
  </div>;
}

function GuardianMessages({ onNavigate }: { onNavigate: (section: string) => void }) {
  const [filter, setFilter] = useState("All");
  return <div className="portal-page"><Heading eyebrow="GUARDIAN PORTAL" title="Messages" description="The place for program notices and replies when messaging is enabled for your provider."/><div className="portal-filter-tabs">{["All", "Unread", "Program updates"].map(item => <button type="button" className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div><Empty><div className="portal-empty-icon"><FileText/></div><h2>No {filter === "All" ? "messages" : filter.toLowerCase()} yet</h2><p>Messages from your child care program will appear here when the provider enables messaging. For urgent care or pickup changes, call the program directly.</p><Button variant="outline" onClick={() => onNavigate("Emergency contacts")}>Review emergency contacts <ArrowRight/></Button></Empty></div>;
}

function StaffDirectory() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(sampleChildren[0].name);
  const rows = sampleChildren.filter(child => `${child.name} ${child.program}`.toLowerCase().includes(query.toLowerCase()));
  const child = sampleChildren.find(item => item.name === selected)!;
  return <div className="portal-page"><Heading eyebrow="TEACHING STAFF · VIEW ONLY" title="Child directory" description="Find the safety details for a child in your assigned room."/><SampleNote/><div className="portal-two-column"><section className="panel portal-list-panel"><div className="portal-panel-head"><h2>Example children</h2><SearchField value={query} onChange={setQuery} label="Search child or room"/></div>{rows.map(item => <button type="button" className={`portal-list-row ${selected === item.name ? "selected" : ""}`} key={item.name} onClick={() => setSelected(item.name)}><span><strong>{item.name}</strong><small>{item.program} · {item.alert}</small></span><ArrowRight/></button>)}{!rows.length && <div className="portal-list-empty">No matching children.</div>}</section><section className="panel portal-detail-panel"><Badge variant="outline">Example child</Badge><h2>{child.name}</h2><p>{child.program} · {child.status}</p><div className="portal-safety-grid"><div><strong>Safety alert</strong><p>{child.alert}</p></div><div><strong>Care note</strong><p>{child.care}</p></div><div><strong>Guardian</strong><p>{child.guardian}</p></div></div><p className="portal-muted">Verify identity and use the current approved record before acting on an emergency or pickup request.</p></section></div></div>;
}

function StaffSafety({ kind }: { kind: "diet" | "medical" | "emergency" }) {
  const [query, setQuery] = useState("");
  const filtered = sampleChildren.filter(child => `${child.name} ${child.program} ${child.alert}`.toLowerCase().includes(query.toLowerCase()));
  const meta = kind === "diet" ? { title: "Dietary & allergies", intro: "Quickly check food alerts before meals and snacks.", icon: <Baby/> } : kind === "medical" ? { title: "Medical needs", intro: "Review care plans, medication prompts, and conditions for your room.", icon: <HeartPulse/> } : { title: "Emergency cards", intro: "Read essential safety details and prepare a printable room reference.", icon: <FileHeart/> };
  return <div className="portal-page"><Heading eyebrow="TEACHING STAFF · VIEW ONLY" title={meta.title} description={meta.intro} action={kind === "emergency" && <Button variant="outline" onClick={() => window.print()}><FileText/> Print example cards</Button>}/><SampleNote/><div className="portal-panel-head"><div className="portal-inline-icon">{meta.icon}<span>{kind === "diet" ? "Food service checks" : kind === "medical" ? "Care plan overview" : "Room safety cards"}</span></div><SearchField value={query} onChange={setQuery} label="Search child, room or alert"/></div><div className="portal-card-grid portal-print-examples">{filtered.map(child => <article className="panel portal-safety-card" key={child.name}><div><h2>{child.name}</h2><Badge variant="outline">{child.program}</Badge></div><p><strong>{kind === "diet" ? "Food and allergy alert" : kind === "medical" ? "Medical alert" : "Safety alert"}</strong><span>{child.alert}</span></p><p><strong>{kind === "emergency" ? "Current instruction" : "Care note"}</strong><span>{child.care}</span></p>{kind === "emergency" && <p><strong>Guardian</strong><span>{child.guardian}</span></p>}</article>)}{!filtered.length && <Empty>No example children match your search.</Empty>}</div><p className="portal-muted">These examples are not a live medical record. Confirm current plans and permissions with the provider.</p></div>;
}

const exampleOrganizations = [
  { name: "Little Sprouts Early Learning", plan: "Growth", children: 84, billing: "Paid", locations: 1 },
  { name: "Maple Tree Child Care", plan: "Annual", children: 126, billing: "Paid", locations: 2 },
  { name: "Bright Start Academy", plan: "Growth", children: 52, billing: "Past due", locations: 1 },
  { name: "Tiny Trails Montessori", plan: "Starter", children: 38, billing: "Trial", locations: 1 },
];

function OwnerOrganizations() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(exampleOrganizations[0].name);
  const rows = exampleOrganizations.filter(item => item.name.toLowerCase().includes(query.toLowerCase()));
  const org = exampleOrganizations.find(item => item.name === selected)!;
  return <div className="portal-page"><Heading eyebrow="PLATFORM OWNER" title="Organizations" description="Inspect business subscriptions and usage across organizations."/><SampleNote/><Summary items={[{ label: "Example organizations", value: exampleOrganizations.length }, { label: "Example locations", value: exampleOrganizations.reduce((sum, item) => sum + item.locations, 0) }, { label: "Example child profiles", value: exampleOrganizations.reduce((sum, item) => sum + item.children, 0) }]}/><div className="portal-two-column"><section className="panel portal-list-panel"><div className="portal-panel-head"><h2>Business directory</h2><SearchField value={query} onChange={setQuery} label="Search organizations"/></div>{rows.map(item => <button type="button" className={`portal-list-row ${selected === item.name ? "selected" : ""}`} key={item.name} onClick={() => setSelected(item.name)}><span><strong>{item.name}</strong><small>{item.plan} · {item.children} children</small></span><Badge variant="outline">{item.billing}</Badge></button>)}{!rows.length && <div className="portal-list-empty">No example organizations match.</div>}</section><section className="panel portal-detail-panel"><Badge variant="outline">Example organization</Badge><h2>{org.name}</h2><p>{org.plan} plan · {org.billing}</p><div className="portal-detail-grid"><div><span>Children</span><strong>{org.children}</strong></div><div><span>Locations</span><strong>{org.locations}</strong></div></div><p className="portal-muted">Organization creation, invitations, and billing are not connected to this demo directory.</p></section></div></div>;
}

function OwnerSubscriptions() {
  const plans = [
    { name: "Starter", detail: "One centre · core registrations", price: "Example plan" },
    { name: "Growth", detail: "Multiple programs · scheduling", price: "Example plan" },
    { name: "Annual", detail: "Annual contract · organization support", price: "Example plan" },
  ];
  return <div className="portal-page"><Heading eyebrow="PLATFORM OWNER" title="Subscriptions" description="Review example account plans and billing states."/><SampleNote/><Summary items={[{ label: "Example paid accounts", value: 2 }, { label: "Example trial accounts", value: 1 }, { label: "Example past due", value: 1 }]}/><div className="portal-card-grid">{plans.map(plan => <section className="panel portal-info-card" key={plan.name}><Badge variant="outline">{plan.price}</Badge><h2>{plan.name}</h2><p>{plan.detail}</p></section>)}</div><section className="panel portal-list-panel portal-full-width"><h2>Account billing examples</h2>{exampleOrganizations.map(org => <div className="portal-list-row static" key={org.name}><span><strong>{org.name}</strong><small>{org.plan} plan</small></span><Badge variant="outline">{org.billing}</Badge></div>)}</section><p className="portal-muted">No payment processor is connected. These are interface examples, not invoices or live account charges.</p></div>;
}

function OwnerSupport() {
  const tickets = [
    { id: "SUP-104", title: "Guardian upload guidance", org: "Little Sprouts Early Learning", status: "Open", priority: "Normal", detail: "A provider asks how to help a guardian replace a draft document." },
    { id: "SUP-105", title: "Program group setup", org: "Maple Tree Child Care", status: "In review", priority: "Normal", detail: "The administrator wants to distinguish named rooms within an age range." },
    { id: "SUP-106", title: "Billing question", org: "Bright Start Academy", status: "Resolved", priority: "Low", detail: "An example subscription question has been closed." },
  ];
  const [filter, setFilter] = useState("All"), [selected, setSelected] = useState(tickets[0].id);
  const ticket = tickets.find(item => item.id === selected)!;
  return <div className="portal-page"><Heading eyebrow="PLATFORM OWNER" title="Support" description="Triage organization requests and see their context."/><SampleNote/><div className="portal-filter-tabs">{["All", "Open", "In review", "Resolved"].map(value => <button type="button" className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{value}</button>)}</div><div className="portal-two-column"><section className="panel portal-list-panel">{tickets.filter(item => filter === "All" || item.status === filter).map(item => <button type="button" className={`portal-list-row ${selected === item.id ? "selected" : ""}`} key={item.id} onClick={() => setSelected(item.id)}><span><strong>{item.title}</strong><small>{item.id} · {item.org}</small></span><Badge variant="outline">{item.status}</Badge></button>)}</section><section className="panel portal-detail-panel"><Badge variant="outline">Example ticket</Badge><h2>{ticket.title}</h2><p>{ticket.id} · {ticket.org}</p><div className="portal-detail-grid"><div><span>Status</span><strong>{ticket.status}</strong></div><div><span>Priority</span><strong>{ticket.priority}</strong></div></div><h3>Request</h3><p>{ticket.detail}</p><p className="portal-muted">Support requests and replies are not sent from this demo.</p></section></div></div>;
}

function OwnerConnections() {
  const connections = [
    { name: "Registration database", detail: "Published form versions, submitted answers, and scheduling entries", state: "Configured in this site" },
    { name: "Document storage", detail: "Guardian PDF and image attachments", state: "Configured in this site" },
    { name: "Email invitations", detail: "Provider-to-guardian invitation delivery", state: "Not connected" },
    { name: "Payment provider", detail: "Subscriptions and automated billing", state: "Not connected" },
  ];
  return <div className="portal-page"><Heading eyebrow="PLATFORM OWNER" title="Data connections" description="See which capabilities are configured and which still need an external service."/><div className="portal-card-grid">{connections.map(connection => <section className="panel portal-info-card" key={connection.name}><Badge variant="outline">{connection.state}</Badge><h2>{connection.name}</h2><p>{connection.detail}</p></section>)}</div><p className="portal-muted">Configuration is described here; this page is not a live service health monitor.</p></div>;
}

function OwnerAudit() {
  const roles = [
    { role: "Super Admin", permission: "Publish form questions and review all registrations" },
    { role: "Business Admin", permission: "Set provider location, manage scheduling, review submitted forms" },
    { role: "Guardian", permission: "Complete personal registration and see own documents" },
    { role: "Teaching Staff", permission: "Read room safety information in the staff demo" },
  ];
  return <div className="portal-page"><Heading eyebrow="PLATFORM OWNER" title="Audit & security" description="Review role boundaries and what information each portal can access."/><div className="portal-card-grid">{roles.map(item => <section className="panel portal-info-card" key={item.role}><ShieldCheck/><h2>{item.role}</h2><p>{item.permission}</p></section>)}</div><section className="panel portal-info-card portal-full-width"><h2>Activity log</h2><p>No live audit feed is connected to this demonstration. Form versions and saved schedule entries retain author and update timestamps in the database.</p></section></div>;
}

function HelpSupport({ role, onNavigate }: { role: Role; onNavigate: (section: string) => void }) {
  const topics = [
    { title: "Prepare the Admin first page", text: "In Registration Form Setup, configure a classroom, enter the prime guardian and child, then reserve care sections across four weeks. Open an email draft or copy the guardian link after saving.", target: role === "business" ? "Registration Form Setup" : "Help & support" },
    { title: "Complete a guardian registration", text: "Open Child profiles, fill each section, save a draft if needed, and submit when required answers are complete.", target: role === "guardian" ? "Child profiles" : role === "business" ? "Registration Form Setup" : role === "owner" ? "Enrollment form" : "Help & support" },
    { title: "Review documents", text: "Guardians can see files uploaded with their own registrations. Administrators can open documents on submitted records.", target: role === "guardian" ? "Documents" : role === "business" ? "Registrations" : role === "owner" ? "Enrollment form" : "Help & support" },
    { title: "Set the provider location", text: "The business administrator selects a Canadian province or territory or a U.S. state or territory. Guardians see it locked.", target: role === "business" ? "Centre settings" : "Help & support" },
    { title: "Plan a schedule", text: "In the Admin portal, add dated care, staff, transition, and reminder entries to the weekly calendar.", target: role === "business" ? "Scheduling" : "Help & support" },
  ];
  const [query, setQuery] = useState("");
  const visible = topics.filter(item => `${item.title} ${item.text}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="portal-page"><Heading eyebrow="HELP & SUPPORT" title="How can we help?" description="Quick guidance for the registration portals."/><SearchField value={query} onChange={setQuery} label="Search help topics"/><div className="portal-card-grid">{visible.map(topic => <section className="panel portal-info-card" key={topic.title}><h2>{topic.title}</h2><p>{topic.text}</p>{topic.target !== "Help & support" && <Button variant="outline" size="sm" onClick={() => onNavigate(topic.target)}>Open section <ArrowRight/></Button>}</section>)}</div>{!visible.length && <Empty>No help topics match that search.</Empty>}</div>;
}

const portalStartOptions: Record<Role, string[]> = {
    business: ["Overview", "Registrations", "Children & guardians", "Programs & transitions", "Scheduling", "Emergency cards", "Staff access", "Registration Form Setup", "Centre settings", "Reports"],
    guardian: ["My family", "Child profiles", "Documents", "Emergency contacts", "Messages"],
    staff: ["Room overview", "Child directory", "Dietary & allergies", "Medical needs", "Emergency cards"],
    owner: ["Platform overview", "Organizations", "Enrollment form", "Subscriptions", "Support", "Data connections", "Audit & security"],
};
function PortalSettings({ role, onNavigate }: { role: Role; onNavigate: (section: string) => void }) {
  const options = portalStartOptions;
  const [start, setStart] = useState(options[role][0]);
  const [saved, setSaved] = useState(false);
  // Synchronize this setting from device storage when the portal changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const stored = localStorage.getItem(`ccr-start-${role}`); if (stored && portalStartOptions[role].includes(stored)) setStart(stored); }, [role]);
  const save = () => { localStorage.setItem(`ccr-start-${role}`, start); setSaved(true); };
  return <div className="portal-page"><Heading eyebrow="PORTAL SETTINGS" title="Settings" description="Choose how this portal opens on this device and review your access."/><div className="portal-card-grid"><section className="panel portal-info-card"><h2>Start page</h2><p>Choose the first section shown when you switch to the {role === "business" ? "Admin" : role === "owner" ? "Owner" : role === "staff" ? "Staff" : "Guardian"} portal on this device.</p><label className="portal-setting-label">Open on<select value={start} onChange={e => { setStart(e.target.value); setSaved(false); }}>{options[role].map(option => <option key={option}>{option}</option>)}</select></label><Button onClick={save}>Save start page</Button>{saved && <p role="status" className="portal-saved"><CheckCircle2/> Saved on this device.</p>}</section><section className="panel portal-info-card"><h2>Access and location</h2><p>Your signed-in account determines which data and settings you may change. Switching demo tabs does not change your account permissions.</p>{role === "business" && <Button variant="outline" onClick={() => onNavigate("Centre settings")}>Provider location <ArrowRight/></Button>}{role === "guardian" && <Button variant="outline" onClick={() => onNavigate("Child profiles")}>Your registration <ArrowRight/></Button>}</section></div></div>;
}

export function PortalSection({ role, section, onNavigate }: Props) {
  if (section === "Help & support") return <HelpSupport role={role} onNavigate={onNavigate}/>;
  if (section === "Settings") return <PortalSettings role={role} onNavigate={onNavigate}/>;
  if (role === "business") {
    if (section === "Registrations") return <BusinessRegistrations onNavigate={onNavigate}/>;
    if (section === "Programs & transitions") return <ProgramsAndTransitions onNavigate={onNavigate}/>;
    if (section === "Emergency cards") return <BusinessEmergencyCards/>;
    if (section === "Staff access") return <StaffAccess/>;
    if (section === "Reports") return <BusinessReports/>;
  }
  if (role === "guardian") {
    if (section === "Documents") return <GuardianDocuments onNavigate={onNavigate}/>;
    if (section === "Emergency contacts") return <GuardianContacts onNavigate={onNavigate}/>;
    if (section === "Messages") return <GuardianMessages onNavigate={onNavigate}/>;
  }
  if (role === "staff") {
    if (section === "Child directory") return <StaffDirectory/>;
    if (section === "Dietary & allergies") return <StaffSafety kind="diet"/>;
    if (section === "Medical needs") return <StaffSafety kind="medical"/>;
    if (section === "Emergency cards") return <StaffSafety kind="emergency"/>;
  }
  if (role === "owner") {
    if (section === "Organizations") return <OwnerOrganizations/>;
    if (section === "Subscriptions") return <OwnerSubscriptions/>;
    if (section === "Support") return <OwnerSupport/>;
    if (section === "Data connections") return <OwnerConnections/>;
    if (section === "Audit & security") return <OwnerAudit/>;
  }
  return <Empty>Choose a section from the navigation.</Empty>;
}
