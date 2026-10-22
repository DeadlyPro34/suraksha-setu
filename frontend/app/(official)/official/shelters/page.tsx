"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getShelters } from "@/lib/api";
import { Shelter } from "@/lib/types";

const statusStyles: Record<string, string> = {
  open: "badge-success",
  full: "badge-warning",
  closed: "badge-neutral",
};

function CapacityBar({ percentage }: { percentage: number }) {
  const safePercentage = Math.max(0, Math.min(100, percentage));
  const color = safePercentage <= 10 ? "bg-red-500" : safePercentage <= 30 ? "bg-amber-500" : "bg-emerald-500";
  return <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${safePercentage}% capacity available`}>
    <div className={`h-full rounded-full ${color}`} style={{ width: `${safePercentage}%` }} />
  </div>;
}

export default function OfficialSheltersPage() {
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setShelters(await getShelters());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load shelters.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filteredShelters = useMemo(() => shelters.filter((shelter) => {
    const matchesQuery = shelter.name.toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (statusFilter === "all" || shelter.status === statusFilter);
  }), [query, shelters, statusFilter]);

  const openCount = shelters.filter((shelter) => shelter.status === "open").length;
  const availablePlaces = shelters.reduce((total, shelter) => total + shelter.available_capacity, 0);
  const medicalCount = shelters.filter((shelter) => shelter.has_medical).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Shelter summary">
        {[
          { label: "Registered shelters", value: shelters.length },
          { label: "Currently open", value: openCount },
          { label: "Places available", value: availablePlaces },
        ].map((item) => <article key={item.label} className="card p-4 sm:p-5"><p className="text-2xl font-bold text-slate-900">{loading ? "…" : error ? "—" : item.value}</p><p className="mt-1 text-sm text-slate-600">{item.label}</p></article>)}
      </section>

      <section className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="sr-only" htmlFor="shelter-search">Search shelters</label>
        <input id="shelter-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by shelter name" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-sm" />
        <label className="flex items-center gap-2 text-sm text-slate-600">Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800">
            <option value="all">All shelters</option><option value="open">Open</option><option value="full">Full</option><option value="closed">Closed</option>
          </select>
        </label>
        <button onClick={() => void refresh()} disabled={loading} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">{loading ? "Refreshing…" : "Refresh"}</button>
      </section>

      {error && <div role="alert" className="card flex flex-wrap items-center justify-between gap-3 border-red-200 p-5 text-sm text-red-700"><span>Could not load shelters: {error}</span><button onClick={() => void refresh()} className="font-semibold underline">Try again</button></div>}
      {loading && <p role="status" className="card p-5 text-sm text-slate-500">Loading shelter directory…</p>}
      {!loading && !error && filteredShelters.length === 0 && <div className="card p-8 text-center"><p className="font-semibold text-slate-800">No matching shelters</p><p className="mt-1 text-sm text-slate-500">Try another name or status filter.</p></div>}

      {!error && <div className="grid gap-4 lg:grid-cols-2">{filteredShelters.map((shelter) => <article key={shelter.id} className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><h2 className="text-lg font-bold text-slate-900">{shelter.name}</h2><p className="mt-1 text-xs text-slate-500">{shelter.lat.toFixed(5)}, {shelter.lon.toFixed(5)}</p></div>
          <span className={`badge shrink-0 capitalize ${statusStyles[shelter.status] || "badge-neutral"}`}>{shelter.status}</span>
        </div>
        <div className="mt-5 flex items-end justify-between gap-3"><p><span className="text-2xl font-bold text-slate-900">{shelter.available_capacity}</span><span className="ml-2 text-sm text-slate-600">places available</span></p><p className="text-sm font-semibold text-slate-700">{shelter.available_percentage}% free</p></div>
        <div className="mt-2"><CapacityBar percentage={shelter.available_percentage} /></div>
        <p className="mt-2 text-xs text-slate-500">Occupancy: {shelter.current_occupancy} of {shelter.capacity}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {shelter.has_electricity && <span className="badge badge-info">Electricity</span>}
          {shelter.has_medical && <span className="badge badge-info">Medical support</span>}
          {!shelter.has_electricity && !shelter.has_medical && <span className="text-xs text-slate-400">No additional facilities listed</span>}
        </div>
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${shelter.lat},${shelter.lon}`} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50">Open directions ↗</a>
      </article>)}</div>}
      {!loading && !error && shelters.length > 0 && <p className="text-xs text-slate-500">{medicalCount} {medicalCount === 1 ? "shelter has" : "shelters have"} medical support listed. Capacity figures use the latest data recorded in the system.</p>}
    </div>
  );
}
