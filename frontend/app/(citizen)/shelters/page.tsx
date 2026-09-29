"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getShelters } from "@/lib/api";
import { Shelter } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";

const barColor = (pct: number) => (pct >= 50 ? "bg-emerald-600" : pct >= 20 ? "bg-saffron" : "bg-alarm");

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

  const openCount = shelters.filter((sh) => sh.status === "open").length;

  return (
    <div className="min-h-screen">
      <PageHeader title="Find a shelter" sub={!loading && !error && shelters.length ? `${openCount} of ${shelters.length} shelters are open` : "Registered shelters and free places"} />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        {loading && <div role="status" className="card p-5 text-slate-500">Loading shelters…</div>}
        {error && (
          <div role="alert" className="card p-5 text-red-700">
            <p>Could not load shelters: {error}</p>
            <button onClick={() => void loadShelters()} className="mt-3 font-semibold underline">Try again</button>
          </div>
        )}
        {!loading && !error && shelters.length === 0 && <div className="card p-5 text-slate-500">No shelters are registered yet.</div>}

        {shelters.map((shelter) => (
          <article key={shelter.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-bold text-slate-900">{shelter.name}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{shelter.lat.toFixed(5)}, {shelter.lon.toFixed(5)}</p>
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
