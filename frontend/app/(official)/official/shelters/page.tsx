"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getShelters } from "@/lib/api";
import dynamic from "next/dynamic";
import { createShelter, ShelterMutation, updateShelter } from "@/lib/api";
import { Shelter } from "@/lib/types";
import { ShelterFreshness } from "@/components/ShelterFreshness";

const ResponseMap = dynamic(() => import("@/components/ResponseMap").then((module) => module.ResponseMap), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-lg bg-slate-100" /> });

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
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<ShelterMutation>({ name: "", lat: 23.0225, lon: 72.5714, capacity: 100, current_occupancy: 0, has_electricity: false, has_medical: false, status: "open" });

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

  const openCreateForm = () => {
    setEditingId(null);
    setForm({ name: "", lat: 23.0225, lon: 72.5714, capacity: 100, current_occupancy: 0, has_electricity: false, has_medical: false, status: "open" });
    setFormError(""); setFormOpen(true);
  };

  const openEditForm = (shelter: Shelter) => {
    setEditingId(shelter.id);
    setForm({ name: shelter.name, lat: shelter.lat, lon: shelter.lon, capacity: shelter.capacity, current_occupancy: shelter.current_occupancy, has_electricity: shelter.has_electricity, has_medical: shelter.has_medical, status: shelter.status });
    setFormError(""); setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveShelter = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormBusy(true); setFormError("");
    try {
      if (editingId) await updateShelter(editingId, form);
      else await createShelter(form);
      setFormOpen(false); setEditingId(null);
      await refresh();
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : "Could not save shelter."); }
    finally { setFormBusy(false); }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { setFormError("This device does not provide location access."); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => setForm((current) => ({ ...current, lat: position.coords.latitude, lon: position.coords.longitude })),
      (cause) => setFormError(cause.message || "Could not read the current location."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-900">Shelter management</h2><p className="mt-1 text-sm text-slate-600">Add a shelter or update its location, capacity, facilities, and operating status.</p></div><button type="button" onClick={openCreateForm} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white">Add shelter</button></div>
      {formOpen && <form onSubmit={(event) => void saveShelter(event)} className="card space-y-4 border-sky-200 p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-slate-900">{editingId ? "Edit shelter" : "Register a shelter"}</h3><p className="mt-1 text-sm text-slate-600">Select a point on the map or enter its coordinates.</p></div><button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700">Close</button></div>
        {formError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{formError}</p>}
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Shelter name<input required minLength={2} maxLength={200} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Community hall or school name" /></label>
          <label className="text-sm font-semibold text-slate-700">Latitude<input type="number" required step="any" min={-90} max={90} value={form.lat} onChange={(event) => setForm((current) => ({ ...current, lat: Number(event.target.value) }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label><label className="text-sm font-semibold text-slate-700">Longitude<input type="number" required step="any" min={-180} max={180} value={form.lon} onChange={(event) => setForm((current) => ({ ...current, lon: Number(event.target.value) }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
          <div className="sm:col-span-2"><button type="button" onClick={useCurrentLocation} className="mb-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Use this device’s location</button><div className="h-64 overflow-hidden rounded-lg border border-slate-200"><ResponseMap alerts={[]} shelters={[]} showAlerts={false} showShelters={false} selectedLocation={{ lat: form.lat, lon: form.lon }} onLocationSelect={(lat, lon) => setForm((current) => ({ ...current, lat, lon }))} /></div><p className="mt-1 text-xs text-slate-500">Click the map to place or move the shelter marker.</p></div>
          <label className="text-sm font-semibold text-slate-700">Total capacity<input type="number" required min={1} max={1000000} value={form.capacity} onChange={(event) => setForm((current) => ({ ...current, capacity: Number(event.target.value) }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label><label className="text-sm font-semibold text-slate-700">Current occupancy<input type="number" required min={0} max={form.capacity} value={form.current_occupancy} onChange={(event) => setForm((current) => ({ ...current, current_occupancy: Number(event.target.value) }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
          <label className="text-sm font-semibold text-slate-700">Operating status<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ShelterMutation["status"] }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="open">Open</option><option value="full">Full</option><option value="closed">Closed</option></select></label><div className="flex flex-wrap items-end gap-4"><label className="flex items-center gap-2 pb-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.has_medical} onChange={(event) => setForm((current) => ({ ...current, has_medical: event.target.checked }))} className="h-4 w-4 accent-emerald-700" />Medical support</label><label className="flex items-center gap-2 pb-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.has_electricity} onChange={(event) => setForm((current) => ({ ...current, has_electricity: event.target.checked }))} className="h-4 w-4 accent-emerald-700" />Electricity</label></div>
        </div><div className="flex flex-wrap gap-2"><button type="submit" disabled={formBusy || form.current_occupancy > form.capacity} className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{formBusy ? "Saving…" : editingId ? "Save shelter changes" : "Add shelter"}</button><button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button></div>
      </form>}
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
        <ShelterFreshness updatedAt={shelter.updated_at} />
        <div className="mt-4 flex flex-wrap gap-2">
          {shelter.has_electricity && <span className="badge badge-info">Electricity</span>}
          {shelter.has_medical && <span className="badge badge-info">Medical support</span>}
          {!shelter.has_electricity && !shelter.has_medical && <span className="text-xs text-slate-400">No additional facilities listed</span>}
        </div>
        <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => openEditForm(shelter)} className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">Edit shelter</button><a href={`/map?lat=${shelter.lat}&lon=${shelter.lon}`} className="inline-flex rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50">View on response map</a></div>
      </article>)}</div>}
      {!loading && !error && shelters.length > 0 && <p className="text-xs text-slate-500">{medicalCount} {medicalCount === 1 ? "shelter has" : "shelters have"} medical support listed. Capacity figures use the latest data recorded in the system.</p>}
    </div>
  );
}
