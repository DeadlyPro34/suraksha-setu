"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { acknowledgeDispatch, checkInVolunteer, checkOutVolunteer, completeAssignedTask, getCitizenAlerts, getCurrentUser, getMyDispatches, getMyVolunteerProfile, getShelters, sendVolunteerSOS, shareVolunteerLocation, stopVolunteerLocation, updateDispatchStatus, updateMyVolunteerProfile } from "@/lib/api";
import { Alert, Dispatch, Shelter, User, VolunteerProfile } from "@/lib/types";

const ResponseMap = dynamic(() => import("@/components/ResponseMap").then((module) => module.ResponseMap), { ssr: false, loading: () => <div className="card p-8 text-center text-slate-500">Loading response map…</div> });

const displayDate = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function FieldOfficerHome() {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [account, setAccount] = useState<User | null>(null);
  const [profile, setProfile] = useState<VolunteerProfile | null>(null);
  const [profileDraft, setProfileDraft] = useState({ available: false, skills: "", languages: "", has_transport: false });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState<Record<string, string>>({});
  const [sharingTaskId, setSharingTaskId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"tasks" | "map">("tasks");
  const [largeText, setLargeText] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const watchId = useRef<number | null>(null);
  const lastSentAt = useRef(0);
  const knownAssignments = useRef<Set<string> | null>(null);
  const knownAcknowledgements = useRef<Set<string> | null>(null);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const rows = await getMyDispatches();
      if (knownAssignments.current) {
        const newlyAssigned = rows.filter((task) => task.target_role === "volunteer" && !knownAssignments.current?.has(task.id));
        if (newlyAssigned.length) {
          setNotice(`${newlyAssigned.length} new volunteer ${newlyAssigned.length === 1 ? "task" : "tasks"} assigned.`);
          if ("Notification" in window && Notification.permission === "granted") new Notification("New Suraksha Setu assignment", { body: newlyAssigned[0].message });
        }
      }
      const acknowledgedReports = new Set(rows.filter((task) => task.completion_acknowledged_at).map((task) => task.id));
      const newlyAcknowledged = knownAcknowledgements.current === null
        ? []
        : rows.filter((task) => task.completion_acknowledged_at && !knownAcknowledgements.current?.has(task.id));
      if (newlyAcknowledged.length) {
        setNotice(`Officials acknowledged your completion report${newlyAcknowledged.length === 1 ? "" : "s"}.`);
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Completion report acknowledged", { body: newlyAcknowledged[0].message });
        }
      }
      knownAcknowledgements.current = acknowledgedReports;
      knownAssignments.current = new Set(rows.map((task) => task.id));
      setDispatches(rows);
      setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load assignments."); }
    finally { if (!quiet) setLoading(false); }
  }, []);

  useEffect(() => {
    void refresh();
    void getCurrentUser().then(async (user) => {
      setAccount(user);
      if (user.role === "volunteer") {
        const p = await getMyVolunteerProfile(); setProfile(p);
        setProfileDraft({ available: p.available, skills: p.skills || "", languages: p.languages || "", has_transport: p.has_transport });
        const [a, s] = await Promise.allSettled([getCitizenAlerts(), getShelters()]);
        if (a.status === "fulfilled") setAlerts(a.value);
        if (s.status === "fulfilled") setShelters(s.value);
      }
    }).catch(() => undefined);
    const timer = window.setInterval(() => void refresh(true), 20000);
    const refreshOnReturn = () => { if (document.visibilityState === "visible") void refresh(true); };
    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refreshOnReturn); document.removeEventListener("visibilitychange", refreshOnReturn); if (watchId.current !== null) navigator.geolocation?.clearWatch(watchId.current); };
  }, [refresh]);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault(); setBusyId("profile"); setError(null);
    try { const saved = await updateMyVolunteerProfile({ ...profileDraft, skills: profileDraft.skills.trim(), languages: profileDraft.languages.trim() }); setProfile(saved); setNotice("Volunteer profile updated."); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not save profile."); }
    finally { setBusyId(null); }
  };

  const updateStatus = async (task: Dispatch, status: "acknowledged" | "en_route" | "arrived" | "needs_help") => {
    setBusyId(task.id); setError(null);
    try { await updateDispatchStatus(task.id, status); await refresh(true); setNotice(status === "needs_help" ? "Officials have been notified that you need help." : `Task status updated: ${status.replace(/_/g, " ")}.`); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not update task status."); }
    finally { setBusyId(null); }
  };

  const acknowledge = async (dispatchId: string) => {
    setBusyId(dispatchId); setError(null);
    try { await acknowledgeDispatch(dispatchId); await refresh(true); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not acknowledge assignment."); }
    finally { setBusyId(null); }
  };

  const shiftAction = async (task: Dispatch, action: "check-in" | "check-out") => {
    setBusyId(task.id); setError(null);
    try {
      if (action === "check-in") await checkInVolunteer(task.id);
      else await checkOutVolunteer(task.id);
      await refresh(true);
      setNotice(action === "check-in" ? "Shift check-in recorded. Officials can see you are on duty." : "Shift check-out recorded.");
    } catch (err) { setError(err instanceof Error ? err.message : `Could not check ${action === "check-in" ? "in" : "out"} of the shift.`); }
    finally { setBusyId(null); }
  };

  const sendSOS = async (task: Dispatch) => {
    if (!window.confirm("Send an SOS to the response officials? They will receive your task and location if your device can provide it.")) return;
    setBusyId(`sos-${task.id}`); setError(null);
    const coords = await new Promise<{ lat: number; lon: number; accuracy_m: number } | undefined>((resolve) => {
      if (!navigator.geolocation) { resolve(undefined); return; }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude, accuracy_m: position.coords.accuracy }),
        () => resolve(undefined),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 7000 },
      );
    });
    try {
      await sendVolunteerSOS(task.id, coords);
      await refresh(true);
      setNotice("SOS sent to officials. If you are in immediate danger, call local emergency services too.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not send the SOS. Try again or contact officials directly."); }
    finally { setBusyId(null); }
  };

  const startSharing = (task: Dispatch) => {
    if (!navigator.geolocation) { setError("This device does not provide location sharing."); return; }
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    setError(null); setSharingTaskId(task.id); setNotice("Live location sharing started for this task. Officials can see your recent position.");
    watchId.current = navigator.geolocation.watchPosition((position) => {
      const now = Date.now(); if (now - lastSentAt.current < 15000) return; lastSentAt.current = now;
      void shareVolunteerLocation(task.id, position.coords.latitude, position.coords.longitude).catch((err) => setError(err instanceof Error ? err.message : "Could not share your location."));
    }, (geoError) => { setError(geoError.message || "Could not get your location. Check the browser permission."); setSharingTaskId(null); }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
  };

  const stopSharing = async () => {
    if (watchId.current !== null) navigator.geolocation?.clearWatch(watchId.current);
    watchId.current = null; setSharingTaskId(null);
    try { await stopVolunteerLocation(); setNotice("Location sharing stopped."); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not stop location sharing."); }
  };

  const complete = async (dispatchId: string) => {
    const note = completionNotes[dispatchId]?.trim();
    if (!note) { setError("Add a short note about the work completed before submitting."); return; }
    setBusyId(dispatchId); setError(null);
    try { await completeAssignedTask(dispatchId, note); setCompletionNotes((current) => ({ ...current, [dispatchId]: "" })); if (sharingTaskId === dispatchId) await stopSharing(); await refresh(true); setNotice("Work report sent to officials."); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not submit the completion report."); }
    finally { setBusyId(null); }
  };

  const askNotifications = async () => {
    if (!("Notification" in window)) { setNotice("This browser does not support desktop notifications. In-app task notices will still appear while the page is open."); return; }
    const permission = await Notification.requestPermission();
    setNotice(permission === "granted" ? "Task notifications enabled while this page is open." : "Notifications were not enabled. New tasks will still appear in this page.");
  };
  const isVolunteer = account?.role === "volunteer";
  const tasks = dispatches.filter((task) => !isVolunteer || task.target_role === "volunteer");

  return <main className={`min-h-screen p-4 sm:p-6 lg:p-8 ${isVolunteer ? "volunteer-workspace bg-[#f2f6f5]" : "bg-[#f2f6f5]"}`}><div className="mx-auto max-w-7xl space-y-4 sm:space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className={`${isVolunteer ? "text-3xl sm:text-4xl" : "text-lg"} font-bold leading-tight text-slate-900`}>{isVolunteer ? "My volunteer tasks" : "My field assignments"}</h1><p className={`${isVolunteer ? "text-base" : "text-sm"} mt-1 text-slate-600`}>{account ? `${isVolunteer ? `For ${account.name} · ` : ""}${isVolunteer ? "Volunteer" : "Dispatch instructions assigned by the response team."}` : "Dispatch instructions assigned by the response team."}</p></div><div className="flex gap-2"><button onClick={() => void refresh()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Refresh</button>{isVolunteer && <button onClick={() => void askNotifications()} className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-900">Enable notifications</button>}</div></header>
    {isVolunteer && <nav aria-label="Volunteer page view" className="flex flex-wrap items-center gap-2 md:hidden"><div className="flex flex-1 rounded-lg border border-slate-200 bg-white p-1"><button type="button" aria-pressed={mobilePanel === "tasks"} onClick={() => setMobilePanel("tasks")} className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${mobilePanel === "tasks" ? "bg-teal-700 text-white shadow-sm" : "text-slate-700"}`}>Tasks</button><button type="button" aria-pressed={mobilePanel === "map"} onClick={() => setMobilePanel("map")} className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${mobilePanel === "map" ? "bg-teal-700 text-white shadow-sm" : "text-slate-700"}`}>Map</button></div><button type="button" aria-pressed={largeText} onClick={() => setLargeText((value) => !value)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-semibold text-slate-800">{largeText ? "A−" : "A+"}</button></nav>}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950">{notice}</p>}
    <div className={isVolunteer ? `grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(380px,.95fr)] ${largeText ? "volunteer-large-text" : ""}` : "space-y-5"}>
    {isVolunteer && profile && <form onSubmit={(event) => void saveProfile(event)} className={`card space-y-3 p-4 sm:p-5 ${mobilePanel === "map" ? "hidden lg:block" : ""}`}><div><h2 className="text-lg font-bold text-slate-900">Volunteer readiness profile</h2><p className="mt-1 text-sm text-slate-600">Officials use this to choose suitable, available volunteers.</p></div><label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={profileDraft.available} onChange={(event) => setProfileDraft((p) => ({ ...p, available: event.target.checked }))} className="h-4 w-4 accent-emerald-600" />Available for new assignments</label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Skills<input value={profileDraft.skills} onChange={(event) => setProfileDraft((p) => ({ ...p, skills: event.target.value }))} maxLength={500} placeholder="First aid, boat operation, translation" className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="text-sm font-medium text-slate-700">Languages<input value={profileDraft.languages} onChange={(event) => setProfileDraft((p) => ({ ...p, languages: event.target.value }))} maxLength={300} placeholder="Gujarati, Hindi, English" className="mt-1 w-full rounded-lg border px-3 py-2" /></label></div><label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={profileDraft.has_transport} onChange={(event) => setProfileDraft((p) => ({ ...p, has_transport: event.target.checked }))} className="h-4 w-4 accent-blue-600" />I can provide transport</label><button disabled={busyId === "profile"} className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyId === "profile" ? "Saving…" : "Save profile"}</button></form>}
    {isVolunteer && <section className={`card border-[#d9e5e1] bg-white p-2.5 shadow-sm lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-4 lg:self-start ${mapFullscreen ? "fixed inset-0 z-[1000] m-0 flex flex-col rounded-none bg-[#f2f6f5] p-3 sm:p-4" : mobilePanel === "map" ? "block" : "hidden lg:block"}`}><div className="mb-2 flex items-center justify-between gap-3 px-1.5"><div><h2 className="text-base font-bold text-slate-900">Response map</h2><p className="text-xs text-slate-600">Alerts, shelters, and your task locations.</p></div><div className="flex gap-2">{!mapFullscreen && <button type="button" onClick={() => setMapFullscreen(true)} className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-900 md:hidden">Full map</button>}{mapFullscreen && <button type="button" onClick={() => setMapFullscreen(false)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800">Close map</button>}</div></div><div className={`${mapFullscreen ? "min-h-0 flex-1" : "h-[min(48vh,410px)] min-h-[280px] max-h-[410px] lg:h-[390px]"} overflow-hidden rounded-lg`}><ResponseMap alerts={alerts} shelters={shelters} showAlerts showShelters taskLocations={dispatches.filter((task) => task.target_role === "volunteer")} showTasks /></div></section>}
    <section className={`${isVolunteer ? "space-y-4 lg:col-start-1 lg:row-start-2" : "space-y-4"} ${isVolunteer && mobilePanel === "map" ? "hidden lg:block" : ""}`}>
    <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className={`${isVolunteer ? "text-xl sm:text-2xl" : "text-lg"} font-bold text-slate-900`}>{isVolunteer ? "Assigned tasks" : "Assignment details"}</h2><p className="volunteer-readable mt-1 text-sm text-slate-600">{isVolunteer ? "Task details and updates from your response team." : "Dispatch instructions assigned by the response team."}</p></div><span className={`rounded-full px-3 py-1.5 text-sm font-bold tabular-nums ${isVolunteer ? "bg-teal-100 text-teal-950" : "bg-sky-100 text-sky-950"}`}>{tasks.length} {tasks.length === 1 ? "task" : "tasks"} · {tasks.filter((task) => task.status === "completed").length} done</span></div>
    {loading ? <p role="status" className="card p-5 text-base text-slate-600">Loading assignments…</p> : tasks.length === 0 ? <div className="card p-8 text-center text-base text-slate-600">{isVolunteer ? "No volunteer tasks have been assigned to your account yet. New assignments will be shown here." : "No assignments have been assigned to your account yet."}</div> : <div className="space-y-3">{tasks.map((task) => <article key={task.id} className="card p-4 sm:p-5"><div className="flex flex-wrap justify-between gap-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`badge ${task.status === "completed" ? "badge-success" : task.status === "needs_help" ? "badge-danger" : ["acknowledged", "en_route", "arrived"].includes(task.status) ? "badge-info" : "badge-warning"}`}>{task.status.replace(/_/g, " ")}</span>{task.priority_score != null && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-950">Priority {task.priority_score}</span>}</div><h3 className="volunteer-task-title mt-2 text-lg font-bold leading-snug text-slate-950 sm:text-xl">{task.message}</h3><p className="volunteer-readable mt-2 break-all text-sm font-medium text-slate-700">{task.report_id ? `Report ${task.report_id}` : `Incident ${task.incident_id || "unavailable"}`}</p>{isVolunteer && <p className="mt-2 inline-flex rounded-lg bg-teal-50 px-3 py-2 text-base font-bold tabular-nums text-teal-950">Team staffing: {task.volunteers_assigned ?? 1} of {task.volunteers_needed ?? 1} volunteers</p>}{task.meeting_point && <p className="volunteer-readable mt-2 text-base text-slate-800"><strong>Meeting point:</strong> {task.meeting_point}</p>}
      <div className="mt-3 flex flex-wrap gap-2">{(task.shift_starts_at || task.shift_ends_at) && <span className="volunteer-date rounded-lg bg-amber-100 px-3 py-2 text-base font-bold tabular-nums text-amber-950"><strong>Shift:</strong> {task.shift_starts_at ? displayDate(task.shift_starts_at) : "Unspecified"}{task.shift_ends_at ? ` – ${displayDate(task.shift_ends_at)}` : ""}</span>}{task.dispatched_at && <span className="volunteer-date rounded-lg bg-sky-100 px-3 py-2 text-base font-bold tabular-nums text-sky-950"><strong>Assigned:</strong> {displayDate(task.dispatched_at)}</span>}{isVolunteer && task.checked_in_at && <span className="volunteer-date rounded-lg bg-emerald-100 px-3 py-2 text-base font-bold tabular-nums text-emerald-950"><strong>Checked in:</strong> {displayDate(task.checked_in_at)}{task.checked_out_at ? ` · Out ${displayDate(task.checked_out_at)}` : " · On shift"}</span>}</div>{task.lat != null && task.lon != null && <a className="mt-3 inline-block text-sm font-semibold text-blue-800 underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${task.lat},${task.lon}`}>Open task location in map</a>}</div>
    <div className="flex flex-wrap items-start gap-2">{task.status === "sent" && <button disabled={busyId === task.id} onClick={() => void acknowledge(task.id)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyId === task.id ? "Saving…" : "Accept task"}</button>}{["acknowledged", "needs_help"].includes(task.status) && <button disabled={busyId === task.id} onClick={() => void updateStatus(task, "en_route")} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">On my way</button>}{["en_route", "needs_help"].includes(task.status) && <button disabled={busyId === task.id} onClick={() => void updateStatus(task, "arrived")} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">I have arrived</button>}{task.status !== "completed" && task.status !== "needs_help" && task.status !== "sent" && <button disabled={busyId === task.id} onClick={() => void updateStatus(task, "needs_help")} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 disabled:opacity-50">Need help</button>}{isVolunteer && task.status !== "completed" && <button disabled={busyId === `sos-${task.id}`} onClick={() => void sendSOS(task)} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busyId === `sos-${task.id}` ? "Sending SOS…" : "SOS · Alert officials"}</button>}{isVolunteer && task.status !== "completed" && <a href="tel:112" className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-800">Call India emergency services (112)</a>}{isVolunteer && task.status !== "completed" && <button onClick={() => sharingTaskId === task.id ? void stopSharing() : startSharing(task)} className="rounded-lg border border-violet-300 px-4 py-2 text-sm font-semibold text-violet-800">{sharingTaskId === task.id ? "Stop location sharing" : "Share live location"}</button>}{isVolunteer && task.status !== "completed" && (task.shift_starts_at || task.shift_ends_at) && <>{!task.checked_in_at ? <button disabled={busyId === task.id} onClick={() => void shiftAction(task, "check-in")} className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50">Check in to shift</button> : !task.checked_out_at && <button disabled={busyId === task.id} onClick={() => void shiftAction(task, "check-out")} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Check out</button>}</>}</div></div>
      {task.status === "arrived" && <div className="mt-4 border-t border-slate-100 pt-4"><label htmlFor={`completion-${task.id}`} className="block text-base font-semibold text-slate-900">Report completed work</label><p className="volunteer-readable mt-1 text-sm text-slate-700">Tell officials what you completed and anything that still needs attention.</p><textarea id={`completion-${task.id}`} rows={3} maxLength={2000} required value={completionNotes[task.id] || ""} onChange={(event) => setCompletionNotes((current) => ({ ...current, [task.id]: event.target.value }))} placeholder="Example: Cleared the blocked road. The north entrance still needs attention." className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base" /><button type="button" disabled={busyId === task.id || !completionNotes[task.id]?.trim()} onClick={() => void complete(task.id)} className="mt-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busyId === task.id ? "Submitting report…" : "Mark complete and send report"}</button></div>}
      {task.status === "completed" && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4"><p className="text-base font-bold text-emerald-950">Work report sent to officials</p><p className="volunteer-readable mt-1 whitespace-pre-wrap text-sm text-emerald-950">{task.completion_note}</p>{task.completed_at && <p className="mt-2 rounded-md bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-950">Submitted {displayDate(task.completed_at)}</p>}{task.completion_acknowledged_at ? <p role="status" className="mt-3 rounded-md bg-white p-3 text-sm font-bold text-emerald-950">Officials acknowledged your report · {displayDate(task.completion_acknowledged_at)}</p> : <p className="volunteer-readable mt-3 text-sm font-medium text-emerald-900">Waiting for an official to review and acknowledge this report. This page checks for updates automatically.</p>}</div>}</article>)}</div>}
    {isVolunteer && <p className="volunteer-readable text-sm text-slate-600">Task notices appear while this page is open. Live location is shared only after you start sharing, and officials can see updates from the last two minutes.</p>}
    </section>
    </div>
  </div></main>;
}
