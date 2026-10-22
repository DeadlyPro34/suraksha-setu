"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { getMapAlerts, getShelters, getVolunteerLocations, getVolunteerSafetyEvents, getVolunteerTasks } from "@/lib/api";
import { Alert, Dispatch, Shelter, VolunteerLocation, VolunteerSafetyEvent } from "@/lib/types";

const ResponseMap = dynamic(() => import("@/components/ResponseMap").then((module) => module.ResponseMap), {
  ssr: false,
  loading: () => <div className="flex min-h-[440px] items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">Loading map…</div>,
});

export default function MapPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [volunteerLocations, setVolunteerLocations] = useState<VolunteerLocation[]>([]);
  const [taskLocations, setTaskLocations] = useState<Dispatch[]>([]);
  const [safetyEvents, setSafetyEvents] = useState<VolunteerSafetyEvent[]>([]);
  const [showAlerts, setShowAlerts] = useState(true);
  const [showShelters, setShowShelters] = useState(true);
  const [showVolunteers, setShowVolunteers] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [alertResult, shelterResult, volunteerResult, taskResult, safetyResult] = await Promise.allSettled([getMapAlerts(), getShelters(), getVolunteerLocations(), getVolunteerTasks(), getVolunteerSafetyEvents()]);
    if (alertResult.status === "fulfilled") setAlerts(alertResult.value);
    if (shelterResult.status === "fulfilled") setShelters(shelterResult.value);
    if (volunteerResult.status === "fulfilled") setVolunteerLocations(volunteerResult.value);
    else setVolunteerLocations([]);
    if (taskResult.status === "fulfilled") setTaskLocations(taskResult.value.filter((task) => task.target_role === "volunteer" && task.status !== "completed"));
    if (safetyResult.status === "fulfilled") setSafetyEvents(safetyResult.value);
    const failed = [alertResult, shelterResult].filter((result) => result.status === "rejected");
    if (failed.length) setError("Some map data could not be loaded. Check your connection and try again.");
    setLoading(false);
  }, []);

  useEffect(() => { void load(); const timer = window.setInterval(() => { Promise.all([getVolunteerLocations(), getVolunteerSafetyEvents()]).then(([locations, events]) => { setVolunteerLocations(locations); setSafetyEvents(events); }).catch(() => undefined); }, 15000); return () => window.clearInterval(timer); }, [load]);

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-lg font-bold text-slate-900">Response map</h2><p className="mt-1 text-sm text-slate-500">Explore active alerts and shelter availability by location.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{loading ? "Refreshing…" : "Refresh map"}</button>
    </div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="card min-w-0 p-2 sm:p-3" aria-label="Map showing alerts and shelters">
        {error && <p role="alert" className="m-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
        <div className="h-[62vh] min-h-[440px] overflow-hidden rounded-xl"><ResponseMap alerts={alerts} shelters={shelters} showAlerts={showAlerts} showShelters={showShelters} volunteerLocations={volunteerLocations} showVolunteers={showVolunteers} taskLocations={taskLocations} showTasks={showTasks} safetyEvents={safetyEvents} showSafetyEvents /></div>
        <p className="px-2 pb-1 pt-2 text-xs text-slate-500">Map data © OpenStreetMap contributors</p>
      </section>
      <aside className="space-y-4">
        <section className="card p-4"><h3 className="font-semibold text-slate-900">Map layers</h3>
          <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={showAlerts} onChange={(event) => setShowAlerts(event.target.checked)} className="h-4 w-4 accent-red-600" /><span className="h-3 w-3 rounded-full bg-red-600" /> Alerts ({alerts.filter((alert) => alert.lat != null).length})</label>
          <label className="mt-3 flex cursor-pointer items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={showShelters} onChange={(event) => setShowShelters(event.target.checked)} className="h-4 w-4 accent-emerald-600" /><span className="h-3 w-3 rounded-full bg-emerald-600" /> Shelters ({shelters.length})</label>
          <label className="mt-3 flex cursor-pointer items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={showVolunteers} onChange={(event) => setShowVolunteers(event.target.checked)} className="h-4 w-4 accent-violet-600" /><span className="h-3 w-3 rounded-full bg-violet-600" /> Sharing volunteers ({volunteerLocations.length})</label>
          <label className="mt-3 flex cursor-pointer items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={showTasks} onChange={(event) => setShowTasks(event.target.checked)} className="h-4 w-4 accent-cyan-600" /><span className="h-3 w-3 rounded-full bg-cyan-600" /> Volunteer tasks ({taskLocations.filter((task) => task.lat != null).length})</label>
          <p className="mt-3 text-sm font-medium text-red-800">Safety alerts: {safetyEvents.length}</p>
          <p className="mt-3 text-xs text-slate-500">Volunteer locations appear only while the volunteer has opted in. Locations older than two minutes are hidden.</p>
        </section>
        <section className="card p-4"><h3 className="font-semibold text-slate-900">Legend</h3><ul className="mt-3 space-y-2 text-sm text-slate-600"><li>🔴 Evacuation alerts</li><li>🟠 Warnings</li><li>🔵 Resupply alerts</li><li>🟢 Open shelters</li><li>🟠 Full shelters</li><li>⚫ Closed shelters</li></ul></section>
        <section className="card p-4"><h3 className="font-semibold text-slate-900">On the map</h3><p className="mt-2 text-sm text-slate-600">{loading ? "Loading locations…" : `${alerts.filter((alert) => alert.lat != null).length} mapped alerts, ${shelters.length} shelters, ${volunteerLocations.length} volunteers sharing, ${safetyEvents.length} safety alerts`}</p><p className="mt-2 text-xs text-slate-500">Select a marker to see details. Use the map controls or scroll to zoom.</p></section>
      </aside>
    </div>
  </div>;
}
