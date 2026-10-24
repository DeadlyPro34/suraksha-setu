"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { getCitizenAlerts, getDrivingDirections, getNearbyShelters } from "@/lib/api";
import { Alert, DrivingDirections, NearbyShelter } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { ShelterFreshness } from "@/components/ShelterFreshness";
import { useNavigation } from "@/lib/useNavigation";
import { nextRouteInstruction } from "@/lib/route-guidance";

const ResponseMap = dynamic(() => import("@/components/ResponseMap").then((module) => module.ResponseMap), { ssr: false, loading: () => <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-slate-500">Loading map…</div> });

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1); const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function capacityColor(pct: number): string {
  if (pct >= 90) return "text-red-700 bg-red-50";
  if (pct >= 70) return "text-amber-700 bg-amber-50";
  return "text-green-700 bg-green-50";
}

const barColor = (pct: number) => (pct >= 50 ? "bg-emerald-600" : pct >= 20 ? "bg-saffron" : "bg-alarm");

function statusBadge(status: string) {
  const map: Record<string, string> = {
    open: "badge-success",
    full: "badge-danger",
    closed: "badge-neutral",
  };
  return map[status] || "badge-neutral";
}

export default function SheltersPage() {
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [shelters, setShelters] = useState<NearbyShelter[]>([]);
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(null);
  const [directions, setDirections] = useState<DrivingDirections | null>(null);
  const [routeAlerts, setRouteAlerts] = useState<Alert[]>([]);
  const [routeShelterId, setRouteShelterId] = useState<string | null>(null);
  const [routeMessage, setRouteMessage] = useState<string | null>(null);
  const navigation = useNavigation(directions, routeAlerts);
  const activeDirections = navigation.route;
  const stopNavigation = navigation.stop;

  const loadShelters = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);
    setOrigin({ lat, lon });
    setDirections(null);
    stopNavigation();
    setRouteMessage(null);
    try {
      setShelters(await getNearbyShelters(lat, lon));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load nearby shelters.");
    } finally {
      setLoading(false);
    }
  }, [stopNavigation]);

  const showRoute = async (shelter: NearbyShelter) => {
    if (!origin) { setRouteMessage("Set your starting location above to get directions."); return; }
    setRouteShelterId(shelter.id); setRouteMessage(null); setDirections(null);
    navigation.stop();
    try {
      let currentAlerts: Alert[] = [];
      try { currentAlerts = await getCitizenAlerts(100); } catch { currentAlerts = []; }
      const hazards = currentAlerts.filter((alert) => (alert.type === "evacuation" || alert.type === "warning") && alert.lat != null && alert.lon != null).map((alert) => ({ lat: alert.lat!, lon: alert.lon! }));
      const route = await getDrivingDirections(origin, { lat: shelter.lat, lon: shelter.lon }, hazards);
      if (!route.route_found) throw new Error("A driving route is not available for this location right now.");
      setDirections(route);
      setRouteAlerts(currentAlerts);
    } catch (err) {
      setRouteMessage(err instanceof Error ? err.message : "Could not load directions. Please try again.");
    } finally {
      setRouteShelterId(null);
    }
  };

  const routeAlert = activeDirections && routeAlerts.find((alert) => (alert.type === "evacuation" || alert.type === "warning") && alert.lat != null && alert.lon != null && activeDirections.coordinates.some(([lon, lat]) => distanceKm(alert.lat!, alert.lon!, lat, lon) <= 0.75));

  const searchManualLocation = () => {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!latitude || !longitude || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setError("Enter a valid latitude and longitude.");
      return;
    }
    setLocationMessage(null);
    void loadShelters(lat, lon);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage("Location is unavailable in this browser. Enter coordinates manually.");
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setLatitude(lat.toFixed(6));
        setLongitude(lon.toFixed(6));
        setLocationMessage(null);
        setGettingLocation(false);
        void loadShelters(lat, lon);
      },
      () => {
        setLocationMessage("Could not get your location. Enter the coordinates manually.");
        setGettingLocation(false);
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  };

  const openCount = shelters.filter((sh) => sh.status === "open").length;

  return (
    <div className="min-h-screen">
      <PageHeader title="Find a shelter" sub={!loading && !error && shelters.length ? `${openCount} of ${shelters.length} shelters are open` : "Registered shelters and free places"} />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        <section className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-2">Find shelters near you</h2>
          <p className="text-xs text-slate-500 mb-3">Your location sorts shelters by distance. If you request directions, your start and destination are sent to OSRM; live GPS is sent only when an automatic reroute is requested.</p>
          <button type="button" onClick={useCurrentLocation} disabled={gettingLocation} className="w-full mb-3 py-3 border-2 border-dashed border-blue-300 bg-blue-50 text-blue-700 font-medium rounded-xl hover:bg-blue-100 disabled:opacity-50">
            {gettingLocation ? "Getting location…" : "Use Current GPS Location"}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-slate-600">Latitude<input type="number" min="-90" max="90" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></label>
            <label className="text-xs text-slate-600">Longitude<input type="number" min="-180" max="180" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></label>
          </div>
          <button type="button" onClick={searchManualLocation} className="mt-3 w-full py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700">Search this location</button>
          {locationMessage && <p role="status" className="text-xs text-amber-700 mt-2">{locationMessage}</p>}
        </section>

        {loading && <div role="status" className="card p-5 text-slate-500">Loading shelters…</div>}
        {error && (
          <div role="alert" className="card p-5 text-red-700">
            <p>Could not load shelters: {error}</p>
          </div>
        )}
        {!loading && !error && latitude && longitude && shelters.length === 0 && <div className="card p-5 text-slate-500">No shelters are registered near this location yet.</div>}

        {activeDirections && <section className="card p-3 sm:p-4" aria-label="Suggested route to shelter">
          <div className="mb-3"><h2 className="font-display text-xl font-bold">Suggested route · {activeDirections.distance_km} km · about {activeDirections.duration_min} min</h2><p className="mt-1 text-sm text-slate-600">Where alternatives are available, this route prefers roads farther from currently mapped evacuation and warning alerts. Alerts may be missing or outdated, and roads can change; this route cannot guarantee safety. Check alerts and follow local authorities. If accurate GPS places you over 150 m off route twice, up to three reroutes may send your current location to OSRM.</p>{routeAlert && <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">Caution: a mapped {routeAlert.type.replace(/_/g, " ")} alert is close to this route. Check its details before travelling.</p>}</div>
          <div className="mb-3 flex flex-wrap items-center gap-3"><button type="button" onClick={navigation.active ? navigation.stop : navigation.start} className={`rounded-lg px-4 py-2.5 text-sm font-bold text-white ${navigation.active ? "bg-slate-700 hover:bg-slate-800" : "bg-emerald-700 hover:bg-emerald-800"}`}>{navigation.active ? "Stop navigation" : "Start navigation"}</button>{navigation.active && <span className="text-sm font-semibold text-emerald-800">Navigation active · keep this page open</span>}</div>
          {navigation.rerouting && <p role="status" className="mb-3 text-sm font-semibold text-blue-900">Off route · recalculating from your current location…</p>}
          {navigation.rerouteNotice && <p role="status" className="mb-3 text-sm text-emerald-900">{navigation.rerouteNotice}</p>}
          {navigation.error && <p role="status" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{navigation.error}</p>}
          {navigation.active && nextRouteInstruction(activeDirections, navigation.position) && <p aria-live="polite" className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3 font-semibold text-blue-950">Next: {nextRouteInstruction(activeDirections, navigation.position)?.instruction}</p>}
          <div className="h-[42vh] min-h-[320px] overflow-hidden rounded-xl"><ResponseMap alerts={routeAlerts} shelters={shelters} showAlerts showShelters routeCoordinates={activeDirections.coordinates.map(([lon, lat]) => [lat, lon] as [number, number])} currentPosition={navigation.position ? [navigation.position.lat, navigation.position.lon] : null} followPosition={navigation.active} /></div>
          {activeDirections.steps.length > 0 && <ol className="mt-4 max-h-56 list-decimal space-y-1 overflow-auto pl-5 text-sm text-slate-800">{activeDirections.steps.map((step, index) => <li key={`${index}-${step.instruction}`} aria-current={navigation.active && nextRouteInstruction(activeDirections, navigation.position) === step ? "step" : undefined}>{step.instruction} <span className="text-slate-500">({step.distance_km} km)</span></li>)}</ol>}
        </section>}
        {routeMessage && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{routeMessage}</p>}

        {shelters.map((shelter) => (
          <article key={shelter.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-bold text-slate-900">{shelter.name}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{shelter.distance_km.toFixed(2)} km away · {shelter.lat.toFixed(5)}, {shelter.lon.toFixed(5)}</p>
              </div>
              <span className={`badge shrink-0 capitalize ${statusBadge(shelter.status)}`}>{shelter.status}</span>
            </div>

            <div className="mt-4">
              <p className="text-slate-900"><span className="font-display text-2xl font-bold">{shelter.available_capacity}</span> <span className="text-slate-600">places free ({shelter.available_percentage}%)</span></p>
              <ShelterFreshness updatedAt={shelter.updated_at} />
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-2" role="img" aria-label={`${shelter.available_percentage}% of places free`}>
                <div className={`h-full rounded-full ${barColor(shelter.available_percentage)}`} style={{ width: `${shelter.available_percentage}%` }} />
              </div>
            </div>

            {(shelter.has_electricity || shelter.has_medical) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {shelter.has_electricity && <span className="badge badge-info">Electricity</span>}
                {shelter.has_medical && <span className="badge badge-info">Medical support</span>}
              </div>
            )}

            {shelter.status === "open" && (
              <button type="button" onClick={() => void showRoute(shelter)} disabled={routeShelterId === shelter.id && !directions}
                className="mt-4 block w-full rounded-lg bg-saffron py-2.5 text-center font-semibold text-ink hover:brightness-105 disabled:opacity-50">
                {routeShelterId === shelter.id && !directions ? "Loading route…" : "Show route in Suraksha Setu"}
              </button>
            )}
          </article>
        ))}
      </main>
    </div>
  );
}
