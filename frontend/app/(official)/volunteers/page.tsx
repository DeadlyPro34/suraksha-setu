"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  assignVolunteer,
  acknowledgeDispatchCompletion,
  createVolunteerTask,
  getResponsePlans,
  getVolunteerTasks,
  getVolunteers,
  getVolunteerSafetyEvents,
  resolveVolunteerSafetyEvent,
} from "@/lib/api";
import { Dispatch, ResponsePlanSummary, User, VolunteerSafetyEvent } from "@/lib/types";

type Volunteer = Pick<User, "id" | "name" | "phone"> & { available: boolean; skills: string | null; languages: string | null; has_transport: boolean };

export default function VolunteersPage() {
  const [plans, setPlans] = useState<ResponsePlanSummary[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [tasks, setTasks] = useState<Dispatch[]>([]);
  const [safetyEvents, setSafetyEvents] = useState<VolunteerSafetyEvent[]>([]);
  const [planId, setPlanId] = useState("");
  const [message, setMessage] = useState("");
  const [headcount, setHeadcount] = useState(1);
  const [shiftStarts, setShiftStarts] = useState("");
  const [shiftEnds, setShiftEnds] = useState("");
  const [meetingPoint, setMeetingPoint] = useState("");
  const [selectedVolunteer, setSelectedVolunteer] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const knownCompleted = useRef<Set<string> | null>(null);
  const knownStatuses = useRef<Map<string, string> | null>(null);
  const knownSafetyEvents = useRef<Set<string> | null>(null);
  const knownAcknowledgements = useRef<Set<string> | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [planRows, volunteerRows, taskRows, safetyRows] = await Promise.all([
        getResponsePlans(), getVolunteers(), getVolunteerTasks(), getVolunteerSafetyEvents(),
      ]);
      setPlans(planRows);
      setVolunteers(volunteerRows);
      setTasks(taskRows.filter((task) => task.target_role === "volunteer"));
      setSafetyEvents(safetyRows);
      if (knownCompleted.current === null) {
        knownCompleted.current = new Set(taskRows.filter((task) => task.status === "completed").map((task) => task.id));
      }
      knownStatuses.current = new Map(taskRows.map((task) => [task.id, task.status]));
      knownAcknowledgements.current = new Set(taskRows.filter((task) => task.completion_acknowledged_at).map((task) => task.id));
      knownSafetyEvents.current = new Set(safetyRows.map((event) => event.id));
      setPlanId((current) => current || planRows.find((plan) => ["approved", "modified"].includes(plan.status))?.id || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load volunteer management data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);
    const timer = window.setInterval(() => {
      getVolunteerTasks()
        .then((rows) => {
          const volunteerTasks = rows.filter((task) => task.target_role === "volunteer");
          const currentCompleted = new Set(volunteerTasks.filter((task) => task.status === "completed").map((task) => task.id));
          const newlyCompleted = knownCompleted.current === null
            ? []
            : volunteerTasks.filter((task) => task.status === "completed" && !knownCompleted.current?.has(task.id));
          knownCompleted.current = currentCompleted;
          const needsHelp = volunteerTasks.filter((task) => task.status === "needs_help" && knownStatuses.current?.get(task.id) !== "needs_help");
          const newlyAcknowledged = volunteerTasks.filter((task) => task.completion_acknowledged_at && !knownAcknowledgements.current?.has(task.id));
          knownStatuses.current = new Map(volunteerTasks.map((task) => [task.id, task.status]));
          knownAcknowledgements.current = new Set(volunteerTasks.filter((task) => task.completion_acknowledged_at).map((task) => task.id));
          setTasks(volunteerTasks);
          if (needsHelp.length) {
            setNotice(`${needsHelp.map((task) => task.assignee_name || "A volunteer").join(", ")} ${needsHelp.length === 1 ? "needs" : "need"} help. Check the response map and contact them.`);
          } else if (newlyCompleted.length) {
            setNotice(`${newlyCompleted.length} new volunteer completion ${newlyCompleted.length === 1 ? "report" : "reports"} received.`);
          } else if (newlyAcknowledged.length) {
            setNotice(`Acknowledged ${newlyAcknowledged.length} volunteer completion ${newlyAcknowledged.length === 1 ? "report" : "reports"}.`);
          }
        })
        .catch(() => undefined);
    }, 15000);
    const safetyTimer = window.setInterval(() => {
      getVolunteerSafetyEvents().then((events) => {
        const newEvents = knownSafetyEvents.current === null ? [] : events.filter((event) => !knownSafetyEvents.current?.has(event.id));
        knownSafetyEvents.current = new Set(events.map((event) => event.id));
        setSafetyEvents(events);
        if (newEvents.length) {
          const event = newEvents[0];
          setNotice(`${event.event_type === "sos" ? "SOS" : "Missed check-in"}: ${event.volunteer_name} · ${event.task}`);
          if ("Notification" in window && Notification.permission === "granted") new Notification(event.event_type === "sos" ? "Volunteer SOS" : "Missed volunteer check-in", { body: `${event.volunteer_name} · ${event.task}` });
        }
      }).catch(() => undefined);
    }, 15000);
    return () => { window.clearInterval(timer); window.clearInterval(safetyTimer); window.removeEventListener("focus", refreshOnReturn); document.removeEventListener("visibilitychange", refreshOnReturn); };
  }, [refresh]);

  const acknowledgeCompletion = async (task: Dispatch) => {
    setBusy(task.id); setError(null); setNotice(null);
    try {
      const updated = await acknowledgeDispatchCompletion(task.id);
      setTasks((current) => current.map((item) => item.id === task.id ? updated : item));
      knownAcknowledgements.current?.add(task.id);
      setNotice(`Completion report from ${task.assignee_name || "the volunteer"} acknowledged. They will see the update in their app.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not acknowledge the volunteer completion report.");
    } finally { setBusy(null); }
  };

  const approvedPlans = plans.filter((plan) => plan.status === "approved" || plan.status === "modified");
  const groups = useMemo(() => {
    const byGroup = new Map<string, Dispatch[]>();
    tasks.forEach((task) => {
      const key = task.task_group_id || task.id;
      byGroup.set(key, [...(byGroup.get(key) || []), task]);
    });
    return Array.from(byGroup.entries()).map(([key, slots]) => ({ key, slots }));
  }, [tasks]);
  const assignedIds = new Set(tasks.flatMap((task) => task.assignee_id && task.status !== "completed" ? [task.assignee_id] : []));
  const unassignedSlots = tasks.filter((task) => !task.assignee_id).length;
  const availableVolunteers = volunteers.filter((person) => person.available && !assignedIds.has(person.id)).length;

  const createTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!planId || !message.trim()) return;
    setBusy("create"); setError(null); setNotice(null);
    try {
      const created = await createVolunteerTask({ response_plan_id: planId, message: message.trim(), volunteers_needed: headcount, shift_starts_at: shiftStarts ? new Date(shiftStarts).toISOString() : null, shift_ends_at: shiftEnds ? new Date(shiftEnds).toISOString() : null, meeting_point: meetingPoint.trim() || null });
      setTasks((current) => [...created, ...current]);
      setMessage("");
      setHeadcount(1);
      setShiftStarts(""); setShiftEnds(""); setMeetingPoint("");
      setNotice(`Task created with ${created.length} volunteer ${created.length === 1 ? "slot" : "slots"}. Assign each slot to a registered volunteer below.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the volunteer task.");
    } finally { setBusy(null); }
  };

  const assign = async (slot: Dispatch) => {
    const volunteerId = selectedVolunteer[slot.id];
    if (!volunteerId) return;
    setBusy(slot.id); setError(null); setNotice(null);
    try {
      await assignVolunteer(slot.id, volunteerId);
      const volunteer = volunteers.find((person) => person.id === volunteerId);
      setTasks((current) => current.map((item) => item.id === slot.id ? { ...item, assignee_id: volunteerId, assignee_name: volunteer?.name || null } : item));
      setNotice(`${volunteer?.name || "Volunteer"} was assigned to the task.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not assign that volunteer.");
    } finally { setBusy(null); }
  };

  const acknowledgeSafetyEvent = async (eventId: string) => {
    setBusy(eventId); setError(null);
    try { await resolveVolunteerSafetyEvent(eventId); setSafetyEvents((events) => events.filter((event) => event.id !== eventId)); setNotice("Safety alert acknowledged. Follow up with the volunteer directly."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not acknowledge the safety alert."); }
    finally { setBusy(null); }
  };

  const planLabel = (plan: ResponsePlanSummary) => plan.report_description || `Incident ${plan.incident_id}`;

  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-lg font-bold text-slate-900">Volunteer coordination</h2><p className="mt-1 text-sm text-slate-500">Review volunteer readiness, assign work, and follow progress reports.</p></div>
      <button type="button" onClick={() => void refresh()} disabled={loading} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">{loading ? "Refreshing…" : "Refresh"}</button>
    </div>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Volunteer staffing summary">
      {[
        { label: "Registered volunteers", value: volunteers.length, color: "border-blue-600" },
        { label: "Working on tasks", value: assignedIds.size, color: "border-emerald-600" },
        { label: "Available for assignment", value: Math.max(availableVolunteers, 0), color: "border-slate-400" },
        { label: "Volunteer slots to fill", value: unassignedSlots, color: "border-amber-500" },
      ].map((item) => <article key={item.label} className={`card border-t-4 ${item.color} p-4`}><p className="text-2xl font-bold text-slate-900">{loading ? "…" : item.value}</p><p className="mt-1 text-sm text-slate-600">{item.label}</p></article>)}
    </section>

    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}

    <section className="card border-l-4 border-red-600 p-5"><div className="mb-3 flex items-baseline justify-between gap-2"><div><h3 className="font-semibold text-red-900">Volunteer safety watch</h3><p className="mt-1 text-sm text-slate-600">SOS requests and shifts without check-in after the 10-minute grace period.</p></div><span className="badge badge-danger">{safetyEvents.length} open</span></div>{safetyEvents.length === 0 ? <p className="text-sm text-slate-500">No active SOS requests or missed check-ins.</p> : <div className="space-y-2">{safetyEvents.map((event) => <article key={event.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3"><div><p className="font-semibold text-red-900">{event.event_type === "sos" ? "SOS request" : "Missed shift check-in"} · {event.volunteer_name}</p><p className="text-sm text-slate-700">{event.phone} · {event.task}</p><p className="mt-1 text-xs text-slate-600">{event.message}</p><p className="text-xs text-slate-700">Location: {event.location_source.replace(/_/g, " ")}{event.accuracy_m != null ? ` · ±${Math.round(event.accuracy_m)} m accuracy` : ""}{event.lat != null && event.lon != null ? ` · ${event.lat.toFixed(4)}, ${event.lon.toFixed(4)}` : " · Location unavailable"}</p><p className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</p></div><div className="flex gap-2">{event.lat != null && event.lon != null && <a className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${event.lat},${event.lon}`}>Open map</a>}<button type="button" disabled={busy === event.id} onClick={() => void acknowledgeSafetyEvent(event.id)} className="rounded-lg bg-red-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === event.id ? "Saving…" : "Acknowledge"}</button></div></article>)}</div>}</section>

    <section className="card p-5"><div className="mb-3 flex items-baseline justify-between gap-2"><div><h3 className="font-semibold text-slate-900">Volunteer roster</h3><p className="mt-1 text-sm text-slate-500">Availability and capabilities reported by volunteer accounts.</p></div><span className="badge badge-info">{volunteers.filter((person) => person.available && !assignedIds.has(person.id)).length} ready</span></div>{volunteers.length === 0 ? <p className="text-sm text-slate-500">No volunteer accounts registered yet.</p> : <div className="grid gap-3 sm:grid-cols-2">{volunteers.map((person) => { const working = assignedIds.has(person.id); const ready = person.available && !working; return <article key={person.id} className="rounded-lg border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-slate-900">{person.name}</p><p className="text-sm text-slate-500">{person.phone}</p></div><span className={`badge ${ready ? "badge-success" : "badge-warning"}`}>{working ? "On assignment" : ready ? "Available" : "Unavailable"}</span></div><p className="mt-2 text-sm text-slate-600">{person.skills || "Skills not listed"}{person.languages ? ` · ${person.languages}` : ""}{person.has_transport ? " · Transport" : ""}</p></article>; })}</div>}</section>

    <section className="card p-5">
      <h3 className="font-semibold text-slate-900">Create a volunteer task</h3>
      <p className="mt-1 text-sm text-slate-500">Choose an approved incident plan, describe the work, and set the volunteer headcount needed.</p>
      {approvedPlans.length === 0 ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No approved response plans yet. Approve a plan before creating a volunteer task.</p> : <form onSubmit={(event) => void createTask(event)} className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_130px]">
        <label className="text-sm font-medium text-slate-700 md:col-span-2">Incident response plan<select required value={planId} onChange={(event) => setPlanId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">Choose an approved plan</option>{approvedPlans.map((plan) => <option key={plan.id} value={plan.id}>{planLabel(plan)}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Task instructions<textarea required minLength={5} maxLength={2000} rows={3} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Example: Distribute drinking water at the east shelter entrance." className="mt-1 w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /></label>
        <label className="text-sm font-medium text-slate-700">Volunteers needed<input type="number" min={1} max={25} required value={headcount} onChange={(event) => setHeadcount(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /><span className="mt-1 block text-xs font-normal text-slate-500">Create 1–25 assignable slots</span></label>
        <label className="text-sm font-medium text-slate-700">Shift starts<input type="datetime-local" value={shiftStarts} onChange={(event) => setShiftStarts(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /></label>
        <label className="text-sm font-medium text-slate-700">Shift ends<input type="datetime-local" value={shiftEnds} onChange={(event) => setShiftEnds(event.target.value)} min={shiftStarts || undefined} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /></label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">Meeting point<input maxLength={500} value={meetingPoint} onChange={(event) => setMeetingPoint(event.target.value)} placeholder="Address or clear landmark for volunteers to meet" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /></label>
        <div className="md:col-span-2"><button type="submit" disabled={busy === "create" || !planId || !message.trim()} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{busy === "create" ? "Creating task…" : "Create volunteer task"}</button></div>
      </form>}
    </section>

    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><div><h3 className="font-semibold text-slate-900">Volunteer tasks</h3><p className="mt-1 text-sm text-slate-500">Completion reports appear here automatically, usually within 30 seconds.</p></div><span className="badge badge-info">{groups.length} tasks</span></div>
      {loading ? <p role="status" className="card p-5 text-sm text-slate-500">Loading volunteer tasks…</p> : groups.length === 0 ? <p className="card p-5 text-sm text-slate-500">No volunteer tasks yet. Create one from an approved plan above.</p> : <div className="space-y-4">{groups.map(({ key, slots }) => {
        const first = slots[0];
        const volunteersNeeded = first.volunteers_needed ?? slots.length;
        const assignedInGroup = slots.filter((slot) => slot.assignee_id).length;
        const completedInGroup = slots.filter((slot) => slot.status === "completed").length;
        const plan = plans.find((item) => item.id === first.response_plan_id);
        const groupAssignedIds = new Set(slots.flatMap((slot) => slot.assignee_id ? [slot.assignee_id] : []));
        return <article key={key} className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h4 className="font-semibold text-slate-900">{first.message}</h4><p className="mt-1 text-sm text-slate-500">{plan ? planLabel(plan) : `Incident ${first.incident_id || "unavailable"}`}</p></div><div className="flex flex-wrap gap-2"><span className={`badge ${assignedInGroup >= volunteersNeeded ? "badge-success" : "badge-warning"}`}>{assignedInGroup} / {volunteersNeeded} volunteers</span>{completedInGroup > 0 && <span className="badge badge-info">{completedInGroup} completed</span>}</div></div>
          {(first.shift_starts_at || first.meeting_point) && <p className="mt-3 text-sm text-slate-600">{first.shift_starts_at && <>Shift: {new Date(first.shift_starts_at).toLocaleString()}{first.shift_ends_at ? ` – ${new Date(first.shift_ends_at).toLocaleString()}` : ""}. </>}{first.meeting_point && <>Meet at {first.meeting_point}</>}</p>}
          <div className="mt-4 space-y-2">{slots.map((slot, index) => <div key={slot.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
            <div className="text-sm"><span className="font-medium text-slate-700">Volunteer slot {index + 1}</span>{slot.assignee_name && <p className="mt-0.5 text-slate-600">{slot.assignee_name} · {volunteers.find((person) => person.id === slot.assignee_id)?.phone || "account phone unavailable"}</p>}{slot.checked_in_at && <p className="mt-1 text-xs text-emerald-800">Checked in {new Date(slot.checked_in_at).toLocaleString()}{slot.checked_out_at ? ` · Checked out ${new Date(slot.checked_out_at).toLocaleString()}` : " · On shift"}</p>}{slot.completion_note && <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 p-3"><p className="font-semibold text-emerald-900">Volunteer completion report</p><p className="mt-1 whitespace-pre-wrap text-emerald-900">{slot.completion_note}</p>{slot.completed_at && <p className="mt-1 text-xs text-emerald-800">Submitted {new Date(slot.completed_at).toLocaleString()}</p>}{slot.completion_acknowledged_at ? <p className="mt-1 text-xs font-semibold text-emerald-800">Acknowledged by officials · {new Date(slot.completion_acknowledged_at).toLocaleString()}</p> : <button type="button" disabled={busy === slot.id} onClick={() => void acknowledgeCompletion(slot)} className="mt-3 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy === slot.id ? "Saving…" : "Acknowledge report and notify volunteer"}</button>}</div>}</div>
            {slot.assignee_id ? <span className={`badge ${slot.status === "completed" ? "badge-success" : ["acknowledged", "en_route", "arrived"].includes(slot.status) ? "badge-info" : slot.status === "needs_help" ? "badge-danger" : "badge-warning"}`}>{slot.status.replace(/_/g, " ")}</span> : <div className="flex flex-1 flex-wrap justify-end gap-2 sm:flex-none"><select aria-label={`Choose volunteer for slot ${index + 1}`} value={selectedVolunteer[slot.id] || ""} onChange={(event) => setSelectedVolunteer((current) => ({ ...current, [slot.id]: event.target.value }))} className="min-w-52 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Choose available volunteer</option>{volunteers.filter((person) => person.available && !assignedIds.has(person.id) && !groupAssignedIds.has(person.id)).map((person) => <option key={person.id} value={person.id}>{person.name} · {person.phone}{person.skills ? ` · ${person.skills}` : ""}{person.has_transport ? " · transport" : ""}</option>)}</select><button type="button" disabled={!selectedVolunteer[slot.id] || busy === slot.id} onClick={() => void assign(slot)} className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === slot.id ? "Assigning…" : "Assign"}</button></div>}
          </div>)}</div>
          {slots.some((slot) => slot.updates?.length) && <div className="mt-4 space-y-3"><h5 className="text-sm font-semibold text-slate-800">Volunteer progress and status reports</h5>{slots.filter((slot) => slot.updates?.length).map((slot) => <div key={`${slot.id}-activity`} className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-sm font-semibold text-slate-800">{slot.assignee_name || "Volunteer"}</p><div className="mt-2 space-y-2">{slot.updates?.map((update) => <div key={update.id} className={`rounded-md border p-2.5 ${update.kind === "blocker" ? "border-amber-200 bg-amber-50" : update.kind === "status_update" ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50"}`}><div className="flex flex-wrap justify-between gap-2"><span className="text-xs font-semibold capitalize text-slate-700">{update.kind.replace(/_/g, " ")}</span><time className="text-xs text-slate-500">{new Date(update.created_at).toLocaleString()}</time></div><p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{update.note}</p>{update.remaining_work && <p className="mt-1 text-xs text-slate-700"><strong>Remaining:</strong> {update.remaining_work}</p>}{update.resources_used && <p className="mt-1 text-xs text-slate-700"><strong>Resources used:</strong> {update.resources_used}</p>}{update.media_id && <a href={`/api-bridge/api/media/${update.media_id}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-blue-700 underline">View attached photo</a>}</div>)}</div></div>)}</div>}
        </article>;
      })}</div>}
    </section>
  </div>;
}
