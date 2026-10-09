"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ageGroups, type ProgramRoom } from "@/lib/registration-intake";

type GroupDraft = Omit<ProgramRoom, "id">;
const newGroup = (): GroupDraft => ({ name: "", ageGroup: "Preschool", capacity: 10, beforeCapacity: 0, afterCapacity: 0 });

export function ProgramGroupManager({ open, onOpenChange, onOpenRegistration }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenRegistration: () => void;
}) {
  const [rooms, setRooms] = useState<ProgramRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<GroupDraft>(newGroup);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/program-rooms", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const result = await response.json() as { rooms?: ProgramRoom[]; error?: string };
        if (!response.ok) throw new Error(result.error || "Could not load program groups.");
        return result.rooms || [];
      })
      .then(result => { setRooms(result); setError(""); })
      .catch(cause => { if (!controller.signal.aborted) setError((cause as Error).message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.name.trim() || !Number.isInteger(draft.capacity) || draft.capacity < 1 || draft.capacity > 300 ||
        !Number.isInteger(draft.beforeCapacity) || !Number.isInteger(draft.afterCapacity) ||
        draft.beforeCapacity < 0 || draft.afterCapacity < 0 || draft.beforeCapacity > draft.capacity || draft.afterCapacity > draft.capacity) {
      toast.error("Enter a name and 1–300 day spaces. Before and after spaces cannot exceed day capacity.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/program-rooms", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, name: draft.name.trim() }),
      });
      const result = await response.json() as { room?: ProgramRoom; error?: string };
      if (!response.ok || !result.room) throw new Error(result.error || "Could not add the program group.");
      setRooms(current => [...current, result.room!].sort((a, b) => a.ageGroup.localeCompare(b.ageGroup) || a.name.localeCompare(b.name)));
      setDraft(newGroup()); setError(""); onOpenChange(false);
      toast.success(`${result.room.name} added. Its spaces are ready for registration scheduling.`);
    } catch (cause) { toast.error((cause as Error).message); }
    finally { setSaving(false); }
  };

  return <section className="panel program-groups-panel">
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="program-group-dialog">
        <DialogHeader><DialogTitle>Add a Program Group</DialogTitle><DialogDescription>Name a classroom or group and set its available space sections. Full Day uses one morning and one afternoon space; Before School and After School have their own limits.</DialogDescription></DialogHeader>
        <form onSubmit={save} className="program-group-form">
          <label>Program Group / Classroom Name<Input autoFocus required maxLength={100} placeholder="e.g. Preschool A" value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}/></label>
          <label>Program Age Group<select value={draft.ageGroup} onChange={event => setDraft(current => ({ ...current, ageGroup: event.target.value }))}>{ageGroups.map(group => <option key={group} value={group}>{group}</option>)}</select></label>
          <label>Full Day spaces<Input required type="number" min={1} max={300} step={1} value={draft.capacity} onChange={event => setDraft(current => ({ ...current, capacity: Number(event.target.value) }))}/></label>
          <label>Before School spaces (0 if not offered)<Input required type="number" min={0} max={draft.capacity} step={1} value={draft.beforeCapacity} onChange={event => setDraft(current => ({ ...current, beforeCapacity: Number(event.target.value) }))}/></label>
          <label>After School spaces (0 if not offered)<Input required type="number" min={0} max={draft.capacity} step={1} value={draft.afterCapacity} onChange={event => setDraft(current => ({ ...current, afterCapacity: Number(event.target.value) }))}/></label>
          <p>Each day space can be reserved as a Full Day or separately as Morning and Afternoon. School care is reserved in separate Before and After sections.</p>
          <div className="program-group-actions"><Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Adding…" : "Add Program Group"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
    <div className="panel-head"><div><h2>Your Program Groups</h2><p>Saved classrooms and their space sections, ready for child registration.</p></div><Button size="sm" onClick={() => onOpenChange(true)}><Plus/> Add a Program Group</Button></div>
    {loading ? <p className="program-groups-message">Loading saved groups…</p> : error ? <p role="alert" className="program-groups-error">{error}</p> : rooms.length ? <>
      <div className="program-groups-list">{rooms.map(room => <div className="program-group-card" key={room.id}><strong>{room.name}</strong><span>{room.ageGroup}</span><small>{room.capacity} Day · {room.capacity} Morning · {room.capacity} Afternoon{room.beforeCapacity ? ` · ${room.beforeCapacity} Before School` : ""}{room.afterCapacity ? ` · ${room.afterCapacity} After School` : ""}</small></div>)}</div>
      <div className="program-groups-foot"><span>{rooms.length} groups · {rooms.reduce((sum, room) => sum + room.capacity, 0)} full-day spaces</span><Button size="sm" variant="ghost" onClick={onOpenRegistration}>Set up registration schedules</Button></div>
    </> : <p className="program-groups-message">No program groups yet. Add one to set up its spaces for registration.</p>}
  </section>;
}
