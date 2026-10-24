"use client";

import { FormEvent, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { BrandMark, Waves } from "@/components/Brand";
import { ShelterFreshness } from "@/components/ShelterFreshness";
import { WeatherWatch } from "@/components/WeatherWatch";
import { getDrivingDirections, getPublicAlerts, getPublicShelters, submitPublicReport } from "@/lib/api";
import { Alert, DrivingDirections, Report, Shelter } from "@/lib/types";
import { useNavigation } from "@/lib/useNavigation";
import { nextRouteInstruction } from "@/lib/route-guidance";

const ResponseMap = dynamic(() => import("@/components/ResponseMap").then((m) => m.ResponseMap), {
  ssr: false,
  loading: () => <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-slate-500">Loading safety map…</div>,
});

const severity: Record<Alert["type"], string> = {
  evacuation: "border-red-600 bg-red-50 text-red-900",
  warning: "border-amber-500 bg-amber-50 text-amber-950",
  resupply: "border-blue-600 bg-blue-50 text-blue-900",
  all_clear: "border-emerald-600 bg-emerald-50 text-emerald-900",
};

export default function PublicPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [alertsError, setAlertsError] = useState("");
  const [sheltersError, setSheltersError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<Report["type"]>("flood");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(null);
  const [directions, setDirections] = useState<DrivingDirections | null>(null);
  const [routeShelterId, setRouteShelterId] = useState<string | null>(null);
  const [routeMessage, setRouteMessage] = useState("");
  const navigation = useNavigation(directions, alerts);
  const activeDirections = navigation.route;

  const refresh = async () => {
    setLoading(true);
    const [alertResult, shelterResult] = await Promise.allSettled([getPublicAlerts(), getPublicShelters()]);
    if (alertResult.status === "fulfilled") { setAlerts(alertResult.value); setAlertsError(""); }
    else setAlertsError(alertResult.reason instanceof Error ? alertResult.reason.message : "Alerts are temporarily unavailable.");
    if (shelterResult.status === "fulfilled") { setShelters(shelterResult.value); setSheltersError(""); }
    else setSheltersError(shelterResult.reason instanceof Error ? shelterResult.reason.message : "Shelters are temporarily unavailable.");
    setUpdatedAt(new Date());
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, []);

  const getLocation = () => {
    if (!navigator.geolocation) { setReportMessage("Location is not available. Enter coordinates below."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition((position) => {
      setLat(position.coords.latitude.toFixed(5)); setLon(position.coords.longitude.toFixed(5));
      setOrigin({ lat: position.coords.latitude, lon: position.coords.longitude });
      setLocating(false); setReportMessage("");
    }, () => { setLocating(false); setReportMessage("Could not get your location. You can enter coordinates manually."); }, { timeout: 10000 });
  };

  const showRoute = async (shelter: Shelter) => {
    if (!origin) { setRouteMessage("Use your location in the incident form above to get a route from where you are."); return; }
    setRouteShelterId(shelter.id); setRouteMessage(""); setDirections(null);
    navigation.stop();
    try {
      const hazards = alerts.filter((alert) => (alert.type === "evacuation" || alert.type === "warning") && alert.lat != null && alert.lon != null).map((alert) => ({ lat: alert.lat!, lon: alert.lon! }));
      const route = await getDrivingDirections(origin, { lat: shelter.lat, lon: shelter.lon }, hazards);
      if (!route.route_found) throw new Error("A driving route is not available for this location right now.");
      setDirections(route);
    } catch (error) { setRouteMessage(error instanceof Error ? error.message : "Could not load directions. Please try again."); }
    finally { setRouteShelterId(null); }
  };

  const routeAlert = activeDirections && alerts.find((alert) => (alert.type === "evacuation" || alert.type === "warning") && alert.lat != null && alert.lon != null && activeDirections.coordinates.some(([routeLon, routeLat]) => {
    const radians = (degrees: number) => degrees * Math.PI / 180;
    const dLat = radians(alert.lat! - routeLat); const dLon = radians(alert.lon! - routeLon);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(routeLat)) * Math.cos(radians(alert.lat!)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= 0.75;
  }));

  const sendReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSubmitting(true); setReportMessage("");
    try {
      await submitPublicReport({ type, description: description.trim(), location: { lat: Number(lat), lon: Number(lon) }, website });
      setDescription(""); setReportMessage("Report received. Response teams can now review it.");
    } catch (error) { setReportMessage(error instanceof Error ? error.message : "Could not send your report. Please try again."); }
    finally { setSubmitting(false); }
  };

  const openShelters = shelters.filter((s) => s.status === "open");
  const availablePlaces = openShelters.reduce((total, shelter) => total + shelter.available_capacity, 0);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="gradient-primary text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/public" className="inline-flex items-center gap-2.5"><BrandMark /><span className="font-display text-lg font-bold">Suraksha Setu</span></Link>
          <Link href="/login" className="rounded-lg border border-white/40 px-4 py-2 text-sm font-semibold hover:bg-white/10">Staff sign in</Link>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-7 sm:pb-12">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-100">Public safety dashboard</p>
          <h1 className="mt-2 max-w-3xl font-display text-3xl font-extrabold leading-tight sm:text-5xl">Get help. Find safety. Share what’s happening.</h1>
          <p className="mt-4 max-w-2xl text-blue-100">Current alerts and shelter information from Suraksha Setu. In immediate danger, call emergency services.</p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <a href="tel:112" className="inline-flex rounded-xl bg-saffron px-6 py-3 font-bold text-ink hover:brightness-105">Call 112</a>
            <span className="text-sm text-blue-100">India emergency number</span>
          </div>
        </div><Waves />
      </header>

      <div className="mx-auto max-w-6xl space-y-9 px-4 py-8">
        <section aria-labelledby="status-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div><h2 id="status-heading" className="font-display text-xl font-bold">Situation now</h2><p className="mt-1 text-sm text-slate-500">{updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : "Loading latest information…"}</p></div>
            <button onClick={() => void refresh()} disabled={loading} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">{loading ? "Refreshing…" : "Refresh"}</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="card p-4"><p className="text-sm text-slate-500">Urgent alerts</p><p className="mt-1 font-display text-3xl font-bold text-red-700">{alerts.filter((a) => a.type === "evacuation").length}</p></div>
            <div className="card p-4"><p className="text-sm text-slate-500">Open shelters</p><p className="mt-1 font-display text-3xl font-bold text-emerald-700">{sheltersError ? "—" : openShelters.length}</p></div>
            <div className="card p-4"><p className="text-sm text-slate-500">Available places at open shelters</p><p className="mt-1 font-display text-3xl font-bold text-blue-800">{sheltersError ? "—" : availablePlaces}</p></div>
          </div>
        </section>

        <WeatherWatch />

        <section aria-labelledby="alerts-heading">
          <h2 id="alerts-heading" className="mb-3 font-display text-xl font-bold">Safety alerts</h2>
          {alertsError && <div role="status" className="card p-4 text-amber-900">{alertsError}</div>}
          {!alertsError && !loading && alerts.length === 0 && <div className="card p-4 text-slate-600">No alerts have been published. Keep following local authority guidance.</div>}
          <div className="space-y-3">{alerts.map((alert) => <article key={alert.id} className={`rounded-xl border-l-4 p-4 ${severity[alert.type]}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-bold capitalize">{alert.type.replaceAll("_", " ")}</h3><div className="flex flex-wrap gap-x-3 text-xs"><time>{alert.sent_at ? `Issued ${new Date(alert.sent_at).toLocaleString()}` : "Time not provided"}</time>{alert.active_until && <time>Active until {new Date(alert.active_until).toLocaleString()}</time>}</div></div>
            <p className="mt-1">{alert.message}</p>{alert.language && alert.language !== "en" && <p className="mt-1 text-xs">Language: {alert.language}</p>}
          </article>)}</div>
        </section>

        <section aria-labelledby="map-heading">
          <div className="mb-3"><h2 id="map-heading" className="font-display text-xl font-bold">Safety map</h2><p className="mt-1 text-sm text-slate-500">Shelters and alert locations. Select a shelter marker for availability details.</p></div>
          <div className="card h-[50vh] min-h-[320px] overflow-hidden p-2"><ResponseMap alerts={alerts} shelters={shelters} showAlerts showShelters routeCoordinates={activeDirections?.coordinates.map(([lon, lat]) => [lat, lon] as [number, number])} currentPosition={navigation.position ? [navigation.position.lat, navigation.position.lon] : null} followPosition={navigation.active} /></div>
          {routeMessage && <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{routeMessage}</p>}
          {activeDirections && <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-4"><h3 className="font-semibold text-sky-950">Suggested route · {activeDirections.distance_km} km · about {activeDirections.duration_min} min</h3><p className="mt-1 text-sm text-sky-900">Where alternatives are available, this route prefers roads farther from currently mapped evacuation and warning alerts. Alerts may be missing or outdated, and roads can change; this route cannot guarantee safety. Check alerts and follow local authorities. If accurate GPS places you over 150 m off route twice, up to three reroutes may send your current location to OSRM.</p>{routeAlert && <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">Caution: a mapped {routeAlert.type.replace(/_/g, " ")} alert is close to this route. Check its details before travelling.</p>}<div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" onClick={navigation.active ? navigation.stop : navigation.start} className={`rounded-lg px-4 py-2.5 text-sm font-bold text-white ${navigation.active ? "bg-slate-700 hover:bg-slate-800" : "bg-emerald-700 hover:bg-emerald-800"}`}>{navigation.active ? "Stop navigation" : "Start navigation"}</button>{navigation.active && <span className="text-sm font-semibold text-emerald-800">Navigation active · keep this page open</span>}</div>{navigation.rerouting && <p role="status" className="mt-2 text-sm font-semibold text-blue-900">Off route · recalculating from your current location…</p>}{navigation.rerouteNotice && <p role="status" className="mt-2 text-sm text-emerald-900">{navigation.rerouteNotice}</p>}{navigation.error && <p role="status" className="mt-2 text-sm text-amber-900">{navigation.error}</p>}{navigation.active && nextRouteInstruction(activeDirections, navigation.position) && <p aria-live="polite" className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 font-semibold text-blue-950">Next: {nextRouteInstruction(activeDirections, navigation.position)?.instruction}</p>}{activeDirections.steps.length > 0 && <ol className="mt-3 max-h-56 list-decimal space-y-1 overflow-auto pl-5 text-sm text-slate-800">{activeDirections.steps.map((step, index) => <li key={`${index}-${step.instruction}`} aria-current={navigation.active && nextRouteInstruction(activeDirections, navigation.position) === step ? "step" : undefined}>{step.instruction} <span className="text-slate-500">({step.distance_km} km)</span></li>)}</ol>}</div>}
          <p className="mt-2 text-xs text-slate-500">Map data © OpenStreetMap contributors. Map tiles need an internet connection.</p>
        </section>

        <section aria-labelledby="shelters-heading">
          <h2 id="shelters-heading" className="mb-3 font-display text-xl font-bold">Open shelters</h2>
          {sheltersError && <div role="status" className="card p-4 text-amber-900">{sheltersError}</div>}
          {!sheltersError && !loading && openShelters.length === 0 && <div className="card p-4 text-slate-600">No open shelters are listed right now. Call 112 if you need immediate assistance.</div>}
          <div className="grid gap-3 md:grid-cols-2">{openShelters.map((shelter) => <article key={shelter.id} className="card p-4">
            <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{shelter.name}</h3><p className="mt-1 text-sm text-emerald-800">{shelter.available_capacity} places available</p><p className="mt-1 text-xs text-slate-500">Coordinates: {shelter.lat.toFixed(5)}, {shelter.lon.toFixed(5)}</p></div><span className="badge badge-success">Open</span></div>
            <ShelterFreshness updatedAt={shelter.updated_at} />
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">{shelter.has_medical && <span className="rounded-full bg-blue-50 px-2 py-1">Medical support</span>}{shelter.has_electricity && <span className="rounded-full bg-amber-50 px-2 py-1">Electricity</span>}</div>
            <p className="mt-2 text-xs text-slate-500">Route search sends your chosen location and these shelter coordinates to OSRM. Coordinates remain available above if directions cannot load.</p>
            <button type="button" onClick={() => void showRoute(shelter)} disabled={routeShelterId === shelter.id && !directions} className="mt-3 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{routeShelterId === shelter.id && !directions ? "Loading route…" : "Show route on map"}</button>
          </article>)}</div>
        </section>

        <section aria-labelledby="report-heading" className="card p-5 sm:p-6">
          <h2 id="report-heading" className="font-display text-xl font-bold">Report an incident</h2>
          <p className="mt-1 text-sm text-slate-600">Reports are unverified tips. Response teams review them before they are treated as confirmed incidents. For urgent rescue, call 112.</p>
          <form onSubmit={sendReport} className="mt-5 grid gap-4 sm:grid-cols-2">
            <label aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">Leave this field empty<input name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
            <label className="text-sm font-semibold text-slate-800">Incident type<select value={type} onChange={(e) => setType(e.target.value as Report["type"])} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-3"><option value="flood">Flooding</option><option value="road_block">Road blocked</option><option value="medical">Medical emergency</option><option value="other">Other</option></select></label>
            <div className="flex items-end"><button type="button" onClick={getLocation} disabled={locating} className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50">{locating ? "Getting location…" : "Use my location"}</button></div>
            <label className="text-sm font-semibold text-slate-800">Latitude<input required type="number" step="any" min="-90" max="90" value={lat} onChange={(e) => setLat(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 p-3" placeholder="e.g. 23.0225" /></label>
            <label className="text-sm font-semibold text-slate-800">Longitude<input required type="number" step="any" min="-180" max="180" value={lon} onChange={(e) => setLon(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 p-3" placeholder="e.g. 72.5714" /></label>
            <label className="text-sm font-semibold text-slate-800 sm:col-span-2">What is happening?<textarea required minLength={1} maxLength={5000} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 p-3" placeholder="Describe the location and what help is needed." /></label>
            <div className="sm:col-span-2"><button type="submit" disabled={submitting} className="rounded-lg bg-ink px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{submitting ? "Sending…" : "Submit report"}</button>{reportMessage && <p role="status" className="mt-3 text-sm text-slate-700">{reportMessage}</p>}</div>
          </form>
        </section>

        <footer className="pb-4 text-sm text-slate-500">For immediate danger, call 112. Follow directions from local emergency authorities. If data does not load, use official local emergency channels.</footer>
      </div>
    </main>
  );
}
