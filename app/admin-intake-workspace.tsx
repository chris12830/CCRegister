"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ClipboardList, Copy, Mail, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ageGroups, addDate, careTypes, defaultCareHours, firstMonday, sectionsFor, type AvailabilityDay, type CareHours, type CarePeriod, type ProgramRoom, type RegistrationIntake, type ScheduleMode, type ScheduleSlot, validDate } from "@/lib/registration-intake";

type Availability = AvailabilityDay & { day: number };
type RoomDraft = { id?: string; name: string; ageGroup: string; capacity: number; beforeCapacity: number; afterCapacity: number };
const freshRoom = (): RoomDraft => ({ name: "", ageGroup: "Preschool", capacity: 10, beforeCapacity: 0, afterCapacity: 0 });
const today = () => format(new Date(), "yyyy-MM-dd");
const labelDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const requestJson = async <T,>(response: Response): Promise<T> => {
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error || "Please try again.");
  return result;
};
const intakeUrl = (id: string) => `${window.location.origin}/?portal=guardian&registration=${encodeURIComponent(id)}`;
const draftEmail = (intake: RegistrationIntake) => {
  const subject = "Complete your child care registration";
  const body = `Hello ${intake.guardianName},\n\nThe child care administrator has prepared the first page of ${intake.childFirst} ${intake.childLast}'s registration. Sign in with ${intake.guardianEmail} and complete the guardian sections here:\n${intakeUrl(intake.id)}\n\nIf the site is private, ask the provider for access before opening the link.`;
  window.location.href = `mailto:${intake.guardianEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

export function AdminIntakeWorkspace() {
  const [rooms, setRooms] = useState<ProgramRoom[]>([]);
  const [intakes, setIntakes] = useState<RegistrationIntake[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [availabilityKey, setAvailabilityKey] = useState("");
  const [availabilityRevision, setAvailabilityRevision] = useState(0);
  const [roomDraft, setRoomDraft] = useState<RoomDraft>(freshRoom);
  const [roomEditorOpen, setRoomEditorOpen] = useState(false);
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [childFirst, setChildFirst] = useState("");
  const [childLast, setChildLast] = useState("");
  const [childDob, setChildDob] = useState("");
  const [careType, setCareType] = useState<string>(careTypes[0]);
  const [ageGroup, setAgeGroup] = useState<string>(ageGroups[2]);
  const [roomId, setRoomId] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [mode, setMode] = useState<ScheduleMode>("days");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [standardBefore, setStandardBefore] = useState(false);
  const [standardAfter, setStandardAfter] = useState(false);
  const [custom, setCustom] = useState<Record<string, ScheduleSlot>>({});
  const [hours, setHours] = useState<CareHours>(defaultCareHours);
  const [prepared, setPrepared] = useState<RegistrationIntake | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const room = rooms.find(item => item.id === roomId && item.ageGroup === ageGroup);
  const weekStart = validDate(startDate) ? firstMonday(startDate) : "";
  const dates = useMemo(() => weekStart ? Array.from({ length: 28 }, (_, index) => addDate(weekStart, index)) : [], [weekStart]);
  const slots = useMemo(() => dates.map(date => {
    if (date < startDate) return null;
    if (mode === "custom") return custom[date] || null;
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (!weekdays.includes(weekday)) return null;
    return { date, care: (mode === "days" ? "day" : mode === "mornings" ? "morning" : "afternoon") as CarePeriod, before: !!room?.beforeCapacity && standardBefore, after: !!room?.afterCapacity && standardAfter };
  }).filter((slot): slot is ScheduleSlot => !!slot && sectionsFor(slot).length > 0), [dates, startDate, mode, custom, weekdays, room?.beforeCapacity, room?.afterCapacity, standardBefore, standardAfter]);
  const availabilityByDate = new Map((availabilityKey === `${roomId}/${weekStart}` ? availability : []).map(item => [item.date, item]));

  const refresh = async () => {
    const [roomData, intakeData] = await Promise.all([
      requestJson<{ rooms: ProgramRoom[] }>(await fetch("/api/program-rooms", { cache: "no-store" })),
      requestJson<{ intakes: RegistrationIntake[] }>(await fetch("/api/registration-intakes?scope=business", { cache: "no-store" })),
    ]);
    setRooms(roomData.rooms); setIntakes(intakeData.intakes); setError("");
  };
  // The state updates happen only after the asynchronous fetch completes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh().catch(e => setError(e.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (!roomId || !weekStart) return;
    let active = true;
    fetch(`/api/registration-intakes?scope=business&roomId=${encodeURIComponent(roomId)}&weekStart=${weekStart}`, { cache: "no-store" })
      .then(response => requestJson<{ availability: Availability[] }>(response))
      .then(result => { if (active) { setAvailability(result.availability || []); setAvailabilityKey(`${roomId}/${weekStart}`); } })
      .catch(e => { if (active) { setAvailabilityKey(""); setError(e.message); } });
    return () => { active = false; };
  }, [roomId, weekStart, availabilityRevision]);
  const chooseMode = (next: ScheduleMode) => {
    if (next === "custom" && mode !== "custom") setCustom(Object.fromEntries(slots.map(slot => [slot.date, slot])));
    setMode(next);
  };
  const changeCustom = (date: string, changes: Partial<ScheduleSlot>) => setCustom(current => ({ ...current, [date]: { date, care: changes.care ?? current[date]?.care ?? "none", before: changes.before ?? current[date]?.before ?? false, after: changes.after ?? current[date]?.after ?? false } }));
  const saveRoom = async () => {
    setBusy(true);
    try {
      const result = await requestJson<{ room: ProgramRoom }>(await fetch("/api/program-rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(roomDraft) }));
      await refresh(); setAgeGroup(result.room.ageGroup); setRoomId(result.room.id); setRoomDraft(freshRoom()); setRoomEditorOpen(false); setAvailabilityRevision(value => value + 1); toast.success("Classroom and space sections saved.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const saveIntake = async () => {
    if (!room || !guardianName.trim() || !guardianEmail.trim() || !guardianPhone.trim() || !childFirst.trim() || !childLast.trim() || !childDob || !slots.length) { toast.error("Complete the guardian, child, classroom, and schedule fields."); return; }
    setBusy(true);
    try {
      const result = await requestJson<{ intake: RegistrationIntake }>(await fetch("/api/registration-intakes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guardianName, guardianEmail, guardianPhone, childFirst, childLast, childDob, careType, ageGroup, roomId, startDate, weekStart, mode, slots, hours }) }));
      setPrepared(result.intake); setGuardianName(""); setGuardianEmail(""); setGuardianPhone(""); setChildFirst(""); setChildLast(""); setChildDob("");
      await refresh(); setAvailabilityKey(""); setAvailabilityRevision(value => value + 1); toast.success("Admin first page saved and space sections reserved.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const cancel = async (intake: RegistrationIntake) => {
    if (!window.confirm(`Cancel the intake for ${intake.childFirst} ${intake.childLast} and release its spaces?`)) return;
    setBusy(true);
    try {
      await requestJson(await fetch("/api/registration-intakes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: intake.id }) }));
      await refresh(); setAvailabilityKey(""); setAvailabilityRevision(value => value + 1); if (prepared?.id === intake.id) setPrepared(null); toast.success("Intake cancelled and its space sections released.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const copyLink = async (intake: RegistrationIntake) => {
    try { await navigator.clipboard.writeText(intakeUrl(intake.id)); toast.success("Guardian link copied."); }
    catch { toast.error("Could not copy the link. Open an email draft instead."); }
  };
  const activeIntakes = intakes.filter(item => item.status !== "cancelled");
  return <div className="portal-page intake-page">
    <header className="portal-header"><div><p className="eyebrow">ADMIN · FIRST PAGE</p><h1>Prepare a child registration</h1><p>Enter the placement details and reserve each requested space section before the guardian completes the form.</p></div></header>
    {error && <div className="portal-error" role="alert">{error} <Button size="sm" variant="outline" onClick={() => { setLoading(true); refresh().catch(e => setError(e.message)).finally(() => setLoading(false)); }}>Try again</Button></div>}
    {loading ? <div className="panel portal-empty">Loading classrooms and registrations…</div> : <>
      <section className="panel intake-panel"><div className="portal-panel-head"><div><h2>1. Classroom and available spaces</h2><p>Each classroom has numbered spaces. A Day uses Morning and Afternoon on the same space; Before School and After School are separate sections when offered.</p></div></div>
        <div className="intake-room-list">{rooms.length ? rooms.map(item => <button type="button" key={item.id} className={roomId === item.id ? "selected" : ""} onClick={() => { setAgeGroup(item.ageGroup); setRoomId(item.id); }}><strong>{item.name}</strong><small>{item.ageGroup} · {item.capacity} day spaces · Before {item.beforeCapacity} · After {item.afterCapacity}</small></button>) : <p>No classrooms configured. Add a classroom to start a registration.</p>}</div>
        <details className="intake-room-editor" open={roomEditorOpen} onToggle={e => setRoomEditorOpen(e.currentTarget.open)}><summary>{roomDraft.id ? "Edit classroom space sections" : "Add a classroom and its space sections"}</summary><div className="intake-fields">
          <label>Classroom name<Input value={roomDraft.name} maxLength={100} onChange={e => setRoomDraft({ ...roomDraft, name: e.target.value })}/></label>
          <label>Program age group<select value={roomDraft.ageGroup} onChange={e => setRoomDraft({ ...roomDraft, ageGroup: e.target.value })}>{ageGroups.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Day spaces (each contains AM + PM)<Input type="number" min={1} max={300} value={roomDraft.capacity} onChange={e => setRoomDraft({ ...roomDraft, capacity: Number(e.target.value) })}/></label>
          <label>Before School spaces (0 if not offered)<Input type="number" min={0} max={roomDraft.capacity} value={roomDraft.beforeCapacity} onChange={e => setRoomDraft({ ...roomDraft, beforeCapacity: Number(e.target.value) })}/></label>
          <label>After School spaces (0 if not offered)<Input type="number" min={0} max={roomDraft.capacity} value={roomDraft.afterCapacity} onChange={e => setRoomDraft({ ...roomDraft, afterCapacity: Number(e.target.value) })}/></label>
        </div><div className="intake-actions"><Button disabled={busy} onClick={saveRoom}><Plus/> {roomDraft.id ? "Save classroom" : "Add classroom"}</Button>{roomDraft.id && <Button variant="outline" onClick={() => setRoomDraft(freshRoom())}>Cancel edit</Button>}</div></details>
        {room && <Button variant="ghost" size="sm" onClick={() => { setRoomDraft({ ...room }); setRoomEditorOpen(true); }}>Edit {room.name} capacity and offerings</Button>}
      </section>
      <section className="panel intake-panel"><h2>2. Prime guardian and child</h2><div className="intake-fields">
        <label>Prime Guardian Name<Input value={guardianName} maxLength={120} onChange={e => setGuardianName(e.target.value)}/></label>
        <label>Prime Guardian Email<Input type="email" value={guardianEmail} maxLength={254} onChange={e => setGuardianEmail(e.target.value)}/></label>
        <label>Prime Guardian Phone<Input type="tel" value={guardianPhone} maxLength={40} onChange={e => setGuardianPhone(e.target.value)}/></label>
        <label>Child first name<Input value={childFirst} maxLength={120} onChange={e => setChildFirst(e.target.value)}/></label>
        <label>Child last name<Input value={childLast} maxLength={120} onChange={e => setChildLast(e.target.value)}/></label>
        <label>Child date of birth<Input type="date" value={childDob} onChange={e => setChildDob(e.target.value)}/></label>
        <label>Type of Care Program<select value={careType} onChange={e => setCareType(e.target.value)}>{careTypes.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Program Age Group<select value={ageGroup} onChange={e => { setAgeGroup(e.target.value); setRoomId(""); }}>{ageGroups.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Assigned Classroom Name<Input value={room?.name || "Select a classroom above"} readOnly/></label>
        <label>Requested first day<Input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPrepared(null); }}/></label>
      </div></section>
      <section className="panel intake-panel"><div className="portal-panel-head"><div><h2>3. Select Program Schedule (Days-Mornings-Afternoons-Custom)</h2><p>Four weeks from {weekStart ? labelDate(weekStart) : "the selected start date"}. Select Days, Mornings, Afternoons, or a custom mix by date.</p></div><span className="intake-count">{slots.length} selected dates</span></div>
        <div className="intake-mode-tabs">{(["days", "mornings", "afternoons", "custom"] as ScheduleMode[]).map(value => <button key={value} type="button" className={mode === value ? "active" : ""} onClick={() => chooseMode(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
        {mode !== "custom" && <div className="intake-repeat"><span>Repeat on</span>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => <label key={day}><input type="checkbox" checked={weekdays.includes(index)} onChange={e => setWeekdays(current => e.target.checked ? [...current, index] : current.filter(value => value !== index))}/>{day}</label>)}</div>}
        {room && <div className="intake-extra">{room.beforeCapacity > 0 && mode !== "custom" && <label><input type="checkbox" checked={standardBefore} onChange={e => setStandardBefore(e.target.checked)}/> Before School ({room.beforeCapacity} spaces)</label>}{room.afterCapacity > 0 && mode !== "custom" && <label><input type="checkbox" checked={standardAfter} onChange={e => setStandardAfter(e.target.checked)}/> After School ({room.afterCapacity} spaces)</label>}</div>}
        <div className="intake-hours"><h3>Hours for each care section</h3><p>These times appear in the guardian&apos;s schedule. Space reservations are still counted by Day, AM, PM, Before and After sections.</p><div>{(["day", "morning", "afternoon", "before", "after"] as const).filter(section => section !== "before" || room?.beforeCapacity).filter(section => section !== "after" || room?.afterCapacity).map(section => <div key={section}><strong>{section === "before" ? "Before School" : section === "after" ? "After School" : section[0].toUpperCase() + section.slice(1)}</strong><label>From <Input type="time" value={hours[section].start} onChange={e => setHours(current => ({ ...current, [section]: { ...current[section], start: e.target.value } }))}/></label><label>To <Input type="time" value={hours[section].end} onChange={e => setHours(current => ({ ...current, [section]: { ...current[section], end: e.target.value } }))}/></label></div>)}</div></div>
        <p className="portal-muted">Remaining spaces below reflect saved reservations. Your new selections are checked again when you save. A full day needs one space with both AM and PM free.</p>
        {dates.length > 0 && <div className="intake-weeks">{[0, 1, 2, 3].map(week => <div className="intake-week" key={week}><h3>Week {week + 1} · {labelDate(dates[week * 7])}</h3><div className="intake-days">{dates.slice(week * 7, week * 7 + 7).map(date => {
          const selected = slots.find(item => item.date === date), free = availabilityByDate.get(date), inactive = date < startDate;
          const current = custom[date] || { date, care: "none" as CarePeriod, before: false, after: false };
          return <div className={`intake-day ${selected ? "selected" : ""} ${inactive ? "inactive" : ""}`} key={date}><strong>{labelDate(date)}</strong>{mode === "custom" && !inactive && room ? <><select aria-label={`Care period ${date}`} value={current.care} onChange={e => changeCustom(date, { care: e.target.value as CarePeriod })}><option value="none">No day care</option><option value="day">Day (AM + PM)</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option></select>{room.beforeCapacity > 0 && <label><input type="checkbox" checked={current.before} onChange={e => changeCustom(date, { before: e.target.checked })}/> Before</label>}{room.afterCapacity > 0 && <label><input type="checkbox" checked={current.after} onChange={e => changeCustom(date, { after: e.target.checked })}/> After</label>}</> : <span>{inactive ? "Before requested start" : selected ? [selected.care !== "none" ? selected.care : "", selected.before ? "Before" : "", selected.after ? "After" : ""].filter(Boolean).join(" + ") : "No care"}</span>}
            {free && <small>Open: Day {free.day} · AM {free.am} · PM {free.pm}{room?.beforeCapacity ? ` · Before ${free.before}` : ""}{room?.afterCapacity ? ` · After ${free.after}` : ""}</small>}</div>;
        })}</div></div>)}</div>}
        <div className="intake-actions"><Button disabled={busy || !room || !slots.length} onClick={saveIntake}><ClipboardList/> {busy ? "Saving…" : "Save Admin first page and reserve spaces"}</Button></div>
      </section>
      {prepared && <section className="panel intake-panel intake-ready" role="status"><Check/><div><h2>Guardian registration ready</h2><p>{prepared.childFirst} {prepared.childLast} · {prepared.guardianEmail}. The selected space sections are reserved. Open an email draft to send the guardian their link; email is not sent automatically.</p><div className="intake-actions"><Button onClick={() => draftEmail(prepared)}><Mail/> Open email draft</Button><Button variant="outline" onClick={() => copyLink(prepared)}><Copy/> Copy guardian link</Button></div></div></section>}
      <section className="panel intake-panel"><h2>Prepared registrations</h2><p className="portal-muted">Only the guardian signed in with the matching email can complete their assigned form. A prepared intake can be cancelled until the guardian saves a draft.</p>{activeIntakes.length ? activeIntakes.map(intake => <div className="intake-record" key={intake.id}><div><strong>{intake.childFirst} {intake.childLast}</strong><small>{intake.guardianName} · {intake.guardianEmail} · {intake.roomName} · {intake.slots.length} dates · {intake.status.replace("_", " ")}</small></div><div>{intake.status === "ready" && <><Button size="sm" variant="outline" onClick={() => draftEmail(intake)}><Mail/> Email draft</Button><Button size="sm" variant="outline" onClick={() => copyLink(intake)}><Copy/> Copy link</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => cancel(intake)}><Trash2/> Cancel</Button></>}{intake.status !== "ready" && <span>{intake.status === "submitted" ? "Guardian submitted" : "Guardian started"}</span>}</div></div>) : <p>No Admin first pages prepared yet.</p>}</section>
      <p className="portal-muted intake-boundary"><CalendarDays/> This site is currently private. Recipients need site access and must sign in with the email entered above. Sending the email draft requires your email application.</p>
    </>}
  </div>;
}
