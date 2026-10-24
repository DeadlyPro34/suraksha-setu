"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { acknowledgeDispatch, addDispatchUpdate, checkInVolunteer, checkOutVolunteer, completeAssignedTask, getCitizenAlerts, getCurrentUser, getMyDispatches, getMyVolunteerProfile, getShelters, requestFieldOfficerSupport, sendVolunteerSOS, shareVolunteerLocation, stopVolunteerLocation, updateDispatchStatus, updateMyVolunteerProfile, uploadDispatchPhoto } from "@/lib/api";
import { Alert, Dispatch, Shelter, User, VolunteerProfile } from "@/lib/types";
import { SupportConversation } from "@/components/SupportConversation";
import { SupplyRequestPanel } from "@/components/SupplyRequestPanel";

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
  const [updateNotes, setUpdateNotes] = useState<Record<string, string>>({});
  const [updateKinds, setUpdateKinds] = useState<Record<string, "progress" | "blocker">>({});
  const [updatePhotos, setUpdatePhotos] = useState<Record<string, File | null>>({});
  const [completionPhotos, setCompletionPhotos] = useState<Record<string, File | null>>({});
  const [completionRemaining, setCompletionRemaining] = useState<Record<string, string>>({});
  const [completionResources, setCompletionResources] = useState<Record<string, string>>({});
  const [supportDrafts, setSupportDrafts] = useState<Record<string, { support_type: "medical" | "rescue" | "logistics" | "general"; volunteers_needed: number; details: string; location: string }>>({});
  const [sharingTaskId, setSharingTaskId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"tasks" | "map">("tasks");
  const [taskFilter, setTaskFilter] = useState<"all" | "active" | "completed">("all");
  const [largeText, setLargeText] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [focusLocation, setFocusLocation] = useState<{ lat: number; lon: number } | null>(null);
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

  useEffect(() => {
    if (!focusLocation) return;
    window.requestAnimationFrame(() => document.getElementById("response-map")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [focusLocation]);

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
    try { const photo = completionPhotos[dispatchId]; const media_id = photo ? await uploadDispatchPhoto(photo) : undefined; await completeAssignedTask(dispatchId, note, { remaining_work: completionRemaining[dispatchId]?.trim() || undefined, resources_used: completionResources[dispatchId]?.trim() || undefined, media_id }); setCompletionNotes((current) => ({ ...current, [dispatchId]: "" })); if (sharingTaskId === dispatchId) await stopSharing(); await refresh(true); setNotice("Work report sent to officials."); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not submit the completion report."); }
    finally { setBusyId(null); }
  };

  const submitUpdate = async (task: Dispatch) => {
    const note = updateNotes[task.id]?.trim();
    if (!note) return;
    setBusyId(`update-${task.id}`); setError(null);
    try {
      const photo = updatePhotos[task.id];
      const mediaId = photo ? await uploadDispatchPhoto(photo) : undefined;
      const kind = updateKinds[task.id] || "progress";
      await addDispatchUpdate(task.id, kind, note, mediaId);
      setUpdateNotes((current) => ({ ...current, [task.id]: "" }));
      setUpdatePhotos((current) => ({ ...current, [task.id]: null }));
      await refresh(true);
      setNotice(kind === "blocker" ? "Blocker sent to officials; assignment flagged as needing help." : "Progress update sent to officials.");
    } catch (err) {
      const message = err instanceof TypeError
        ? "Could not reach the backend. Make sure it is running, then retry your update."
        : err instanceof Error ? err.message : "Could not send the update.";
      setError(message);
    }
    finally { setBusyId(null); }
  };

  const submitSupportRequest = async (task: Dispatch) => {
    const draft = supportDrafts[task.id] || { support_type: "general" as const, volunteers_needed: 1, details: "", location: task.meeting_point || "" };
    if (!draft.details.trim()) { setError("Explain what support the volunteers should provide."); return; }
    setBusyId(`support-${task.id}`); setError(null);
    try {
      await requestFieldOfficerSupport(task.id, { ...draft, details: draft.details.trim(), location: draft.location.trim() || null });
      await refresh(true);
      setNotice("Volunteer support request sent to officials for assignment.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not request volunteer support."); }
    finally { setBusyId(null); }
  };

  const askNotifications = async () => {
    if (!("Notification" in window)) { setNotice("This browser does not support desktop notifications. In-app task notices will still appear while the page is open."); return; }
    const permission = await Notification.requestPermission();
    setNotice(permission === "granted" ? "Task notifications enabled while this page is open." : "Notifications were not enabled. New tasks will still appear in this page.");
  };
  const isVolunteer = account?.role === "volunteer";
  const tasks = dispatches.filter((task) => !isVolunteer || task.target_role === "volunteer");
  const activeTasks = tasks.filter((task) => task.status !== "completed");
  const completedTasks = tasks.filter((task) => task.status === "completed");
  const visibleTasks = tasks.filter((task) => taskFilter === "all" || (taskFilter === "completed" ? task.status === "completed" : task.status !== "completed"));

  return <main className={`min-h-screen p-4 sm:p-6 lg:p-8 ${isVolunteer ? "volunteer-workspace bg-[#f2f6f5]" : "bg-[#f2f6f5]"}`}><div className="mx-auto max-w-7xl space-y-4 sm:space-y-5">
    <header className={`${isVolunteer ? "" : "rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-7 sm:py-6"} flex flex-wrap items-center justify-between gap-4`}><div><p className={`${isVolunteer ? "hidden" : "mb-1 text-xs font-bold uppercase tracking-[0.16em] text-sky-800"}`}>{!isVolunteer && "Field operations"}</p><h1 className={`${isVolunteer ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"} font-bold leading-tight text-slate-900`}>{isVolunteer ? "My volunteer tasks" : "My field assignments"}</h1><p className={`${isVolunteer ? "text-base" : "text-base"} mt-1 text-slate-600`}>{account ? `${isVolunteer ? `For ${account.name} · ` : ""}${isVolunteer ? "Volunteer" : "Your assigned response work and team updates."}` : "Dispatch instructions assigned by the response team."}</p></div><div className="flex gap-2"><button onClick={() => void refresh()} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Refresh assignments</button>{isVolunteer && <button onClick={() => void askNotifications()} className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-900">Enable notifications</button>}</div></header>
    {isVolunteer && <nav aria-label="Volunteer page view" className="flex flex-wrap items-center gap-2 md:hidden"><div className="flex flex-1 rounded-lg border border-slate-200 bg-white p-1"><button type="button" aria-pressed={mobilePanel === "tasks"} onClick={() => setMobilePanel("tasks")} className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${mobilePanel === "tasks" ? "bg-teal-700 text-white shadow-sm" : "text-slate-700"}`}>Tasks</button><button type="button" aria-pressed={mobilePanel === "map"} onClick={() => setMobilePanel("map")} className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${mobilePanel === "map" ? "bg-teal-700 text-white shadow-sm" : "text-slate-700"}`}>Map</button></div><button type="button" aria-pressed={largeText} onClick={() => setLargeText((value) => !value)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-semibold text-slate-800">{largeText ? "A−" : "A+"}</button></nav>}
    {error && <p role="alert" className="sticky top-2 z-40 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 shadow-sm">{error}</p>}{notice && <p role="status" className="sticky top-2 z-40 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950 shadow-sm">{notice}</p>}
    {!isVolunteer && <section aria-label="Assignment overview" className="grid grid-cols-2 gap-3 sm:grid-cols-3"><article className="rounded-xl border border-sky-200 bg-white p-4 shadow-sm"><p className="text-2xl font-bold tabular-nums text-slate-950">{loading ? "…" : tasks.length}</p><p className="mt-1 text-sm font-medium text-slate-600">All assignments</p></article><article className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm"><p className="text-2xl font-bold tabular-nums text-amber-800">{loading ? "…" : activeTasks.length}</p><p className="mt-1 text-sm font-medium text-slate-600">In progress</p></article><article className="col-span-2 rounded-xl border border-emerald-200 bg-white p-4 shadow-sm sm:col-span-1"><p className="text-2xl font-bold tabular-nums text-emerald-800">{loading ? "…" : completedTasks.length}</p><p className="mt-1 text-sm font-medium text-slate-600">Completed</p></article></section>}
    {isVolunteer && <section aria-label="Volunteer task overview" className="grid grid-cols-2 gap-3 sm:grid-cols-4"><article className="rounded-xl border border-teal-200 bg-white p-4 shadow-sm"><p className="text-2xl font-bold tabular-nums text-teal-900">{loading ? "…" : tasks.length}</p><p className="mt-1 text-sm font-medium text-slate-600">Assigned</p></article><article className="rounded-xl border border-sky-200 bg-white p-4 shadow-sm"><p className="text-2xl font-bold tabular-nums text-sky-900">{loading ? "…" : activeTasks.filter((task) => ["acknowledged", "en_route", "arrived"].includes(task.status)).length}</p><p className="mt-1 text-sm font-medium text-slate-600">In progress</p></article><article className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm"><p className="text-2xl font-bold tabular-nums text-emerald-800">{loading ? "…" : completedTasks.length}</p><p className="mt-1 text-sm font-medium text-slate-600">Completed</p></article><article className="rounded-xl border border-red-200 bg-white p-4 shadow-sm"><p className="text-2xl font-bold tabular-nums text-red-800">{loading ? "…" : tasks.filter((task) => task.status === "needs_help").length}</p><p className="mt-1 text-sm font-medium text-slate-600">Need attention</p></article></section>}
    <div className={isVolunteer ? `grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(380px,.95fr)] ${largeText ? "volunteer-large-text" : ""}` : "space-y-5"}>
    {isVolunteer && profile && <details key="volunteer-readiness" className={`order-2 card p-4 sm:p-5 lg:order-none lg:col-start-1 lg:row-start-1 ${mobilePanel === "map" ? "hidden lg:block" : ""}`}><summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 font-semibold text-slate-900"><span><span className="block text-base">Volunteer readiness</span><span className="mt-0.5 block text-sm font-normal text-slate-600">Skills, availability, languages, and transport</span></span><span className={`rounded-full px-3 py-1 text-xs font-bold ${profileDraft.available ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"}`}>{profileDraft.available ? "Available" : "Unavailable"}</span></summary><form onSubmit={(event) => void saveProfile(event)} className="mt-4 space-y-3 border-t border-slate-100 pt-4"><label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={profileDraft.available} onChange={(event) => setProfileDraft((p) => ({ ...p, available: event.target.checked }))} className="h-4 w-4 accent-emerald-600" />Available for new assignments</label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Skills<input value={profileDraft.skills} onChange={(event) => setProfileDraft((p) => ({ ...p, skills: event.target.value }))} maxLength={500} placeholder="First aid, boat operation, translation" className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="text-sm font-medium text-slate-700">Languages<input value={profileDraft.languages} onChange={(event) => setProfileDraft((p) => ({ ...p, languages: event.target.value }))} maxLength={300} placeholder="Gujarati, Hindi, English" className="mt-1 w-full rounded-lg border px-3 py-2" /></label></div><label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={profileDraft.has_transport} onChange={(event) => setProfileDraft((p) => ({ ...p, has_transport: event.target.checked }))} className="h-4 w-4 accent-blue-600" />I can provide transport</label><button disabled={busyId === "profile"} className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyId === "profile" ? "Saving…" : "Save profile"}</button></form></details>}
    {isVolunteer && <section id="response-map" key="volunteer-response-map" className={`order-3 card border-[#d9e5e1] bg-white p-2.5 shadow-sm lg:order-none lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-4 lg:self-start ${mapFullscreen ? "fixed inset-0 z-[1000] m-0 flex flex-col rounded-none bg-[#f2f6f5] p-3 sm:p-4" : mobilePanel === "map" ? "block" : "hidden lg:block"}`}><div className="mb-2 flex items-center justify-between gap-3 px-1.5"><div><h2 className="text-base font-bold text-slate-900">Response map</h2><p className="text-xs text-slate-600">Alerts, shelters, and your task locations.</p></div><div className="flex gap-2">{!mapFullscreen && <button type="button" onClick={() => setMapFullscreen(true)} className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-900 md:hidden">Full map</button>}{mapFullscreen && <button type="button" onClick={() => setMapFullscreen(false)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800">Close map</button>}</div></div><div className={`${mapFullscreen ? "min-h-0 flex-1" : "h-[min(48vh,410px)] min-h-[280px] max-h-[410px] lg:h-[390px]"} overflow-hidden rounded-lg`}><ResponseMap alerts={alerts} shelters={shelters} showAlerts showShelters taskLocations={dispatches.filter((task) => task.target_role === "volunteer")} showTasks focusLocation={focusLocation} /></div></section>}
    <section key="assignment-list" className={`${isVolunteer ? "order-1 space-y-4 lg:order-none lg:col-start-1 lg:row-start-2" : "space-y-4"} ${isVolunteer && mobilePanel === "map" ? "hidden lg:block" : ""}`}>
    {account && (isVolunteer || account.role === "field_officer") && <SupplyRequestPanel />}
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{isVolunteer ? "Assigned tasks" : "Assignment details"}</h2><p className="volunteer-readable mt-1 text-sm text-slate-600">{isVolunteer ? "Your current work and updates from the response team." : "Your priorities, instructions, and field activity in one place."}</p></div><div className="flex flex-wrap items-center gap-2"><div role="group" aria-label="Filter assignments" className="flex rounded-lg border border-slate-200 bg-white p-1">{(["all", "active", "completed"] as const).map((filter) => <button key={filter} type="button" aria-pressed={taskFilter === filter} onClick={() => setTaskFilter(filter)} className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${taskFilter === filter ? isVolunteer ? "bg-teal-800 text-white shadow-sm" : "bg-sky-800 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}>{filter === "all" ? "All" : filter === "active" ? "Active" : "Completed"}</button>)}</div><span className={`rounded-full px-3 py-1.5 text-sm font-bold tabular-nums ${isVolunteer ? "bg-teal-100 text-teal-950" : "bg-sky-100 text-sky-950"}`}>{isVolunteer ? `${visibleTasks.length} shown · ${completedTasks.length} done` : `${visibleTasks.length} shown`}</span></div></div>
    {loading ? <p role="status" className="card p-5 text-base text-slate-600">Loading assignments…</p> : tasks.length === 0 ? <div className="card p-8 text-center text-base text-slate-600">{isVolunteer ? "No volunteer tasks have been assigned to your account yet. New assignments will be shown here." : "No assignments have been assigned to your account yet."}</div> : visibleTasks.length === 0 ? <div className="card p-8 text-center text-base text-slate-600">No {taskFilter} assignments.</div> : <div className="space-y-4">{visibleTasks.map((task) => <article key={task.id} className={`card min-w-0 overflow-hidden p-4 shadow-sm transition-shadow hover:shadow-md sm:p-6 ${task.status === "completed" ? "border-l-4 border-l-emerald-500" : task.status === "needs_help" ? "border-l-4 border-l-red-500" : isVolunteer ? "border-l-4 border-l-teal-600" : "border-l-4 border-l-sky-600"}`}><div className="flex min-w-0 flex-wrap justify-between gap-4"><div className="w-full min-w-0 flex-1 sm:w-auto"><div className="flex flex-wrap items-center gap-2"><span className={`badge px-3 py-1.5 text-sm ${task.status === "completed" ? "badge-success" : task.status === "needs_help" ? "badge-danger" : ["acknowledged", "en_route", "arrived"].includes(task.status) ? "badge-info" : "badge-warning"}`}>{task.status.replace(/_/g, " ")}</span>{task.priority_score != null && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-950">Priority {task.priority_score}</span>}</div><h3 className={`volunteer-task-title mt-3 break-words font-bold leading-snug text-slate-950 ${isVolunteer ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"}`}>{task.message}</h3><p className="volunteer-readable mt-2 break-all text-sm font-medium text-slate-700">{task.report_id ? `Report ${task.report_id}` : `Incident ${task.incident_id || "unavailable"}`}</p>{isVolunteer && <p className="mt-2 inline-flex rounded-lg bg-teal-50 px-3 py-2 text-base font-bold tabular-nums text-teal-950">Team staffing: {task.volunteers_assigned ?? 1} of {task.volunteers_needed ?? 1} volunteers</p>}{task.meeting_point && <p className="volunteer-readable mt-2 text-base text-slate-800"><strong>Meeting point:</strong> {task.meeting_point}</p>}
      <div className="mt-3 flex flex-wrap gap-2">{(task.shift_starts_at || task.shift_ends_at) && <span className="volunteer-date rounded-lg bg-amber-100 px-3 py-2 text-base font-bold tabular-nums text-amber-950"><strong>Shift:</strong> {task.shift_starts_at ? displayDate(task.shift_starts_at) : "Unspecified"}{task.shift_ends_at ? ` – ${displayDate(task.shift_ends_at)}` : ""}</span>}{task.dispatched_at && <span className="volunteer-date rounded-lg bg-sky-100 px-3 py-2 text-base font-bold tabular-nums text-sky-950"><strong>Assigned:</strong> {displayDate(task.dispatched_at)}</span>}{isVolunteer && task.checked_in_at && <span className="volunteer-date rounded-lg bg-emerald-100 px-3 py-2 text-base font-bold tabular-nums text-emerald-950"><strong>Checked in:</strong> {displayDate(task.checked_in_at)}{task.checked_out_at ? ` · Out ${displayDate(task.checked_out_at)}` : " · On shift"}</span>}</div>{task.lat != null && task.lon != null && <button type="button" onClick={() => { setFocusLocation({ lat: task.lat!, lon: task.lon! }); setMobilePanel("map"); }} className="mt-3 inline-block text-sm font-semibold text-blue-800 underline">Show task location on response map</button>}</div>
    <div className="flex w-full flex-wrap items-start gap-2 sm:w-auto">{task.status === "sent" && <button disabled={busyId === task.id} onClick={() => void acknowledge(task.id)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyId === task.id ? "Saving…" : "Accept task"}</button>}{["acknowledged", "needs_help"].includes(task.status) && <button disabled={busyId === task.id} onClick={() => void updateStatus(task, "en_route")} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">On my way</button>}{["en_route", "needs_help"].includes(task.status) && <button disabled={busyId === task.id} onClick={() => void updateStatus(task, "arrived")} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">I have arrived</button>}{task.status !== "completed" && task.status !== "needs_help" && task.status !== "sent" && <button disabled={busyId === task.id} onClick={() => void updateStatus(task, "needs_help")} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 disabled:opacity-50">Need help</button>}{isVolunteer && task.status !== "completed" && <button disabled={busyId === `sos-${task.id}`} onClick={() => void sendSOS(task)} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busyId === `sos-${task.id}` ? "Sending SOS…" : "SOS · Alert officials"}</button>}{isVolunteer && task.status !== "completed" && <a href="tel:112" className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-800">Call India emergency services (112)</a>}{isVolunteer && task.status !== "completed" && <button onClick={() => sharingTaskId === task.id ? void stopSharing() : startSharing(task)} className="rounded-lg border border-violet-300 px-4 py-2 text-sm font-semibold text-violet-800">{sharingTaskId === task.id ? "Stop location sharing" : "Share live location"}</button>}{isVolunteer && task.status !== "completed" && (task.shift_starts_at || task.shift_ends_at) && <>{!task.checked_in_at ? <button disabled={busyId === task.id} onClick={() => void shiftAction(task, "check-in")} className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50">Check in to shift</button> : !task.checked_out_at && <button disabled={busyId === task.id} onClick={() => void shiftAction(task, "check-out")} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Check out</button>}</>}</div></div>
      {task.instructions && <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3"><p className="text-sm font-semibold text-blue-950">Official instructions</p><p className="mt-1 whitespace-pre-wrap text-sm text-blue-900">{task.instructions}</p></div>}
      {((!isVolunteer && task.target_role === "field_officer" && (task.support_requests?.length || 0) > 0) || (isVolunteer && task.target_role === "volunteer" && task.support_request_id)) && <details open={task.status !== "completed"} className="mt-4 rounded-xl border border-violet-200 bg-violet-50/40 p-4"><summary className="cursor-pointer list-none font-semibold text-violet-950 marker:hidden">Volunteer support coordination <span className="ml-1 text-sm font-medium text-violet-800">{!isVolunteer ? `· ${task.support_requests?.length || 0} request${task.support_requests?.length === 1 ? "" : "s"}` : "· assigned support"}</span></summary>{!isVolunteer && task.target_role === "field_officer" && task.support_requests?.map((request) => <div key={request.id} className="mt-3 rounded-lg border border-violet-200 bg-white p-3"><p className="font-semibold text-violet-950">{request.support_type.replace(/_/g, " ")} support · {request.volunteers_assigned}/{request.volunteers_needed} assigned</p><p className="mt-1 text-sm text-violet-900">{request.details}</p>{request.location && <p className="mt-1 text-sm text-violet-900"><strong>Meet:</strong> {request.location}</p>}{request.volunteers.length > 0 && <p className="mt-1 text-sm text-violet-900">{request.volunteers.map((volunteer) => `${volunteer.name} (${volunteer.status.replace(/_/g, " ")})`).join(" · ")}</p>}<SupportConversation requestId={request.id} initialMessages={request.messages} /></div>)}{isVolunteer && task.target_role === "volunteer" && task.support_request_id && <SupportConversation requestId={task.support_request_id} initialMessages={task.support_request_messages} />}</details>}
      {!isVolunteer && task.target_role === "field_officer" && task.status !== "completed" && !(task.support_requests || []).some((request) => ["pending", "assigned"].includes(request.status)) && <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50/60 p-4"><h4 className="font-semibold text-violet-950">Request volunteer support</h4><p className="mt-1 text-sm text-slate-700">Ask officials to assign volunteers to this field operation. For immediate danger, use SOS.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Support type<select value={supportDrafts[task.id]?.support_type || "general"} onChange={(event) => setSupportDrafts((current) => ({ ...current, [task.id]: { support_type: event.target.value as "medical" | "rescue" | "logistics" | "general", volunteers_needed: current[task.id]?.volunteers_needed || 1, details: current[task.id]?.details || "", location: current[task.id]?.location || task.meeting_point || "" } }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="medical">Medical support</option><option value="rescue">Rescue support</option><option value="logistics">Logistics</option><option value="general">General assistance</option></select></label><label className="text-sm font-medium text-slate-700">Volunteers needed<input type="number" min={1} max={25} value={supportDrafts[task.id]?.volunteers_needed || 1} onChange={(event) => setSupportDrafts((current) => ({ ...current, [task.id]: { support_type: current[task.id]?.support_type || "general", volunteers_needed: Number(event.target.value), details: current[task.id]?.details || "", location: current[task.id]?.location || task.meeting_point || "" } }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-medium text-slate-700 sm:col-span-2">Reason and what volunteers should do<textarea required minLength={5} maxLength={2000} rows={2} value={supportDrafts[task.id]?.details || ""} onChange={(event) => setSupportDrafts((current) => ({ ...current, [task.id]: { support_type: current[task.id]?.support_type || "general", volunteers_needed: current[task.id]?.volunteers_needed || 1, details: event.target.value, location: current[task.id]?.location || task.meeting_point || "" } }))} placeholder="Several people need medical assistance. Please send a medical support team." className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-medium text-slate-700 sm:col-span-2">Meeting point / location<input maxLength={1000} value={supportDrafts[task.id]?.location || task.meeting_point || ""} onChange={(event) => setSupportDrafts((current) => ({ ...current, [task.id]: { support_type: current[task.id]?.support_type || "general", volunteers_needed: current[task.id]?.volunteers_needed || 1, details: current[task.id]?.details || "", location: event.target.value } }))} placeholder="Address or landmark for the support team" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label></div><button type="button" disabled={busyId === `support-${task.id}` || !supportDrafts[task.id]?.details?.trim()} onClick={() => void submitSupportRequest(task)} className="mt-3 rounded-lg bg-violet-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyId === `support-${task.id}` ? "Sending request…" : "Request volunteer support"}</button></div>}
      {task.updates?.length ? <details open={task.status !== "completed"} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"><summary className="cursor-pointer list-none font-semibold text-slate-800">Activity and official replies <span className="ml-1 text-sm font-medium text-slate-500">· {task.updates.length} update{task.updates.length === 1 ? "" : "s"}</span></summary><div className="mt-3 space-y-2">{task.updates.map((update) => <div key={update.id} className={`rounded-lg border bg-white p-3 ${update.kind === "blocker" ? "border-amber-300" : update.kind === "official_instruction" ? "border-blue-300" : update.kind === "completion" ? "border-emerald-300" : "border-slate-200"}`}><div className="flex flex-wrap justify-between gap-2"><strong className="text-sm text-slate-800">{update.author_name} · {update.kind.replace(/_/g, " ")}</strong><time className="text-xs text-slate-500">{displayDate(update.created_at)}</time></div><p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{update.note}</p>{update.remaining_work && <p className="mt-1 text-sm"><strong>Still needed:</strong> {update.remaining_work}</p>}{update.resources_used && <p className="mt-1 text-sm"><strong>Resources used:</strong> {update.resources_used}</p>}{update.media_id && <a href={`/api-bridge/api/media/${update.media_id}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-blue-700 underline">View attached photo</a>}</div>)}</div></details> : null}
      {task.status !== "completed" && <div className="mt-4 border-t border-slate-100 pt-4"><h4 className="text-sm font-semibold text-slate-900">Send an update to officials</h4><div className="mt-2 flex flex-wrap gap-2"><select aria-label="Update type" value={updateKinds[task.id] || "progress"} onChange={(event) => setUpdateKinds((current) => ({ ...current, [task.id]: event.target.value as "progress" | "blocker" }))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="progress">Progress update</option><option value="blocker">Blocker / need assistance</option></select><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" aria-label="Attach a photo" onChange={(event) => setUpdatePhotos((current) => ({ ...current, [task.id]: event.target.files?.[0] || null }))} className="min-w-0 max-w-full text-sm" /></div><textarea rows={2} maxLength={4000} value={updateNotes[task.id] || ""} onChange={(event) => setUpdateNotes((current) => ({ ...current, [task.id]: event.target.value }))} placeholder="Describe progress or explain what is blocking the work" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /><button type="button" disabled={busyId === `update-${task.id}` || !updateNotes[task.id]?.trim()} onClick={() => void submitUpdate(task)} className={`mt-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${updateKinds[task.id] === "blocker" ? "bg-amber-700" : "bg-blue-700"}`}>{busyId === `update-${task.id}` ? "Sending…" : updateKinds[task.id] === "blocker" ? "Send blocker" : "Send progress update"}</button></div>}
      {task.status === "arrived" && <div className="mt-4 border-t border-slate-100 pt-4"><label htmlFor={`completion-${task.id}`} className="block text-base font-semibold text-slate-900">Report completed work</label><p className="volunteer-readable mt-1 text-sm text-slate-700">Tell officials what you completed and anything that still needs attention.</p><textarea id={`completion-${task.id}`} rows={3} maxLength={4000} required value={completionNotes[task.id] || ""} onChange={(event) => setCompletionNotes((current) => ({ ...current, [task.id]: event.target.value }))} placeholder="Describe completed work" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base" /><div className="mt-2 grid gap-2 sm:grid-cols-2"><textarea rows={2} maxLength={2000} aria-label="Remaining work" value={completionRemaining[task.id] || ""} onChange={(event) => setCompletionRemaining((current) => ({ ...current, [task.id]: event.target.value }))} placeholder="Anything still needing attention? (optional)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /><textarea rows={2} maxLength={2000} aria-label="Resources used" value={completionResources[task.id] || ""} onChange={(event) => setCompletionResources((current) => ({ ...current, [task.id]: event.target.value }))} placeholder="Resources used (optional)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></div><label className="mt-2 block text-sm text-slate-700">Attach evidence photo (optional)<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" onChange={(event) => setCompletionPhotos((current) => ({ ...current, [task.id]: event.target.files?.[0] || null }))} className="mt-1 block max-w-full text-sm" /></label><button type="button" disabled={busyId === task.id || !completionNotes[task.id]?.trim()} onClick={() => void complete(task.id)} className="mt-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busyId === task.id ? "Submitting report…" : "Mark complete and send report"}</button></div>}
      {task.status === "completed" && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4"><p className="text-base font-bold text-emerald-950">Work report sent to officials</p><p className="volunteer-readable mt-1 whitespace-pre-wrap text-sm text-emerald-950">{task.completion_note}</p>{task.completed_at && <p className="mt-2 rounded-md bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-950">Submitted {displayDate(task.completed_at)}</p>}{task.completion_acknowledged_at ? <p role="status" className="mt-3 rounded-md bg-white p-3 text-sm font-bold text-emerald-950">Officials acknowledged your report · {displayDate(task.completion_acknowledged_at)}</p> : <p className="volunteer-readable mt-3 text-sm font-medium text-emerald-900">Waiting for an official to review and acknowledge this report. This page checks for updates automatically.</p>}</div>}</article>)}</div>}
    {isVolunteer && <p className="volunteer-readable text-sm text-slate-600">Task notices appear while this page is open. Live location is shared only after you start sharing, and officials can see updates from the last two minutes.</p>}
    </section>
    </div>
  </div></main>;
}
