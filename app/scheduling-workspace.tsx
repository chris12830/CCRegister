"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, addWeeks, format, startOfWeek } from "date-fns";
import { ArrowLeft, ArrowRight, CalendarDays, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type ScheduleItem = { id?: string; date: string; startTime: string; endTime: string; category: string; title: string; program: string; childName: string; notes: string; updatedAt?: string };
type CareBooking = { date: string; intakeId: string; childName: string; roomName: string; sections: string[] };
const newItem = (date: string): ScheduleItem => ({ date, startTime: "08:00", endTime: "17:00", category: "Child care", title: "", program: "", childName: "", notes: "" });
const parseResponse = async (response: Response) => {
  const result = await response.json() as { error?: string; items?: ScheduleItem[]; bookings?: CareBooking[] };
  if (!response.ok) throw new Error(result.error || "Please try again.");
  return result;
};

export function SchedulingWorkspace() {
  const [week, setWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [bookings, setBookings] = useState<CareBooking[]>([]);
  const [editor, setEditor] = useState<ScheduleItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(week, index)), [week]);
  const first = format(days[0], "yyyy-MM-dd"), last = format(days[6], "yyyy-MM-dd");
  const load = useCallback(async (isCurrent: () => boolean = () => true) => {
    const data = await parseResponse(await fetch(`/api/schedule?from=${first}&to=${last}`, { cache: "no-store" }));
    if (isCurrent()) { setItems(data.items || []); setBookings(data.bookings || []); setError(""); }
  }, [first, last]);
  // Loading and state updates occur after the asynchronous request.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { let current = true; load(() => current).catch(e => { if (current) setError(e.message); }).finally(() => { if (current) setLoading(false); }); return () => { current = false; }; }, [load]);
  const showWeek = (date: Date) => { if (format(date, "yyyy-MM-dd") !== first) setLoading(true); setWeek(date); };
  const save = async () => {
    if (!editor) return;
    if (!editor.title.trim() || editor.startTime >= editor.endTime) { toast.error("Add a title and choose an end time after the start time."); return; }
    setBusy(true);
    try {
      await parseResponse(await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editor) }));
      const savedDate = editor.date;
      setEditor(null);
      if (savedDate < first || savedDate > last) showWeek(startOfWeek(new Date(`${savedDate}T12:00:00`), { weekStartsOn: 1 }));
      else await load();
      toast.success("Schedule entry saved.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!editor?.id || !window.confirm(`Delete “${editor.title}” from the schedule?`)) return;
    setBusy(true);
    try {
      await parseResponse(await fetch("/api/schedule", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editor.id }) }));
      setEditor(null); await load(); toast.success("Schedule entry deleted.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  return <div className="portal-page schedule-page">
    <header className="portal-header"><div><p className="eyebrow">CHILD CARE ADMIN</p><h1>Scheduling</h1><p>Plan child care, transitions, staffing, and reminders by day.</p></div><Button onClick={() => setEditor(newItem(format(new Date(), "yyyy-MM-dd")))}><Plus/> Add schedule entry</Button></header>
    <div className="panel schedule-toolbar"><div className="schedule-week-nav"><Button size="sm" variant="outline" aria-label="Previous week" onClick={() => showWeek(addWeeks(week, -1))}><ArrowLeft/></Button><Button size="sm" variant="outline" onClick={() => showWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Today</Button><Button size="sm" variant="outline" aria-label="Next week" onClick={() => showWeek(addWeeks(week, 1))}><ArrowRight/></Button></div><strong>{format(days[0], "MMM d")} – {format(days[6], "MMM d, yyyy")}</strong><span>{bookings.length} care reservations · {items.length} other entries</span></div>
    {error && <div className="portal-error" role="alert">{error} <Button size="sm" variant="outline" onClick={() => { setLoading(true); load().catch(e => setError(e.message)).finally(() => setLoading(false)); }}>Try again</Button></div>}
    {loading ? <div className="panel portal-empty">Loading this week…</div> : !error && <div className="schedule-grid">{days.map(day => {
      const key = format(day, "yyyy-MM-dd"), dayItems = items.filter(item => item.date === key), dayBookings = bookings.filter(item => item.date === key);
      return <section className="schedule-day panel" key={key}><div className="schedule-day-head"><span>{format(day, "EEE")}</span><strong>{format(day, "d")}</strong><button type="button" onClick={() => setEditor(newItem(key))} aria-label={`Add entry on ${format(day, "MMMM d")}`}><Plus/></button></div>
        <div className="schedule-day-items">{dayBookings.map(booking => <div className="schedule-entry schedule-booking" key={booking.intakeId}><small>Reserved care · {booking.sections.includes("am") && booking.sections.includes("pm") ? "Day" : booking.sections.includes("am") ? "Morning" : booking.sections.includes("pm") ? "Afternoon" : "School care"}{booking.sections.includes("before") ? " + Before" : ""}{booking.sections.includes("after") ? " + After" : ""}</small><b>{booking.childName}</b><span>{booking.roomName}</span></div>)}{dayItems.map(item => <button type="button" className={`schedule-entry schedule-${item.category.toLowerCase().replace(/\s+/g, "-")}`} key={item.id} onClick={() => setEditor(item)}><small>{item.startTime}–{item.endTime}</small><b>{item.title}</b><span>{item.program || item.category}</span></button>)}{!dayItems.length && !dayBookings.length && <p>No entries</p>}</div>
      </section>;
    })}</div>}
    <div className="panel schedule-guidance"><CalendarDays/><p>Reserved care comes from Admin registration intake and uses classroom capacity. Choose a day to add another entry or select one of your own entries to edit it.</p></div>
    <Dialog open={!!editor} onOpenChange={open => { if (!open && !busy) setEditor(null); }}><DialogContent className="schedule-dialog"><DialogHeader><DialogTitle>{editor?.id ? "Edit schedule entry" : "Add schedule entry"}</DialogTitle><DialogDescription>Save a date and time for this child care business.</DialogDescription></DialogHeader>
      {editor && <div className="schedule-fields"><label><Label htmlFor="schedule-title">Title</Label><Input id="schedule-title" maxLength={120} value={editor.title} onChange={e => setEditor({ ...editor, title: e.target.value })} placeholder="e.g. Preschool A morning care"/></label>
        <label><Label htmlFor="schedule-category">Type</Label><select id="schedule-category" value={editor.category} onChange={e => setEditor({ ...editor, category: e.target.value })}>{["Child care", "Transition", "Staff", "Reminder"].map(value => <option key={value}>{value}</option>)}</select></label>
        <label><Label htmlFor="schedule-date">Date</Label><Input id="schedule-date" type="date" value={editor.date} onChange={e => setEditor({ ...editor, date: e.target.value })}/></label>
        <label><Label htmlFor="schedule-start">Start</Label><Input id="schedule-start" type="time" value={editor.startTime} onChange={e => setEditor({ ...editor, startTime: e.target.value })}/></label>
        <label><Label htmlFor="schedule-end">End</Label><Input id="schedule-end" type="time" value={editor.endTime} onChange={e => setEditor({ ...editor, endTime: e.target.value })}/></label>
        <label><Label htmlFor="schedule-program">Program or room</Label><Input id="schedule-program" maxLength={100} value={editor.program} onChange={e => setEditor({ ...editor, program: e.target.value })} placeholder="e.g. Toddler 1"/></label>
        <label className="wide"><Label htmlFor="schedule-child">Child or staff member (optional)</Label><Input id="schedule-child" maxLength={120} value={editor.childName} onChange={e => setEditor({ ...editor, childName: e.target.value })}/></label>
        <label className="wide"><Label htmlFor="schedule-notes">Notes</Label><Textarea id="schedule-notes" maxLength={500} rows={3} value={editor.notes} onChange={e => setEditor({ ...editor, notes: e.target.value })}/></label></div>}
      <div className="schedule-dialog-actions">{editor?.id && <Button variant="destructive" disabled={busy} onClick={remove}><Trash2/> Delete</Button>}<div><Button variant="outline" disabled={busy} onClick={() => setEditor(null)}>Cancel</Button><Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save entry"}</Button></div></div>
    </DialogContent></Dialog>
  </div>;
}
