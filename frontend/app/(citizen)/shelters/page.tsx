"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { getNearbyShelters } from "@/lib/api";
import { NearbyShelter } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";

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

  const loadShelters = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);
    try {
      setShelters(await getNearbyShelters(lat, lon));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load nearby shelters.");
    } finally {
      setLoading(false);
    }
  }, []);

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
          <p className="text-xs text-slate-500 mb-3">Your location is used only to sort shelters by distance.</p>
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
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${shelter.lat},${shelter.lon}`} target="_blank" rel="noreferrer"
                className="mt-4 block w-full py-2.5 text-center font-semibold text-ink bg-saffron rounded-lg hover:brightness-105">
                Get directions
              </a>
            )}
          </article>
        ))}
      </main>
    </div>
  );
}
