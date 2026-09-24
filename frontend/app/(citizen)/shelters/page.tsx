"use client";

import { useCallback, useEffect, useState } from "react";
import { getShelters } from "@/lib/api";
import { Shelter } from "@/lib/types";

function capacityColor(pct: number): string {
  if (pct >= 50) return "text-green-600 bg-green-50";
  if (pct >= 20) return "text-amber-600 bg-amber-50";
  return "text-red-600 bg-red-50";
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    open: "badge-success",
    limited: "badge-warning",
    full: "badge-danger",
  };
  return map[status] || "badge-neutral";
}

export default function SheltersPage() {
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadShelters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setShelters(await getShelters());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load shelters.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadShelters();
  }, [loadShelters]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <a href="/" className="text-slate-400 hover:text-slate-600 transition-colors">← Back</a>
          <h1 className="text-lg font-bold text-slate-900">Nearest Safe Shelters</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        {/* Info banner */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2">
          <span className="text-blue-600">📍</span>
          <p className="text-xs text-blue-700">Registered shelter locations and capacity from the live database.</p>
        </div>

        {loading && <div role="status" className="card p-5 text-sm text-slate-500">Loading shelters…</div>}
        {error && (
          <div role="alert" className="card p-5 text-sm text-red-700">
            <p>Could not load shelters: {error}</p>
            <button onClick={() => void loadShelters()} className="mt-3 font-medium underline">Try again</button>
          </div>
        )}
        {!loading && !error && shelters.length === 0 && (
          <div className="card p-5 text-sm text-slate-500">No shelters are registered in the database yet.</div>
        )}

        {shelters.map((shelter, i) => (
          <div
            key={shelter.id}
            className="card p-4 animate-fade-in"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-slate-900">{shelter.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{shelter.lat.toFixed(5)}, {shelter.lon.toFixed(5)}</p>
              </div>
              <span className={`badge ${statusBadge(shelter.status)}`}>
                {shelter.status}
              </span>
            </div>

            {/* Capacity bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">Capacity Available</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${capacityColor(shelter.available_percentage)}`}>
                  {shelter.available_percentage}% · {shelter.available_capacity} places
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    shelter.available_percentage >= 50 ? "bg-green-500" :
                    shelter.available_percentage >= 20 ? "bg-amber-500" : "bg-red-500"
                  }`}
                  style={{ width: `${shelter.available_percentage}%` }}
                />
              </div>
            </div>

            {/* Registered amenities */}
            {(shelter.has_electricity || shelter.has_medical) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {shelter.has_electricity && <span className="badge badge-info">Electricity</span>}
                {shelter.has_medical && <span className="badge badge-info">Medical support</span>}
              </div>
            )}

            {/* Action */}
            {shelter.status === "open" && (
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${shelter.lat},${shelter.lon}`} target="_blank" rel="noreferrer" className="mt-3 block w-full py-2 text-center text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors">
                🧭 Get Directions
              </a>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
