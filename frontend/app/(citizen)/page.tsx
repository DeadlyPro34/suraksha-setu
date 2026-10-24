"use client";

import { useState, useEffect, ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { checkHealth, getCitizenAlerts, getDrivingDirections, getNearbyShelters, getMyReports, getShelters } from "@/lib/api";
import { Alert, DrivingDirections, NearbyShelter, Report, Shelter } from "@/lib/types";
import { BrandMark, Waves } from "@/components/Brand";
import { ShelterFreshness } from "@/components/ShelterFreshness";
import { WeatherWatch } from "@/components/WeatherWatch";
import { useNavigation } from "@/lib/useNavigation";
import { nextRouteInstruction } from "@/lib/route-guidance";

const ResponseMap = dynamic(() => import("@/components/ResponseMap").then((module) => module.ResponseMap), {
  ssr: false,
  loading: () => <div className="flex min-h-[360px] items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">Loading safety map…</div>,
});

const Icon = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

const ACTIONS = [
  { label: "Report an incident", desc: "Add your location and what you see", href: "/report", tone: "text-alarm bg-red-50",
    icon: <Icon><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 10v4M12 17.2v.1" /></Icon> },
  { label: "Find a shelter", desc: "Nearest open shelters and free beds", href: "#nearby-shelters", tone: "text-blue-700 bg-blue-50",
    icon: <Icon><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v10h13V10M10 20v-5h4v5" /></Icon> },
  { label: "Read alerts", desc: "Warnings and evacuation notices", href: "#alerts", tone: "text-saffron-dark bg-amber-50",
    icon: <Icon><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" /><path d="M10 21h4" /></Icon> },
  { label: "Open safety map", desc: "See alerts and shelters on a map", href: "#safety-map", tone: "text-emerald-700 bg-emerald-50",
    icon: <Icon><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z" /><path d="M9 4v14M15 6v14" /></Icon> },
  { label: "Call 112", desc: "Reach emergency services now", href: "tel:112", tone: "text-emerald-700 bg-emerald-50",
    icon: <Icon><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></Icon> },
];

const SEVERITY: Record<Alert["type"], { stripe: string; label: string }> = {
  evacuation: { stripe: "border-l-alarm", label: "Evacuate now" },
  warning: { stripe: "border-l-saffron", label: "Warning" },
  resupply: { stripe: "border-l-blue-500", label: "Supplies" },
  all_clear: { stripe: "border-l-emerald-600", label: "All clear" },
};

const errText = (r: PromiseRejectedResult, fallback: string) => (r.reason instanceof Error ? r.reason.message : fallback);

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function CitizenHome() {
  const [backendUp, setBackendUp] = useState<boolean | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [nearbyShelters, setNearbyShelters] = useState<NearbyShelter[]>([]);
  const [citizenLocation, setCitizenLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [findingNearby, setFindingNearby] = useState(false);
  const [directions, setDirections] = useState<DrivingDirections | null>(null);
  const [routeShelterId, setRouteShelterId] = useState<string | null>(null);
  const [routeMessage, setRouteMessage] = useState<string | null>(null);
  const navigation = useNavigation(directions, alerts);
  const activeDirections = navigation.route;
  const [loading, setLoading] = useState(true);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [sheltersError, setSheltersError] = useState<string | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    checkHealth().then(() => { if (active) setBackendUp(true); }).catch(() => { if (active) setBackendUp(false); });
    Promise.allSettled([getMyReports(10), getCitizenAlerts(100), getShelters(200)]).then(([rep, alr, shl]) => {
      if (!active) return;
      if (rep.status === "fulfilled") setReports(rep.value); else setReportsError(errText(rep, "Could not load reports."));
      if (alr.status === "fulfilled") setAlerts(alr.value); else setAlertsError(errText(alr, "Could not load alerts."));
      if (shl.status === "fulfilled") setShelters(shl.value); else setSheltersError(errText(shl, "Could not load shelters."));
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const findNearbyHelp = () => {
    if (!navigator.geolocation) {
      setLocationMessage("Location is unavailable in this browser. You can still browse all alerts and shelters.");
      return;
    }
    setFindingNearby(true);
    setLocationMessage(null);
    navigator.geolocation.getCurrentPosition(async (position) => {
      const location = { lat: position.coords.latitude, lon: position.coords.longitude };
      setCitizenLocation(location);
      try {
        const nearby = await getNearbyShelters(location.lat, location.lon);
        setNearbyShelters(nearby);
        setLocationMessage(null);
      } catch (error) {
        setLocationMessage(error instanceof Error ? error.message : "Could not load nearby shelters.");
      } finally {
        setFindingNearby(false);
      }
    }, () => {
      setFindingNearby(false);
      setLocationMessage("Could not access your location. Allow location access or continue browsing all alerts and shelters.");
    }, { timeout: 10000, maximumAge: 60000 });
  };

  const showRoute = async (shelter: NearbyShelter) => {
    if (!citizenLocation) {
      setRouteMessage("Use your location above to get a route from where you are.");
      document.getElementById("safety-map")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setRouteShelterId(shelter.id);
    setRouteMessage(null);
    setDirections(null);
    navigation.stop();
    document.getElementById("safety-map")?.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const hazards = alerts.filter((alert) => (alert.type === "evacuation" || alert.type === "warning") && alert.lat != null && alert.lon != null).map((alert) => ({ lat: alert.lat!, lon: alert.lon! }));
      const result = await getDrivingDirections(citizenLocation, { lat: shelter.lat, lon: shelter.lon }, hazards);
      if (!result.route_found) throw new Error("A driving route is not available for this location right now.");
      setDirections(result);
    } catch (error) {
      setRouteMessage(error instanceof Error ? error.message : "Could not load directions. Please try again.");
    } finally {
      setRouteShelterId(null);
    }
  };

  const activeAlertCount = alerts.filter((a) => a.type !== "all_clear").length;
  const openShelterCount = shelters.filter((s) => s.status === "open").length;
  const nearbyAlerts = citizenLocation
    ? alerts.filter((alert) => alert.lat != null && alert.lon != null && distanceKm(citizenLocation.lat, citizenLocation.lon, alert.lat, alert.lon) <= 50)
    : alerts;
  const otherAlerts = citizenLocation
    ? alerts.filter((alert) => !nearbyAlerts.includes(alert))
    : [];
  const prioritizedNearbyShelters = [...nearbyShelters].sort((a, b) => {
    const aOpen = a.status === "open" && a.available_capacity > 0 ? 0 : 1;
    const bOpen = b.status === "open" && b.available_capacity > 0 ? 0 : 1;
    return aOpen - bOpen || a.distance_km - b.distance_km;
  });
  const routeAlert = activeDirections && alerts.find((alert) => (alert.type === "evacuation" || alert.type === "warning") && alert.lat != null && alert.lon != null && activeDirections.coordinates.some(([lon, lat]) => distanceKm(alert.lat!, alert.lon!, lat, lon) <= 0.75));
  const val = (isLoading: boolean, err: string | null, n: number) => (isLoading ? "…" : err ? "—" : n);

  const stats = [
    { n: val(loading, alertsError, activeAlertCount), label: "active alerts" },
    { n: val(loading, sheltersError, openShelterCount), label: "shelters open" },
    { n: val(loading, reportsError, reports.length), label: "recent reports" },
  ];

  return (
    <div className="min-h-screen">
      <header className="gradient-primary text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <span className="font-display text-lg font-bold">Suraksha Setu</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-sm text-blue-100">
              <span className={`w-2 h-2 rounded-full ${backendUp ? "bg-emerald-400 animate-pulse-dot" : backendUp === false ? "bg-red-400" : "bg-slate-400"}`} />
              {backendUp ? "Live" : backendUp === false ? "Offline" : "Connecting"}
            </span>
            <button onClick={() => { window.localStorage.removeItem("access_token"); window.location.assign("/login"); }} className="text-sm font-semibold px-3.5 py-1.5 rounded-lg border border-white/30 hover:bg-white/10">Sign out</button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 pt-8 pb-10 sm:pt-14 sm:pb-16 animate-fade-in">
          <h1 className="font-display text-3xl sm:text-5xl font-extrabold leading-[1.08] max-w-2xl">
            Know what is happening near you. Reach safety faster.
          </h1>
          <p className="mt-4 text-blue-100 max-w-xl text-base sm:text-lg">
            {backendUp === false
              ? "We can't reach live records right now. If you are in danger, call 112."
              : "Alerts, open shelters and citizen reports from your area, in one place."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/report" className="px-5 py-3 rounded-xl bg-saffron text-ink font-bold hover:brightness-105">Report an incident</Link>
            <a href="tel:112" className="px-5 py-3 rounded-xl border border-white/40 font-semibold hover:bg-white/10">Call 112</a>
          </div>
          <dl className="mt-8 grid grid-cols-3 max-w-xl rounded-xl bg-white/10 divide-x divide-white/15">
            {stats.map((s) => (
              <div key={s.label} className="px-4 py-3">
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-display text-2xl sm:text-3xl font-bold">{s.n}</dd>
                <dd className="text-xs sm:text-sm text-blue-100">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Waves />
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        <section aria-labelledby="actions-h">
          <h2 id="actions-h" className="font-display text-xl font-bold mb-3">What do you need?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ACTIONS.map((a) => (
              <Link key={a.label} href={a.href} className="card card-interactive p-4 flex sm:block items-center gap-4">
                <span className={`inline-flex items-center justify-center w-11 h-11 rounded-lg shrink-0 ${a.tone}`}>{a.icon}</span>
                <span className="block sm:mt-3">
                  <span className="block font-semibold text-slate-900">{a.label}</span>
                  <span className="block text-sm text-slate-500 mt-0.5">{a.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Find nearby safety information">
          <div>
            <h2 className="font-display text-lg font-bold">Find help near you</h2>
            <p className="mt-1 text-sm text-slate-600">Share your location to highlight alerts within 50 km and sort nearby shelters. If you request directions, your start and destination go to OSRM; live GPS is sent only when an automatic reroute is requested.</p>
            {citizenLocation && <p className="mt-1 text-xs text-emerald-800">Using your current location · {citizenLocation.lat.toFixed(3)}, {citizenLocation.lon.toFixed(3)}</p>}
            {locationMessage && <p role="status" className="mt-1 text-sm text-amber-800">{locationMessage}</p>}
          </div>
          <button type="button" onClick={findNearbyHelp} disabled={findingNearby} className="shrink-0 rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
            {findingNearby ? "Finding nearby help…" : citizenLocation ? "Refresh my location" : "Use my location"}
          </button>
        </section>

        <WeatherWatch location={citizenLocation} />

        <section id="nearby-shelters" aria-labelledby="nearby-shelters-h" className="scroll-mt-4">
          <div className="mb-3"><h2 id="nearby-shelters-h" className="font-display text-xl font-bold">Nearest shelters</h2><p className="mt-1 text-sm text-slate-500">Sorted by distance. Check availability before travelling.</p></div>
          {!citizenLocation && <p className="card p-4 text-slate-600">Use “Find help near you” above to sort shelters by distance. You can also <Link href="/shelters" className="font-semibold text-blue-700 hover:underline">browse shelters</Link> without sharing your location.</p>}
          {findingNearby && <p role="status" className="card p-4 text-slate-600">Finding nearby shelters…</p>}
          {citizenLocation && !findingNearby && nearbyShelters.length === 0 && <p className="card p-4 text-slate-600">No shelters are listed yet.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {prioritizedNearbyShelters.slice(0, 4).map((shelter) => <article key={shelter.id} className="card p-4">
              <div className="flex items-start justify-between gap-3"><h3 className="font-semibold text-slate-900">{shelter.name}</h3><span className={`badge ${shelter.status === "open" ? "badge-success" : shelter.status === "full" ? "badge-danger" : "badge-neutral"}`}>{shelter.status}</span></div>
              <p className="mt-1 text-sm text-slate-600">{shelter.distance_km.toFixed(1)} km away</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{shelter.available_capacity} places available</p>
              <ShelterFreshness updatedAt={shelter.updated_at} />
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">{shelter.has_medical && <span className="rounded-full bg-blue-50 px-2 py-1">Medical support</span>}{shelter.has_electricity && <span className="rounded-full bg-amber-50 px-2 py-1">Electricity</span>}</div>
              <button type="button" onClick={() => void showRoute(shelter)} disabled={routeShelterId !== null && !directions} className="mt-3 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{routeShelterId === shelter.id && !directions ? "Loading route…" : "Show route on map"}</button>
            </article>)}
          </div>
        </section>

        <section id="safety-map" aria-labelledby="safety-map-h" className="scroll-mt-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div><h2 id="safety-map-h" className="font-display text-xl font-bold">Safety map</h2><p className="mt-1 text-sm text-slate-500">Active alerts and registered shelters near their actual locations.</p></div>
            <span className="text-xs text-slate-500">Tap a marker for details</span>
          </div>
          {routeShelterId && <p role="status" className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Calculating route to {prioritizedNearbyShelters.find((shelter) => shelter.id === routeShelterId)?.name || "shelter"}…</p>}
          <div className="card overflow-hidden p-2 sm:p-3">
            <div className="h-[50vh] min-h-[360px] overflow-hidden rounded-xl">
              <ResponseMap alerts={alerts} shelters={shelters} showAlerts showShelters routeCoordinates={activeDirections?.coordinates.map(([lon, lat]) => [lat, lon] as [number, number])} currentPosition={navigation.position ? [navigation.position.lat, navigation.position.lon] : null} followPosition={navigation.active} />
            </div>
            <p className="px-2 pb-1 pt-2 text-xs text-slate-500">Map data © OpenStreetMap contributors · {alerts.filter((alert) => alert.lat != null).length} mapped alerts · {shelters.length} shelters</p>
          </div>
          {routeMessage && <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{routeMessage}</p>}
          {activeDirections && <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-4">
            <h3 className="font-semibold text-sky-950">Suggested route · {activeDirections.distance_km} km · about {activeDirections.duration_min} min</h3>
            <p className="mt-1 text-sm text-sky-900">Where alternatives are available, this route prefers roads farther from currently mapped evacuation and warning alerts. Alerts may be missing or outdated, and roads can change; this route cannot guarantee safety. Check alerts and follow local authorities. If accurate GPS places you over 150 m off route twice, up to three reroutes may send your current location to OSRM.</p>
            {routeAlert && <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">Caution: a mapped {routeAlert.type.replace(/_/g, " ")} alert is close to this route. Check its details before travelling.</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" onClick={navigation.active ? navigation.stop : navigation.start} className={`rounded-lg px-4 py-2.5 text-sm font-bold text-white ${navigation.active ? "bg-slate-700 hover:bg-slate-800" : "bg-emerald-700 hover:bg-emerald-800"}`}>{navigation.active ? "Stop navigation" : "Start navigation"}</button>{navigation.active && <span className="text-sm font-semibold text-emerald-800">Navigation active · keep this page open</span>}</div>
            {navigation.rerouting && <p role="status" className="mt-2 text-sm font-semibold text-blue-900">Off route · recalculating from your current location…</p>}
            {navigation.rerouteNotice && <p role="status" className="mt-2 text-sm text-emerald-900">{navigation.rerouteNotice}</p>}
            {navigation.error && <p role="status" className="mt-2 text-sm text-amber-900">{navigation.error}</p>}
            {navigation.active && nextRouteInstruction(activeDirections, navigation.position) && <p aria-live="polite" className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 font-semibold text-blue-950">Next: {nextRouteInstruction(activeDirections, navigation.position)?.instruction}</p>}
            {activeDirections.steps.length > 0 && <ol className="mt-3 max-h-56 list-decimal space-y-1 overflow-auto pl-5 text-sm text-slate-800">{activeDirections.steps.map((step, index) => <li key={`${index}-${step.instruction}`} aria-current={navigation.active && nextRouteInstruction(activeDirections, navigation.position) === step ? "step" : undefined}>{step.instruction} <span className="text-slate-500">({step.distance_km} km)</span></li>)}</ol>}
          </div>}
          {(alertsError || sheltersError) && <p role="status" className="mt-2 text-sm text-amber-800">Some map locations may be unavailable while data is loading.</p>}
        </section>

        <section id="alerts" aria-labelledby="alerts-h" className="scroll-mt-4">
          <h2 id="alerts-h" className="font-display text-xl font-bold mb-3">{citizenLocation ? "Alerts near you" : "Alerts"}</h2>
          {citizenLocation && <p className="mb-3 text-sm text-slate-500">Showing alerts within 50 km. Alerts without a mapped location or farther away are listed below.</p>}
          <div className="space-y-2">
            {loading && <div role="status" className="card p-4 text-slate-500">Loading alerts…</div>}
            {alertsError && <div role="alert" className="card p-4 text-red-700">Could not load alerts: {alertsError}</div>}
            {!loading && !alertsError && nearbyAlerts.length === 0 && <div className="card p-4 text-slate-500">No mapped alerts within 50 km right now.</div>}
            {nearbyAlerts.map((alert) => {
              const sev = SEVERITY[alert.type];
              return (
                <article key={alert.id} className={`card border-l-4 ${sev.stripe} p-4`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-semibold text-slate-900">{sev.label}</h3>
                    <time className="text-xs text-slate-500 shrink-0">{alert.sent_at ? `Issued ${new Date(alert.sent_at).toLocaleString()}` : "Issue time unavailable"}</time>
                  </div>
                  <p className="text-slate-600 mt-1">{alert.message}</p>
                  {alert.active_until && <p className="mt-1 text-xs text-slate-500">Active until {new Date(alert.active_until).toLocaleString()}</p>}
                </article>
              );
            })}
          </div>
          {otherAlerts.length > 0 && <details className="mt-4 rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-semibold text-slate-800">Other active alerts ({otherAlerts.length})</summary><div className="mt-3 space-y-2">{otherAlerts.map((alert) => <article key={alert.id} className={`rounded-lg border-l-4 p-3 ${SEVERITY[alert.type].stripe}`}><p className="font-semibold">{SEVERITY[alert.type].label}</p><p className="mt-1 text-sm">{alert.message}</p><p className="mt-1 text-xs">{alert.sent_at ? new Date(alert.sent_at).toLocaleString() : "Time unavailable"}</p></article>)}</div></details>}
        </section>

        <section aria-labelledby="reports-h">
          <div className="flex items-baseline justify-between mb-3">
            <h2 id="reports-h" className="font-display text-xl font-bold">My reports</h2>
            <Link href="/report" className="text-sm font-semibold text-blue-700 hover:underline">Add a report</Link>
          </div>
          <div className="space-y-2">
            {reportsError && <div role="alert" className="card p-4 text-red-700">Could not load reports: {reportsError}</div>}
            {!loading && !reportsError && reports.length === 0 && (
              <div className="card p-4 text-slate-500">No reports yet. Seen something? <Link href="/report" className="text-blue-700 font-semibold hover:underline">Report it</Link>.</div>
            )}
            {reports.map((report) => (
              <article key={report.id} className="card p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 capitalize">{report.type.replace(/_/g, " ")}</h3>
                  <p className="text-slate-600 mt-0.5">{report.description}</p>
                  <p className="text-xs text-slate-500 mt-1.5">{report.lat.toFixed(4)}, {report.lon.toFixed(4)} — {new Date(report.created_at).toLocaleString()}</p>
                </div>
                <span className={`badge shrink-0 ${report.status === "verified" ? "badge-success" : report.status === "rejected" ? "badge-danger" : "badge-warning"}`}>
                  {report.status.replace(/_/g, " ")}
                </span>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
