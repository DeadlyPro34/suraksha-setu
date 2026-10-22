"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { getMyResourceReports, getResources, submitResourceReport } from "@/lib/api";
import { Resource, ResourceReport } from "@/lib/types";

const labels: Record<Resource["type"], string> = { medical: "Medical kits", food: "Food rations", water: "Drinking water", boat: "Rescue boats", personnel: "Personnel" };

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [reports, setReports] = useState<ResourceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ resource_type: "medical" as Resource["type"], quantity: "", location_name: "", note: "", lat: "", lon: "" });

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [stock, myReports] = await Promise.all([getResources(), getMyResourceReports()]);
      setResources(stock);
      setReports(myReports);
      setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load resources and reports."); }
    finally { if (!quiet) setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 20000);
    const onFocus = () => { if (document.visibilityState === "visible") void load(true); };
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [load]);

  const useLocation = () => {
    if (!navigator.geolocation) { setError("Location is not available in this browser."); return; }
    navigator.geolocation.getCurrentPosition((position) => setForm((current) => ({ ...current, lat: String(position.coords.latitude), lon: String(position.coords.longitude) })), () => setError("Could not get your location. You can still submit the location name."), { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null); setNotice("");
    try {
      await submitResourceReport({ resource_type: form.resource_type, quantity: Number(form.quantity), location_name: form.location_name.trim(), note: form.note.trim(), lat: form.lat ? Number(form.lat) : null, lon: form.lon ? Number(form.lon) : null });
      setForm((current) => ({ ...current, quantity: "", note: "" }));
      setNotice("Stock count sent to officials for review. The shared total updates after approval.");
      await load(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not submit the stock report."); }
    finally { setBusy(false); }
  };

  const stockRecords = resources.filter((resource) => resource.incident_id === null);
  const grouped = stockRecords.reduce<Record<string, number>>((totals, resource) => {
    totals[resource.type] = (totals[resource.type] || 0) + (resource.status === "available" ? resource.quantity : 0);
    return totals;
  }, {});

  return <main className="min-h-screen bg-[#f2f6f5] p-4 sm:p-6"><div className="mx-auto max-w-5xl space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-bold text-slate-900">Available resources</h1><p className="mt-1 text-slate-600">Approved stock counts across response locations.</p></div><button type="button" onClick={() => void load()} className="rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-50">Refresh stock</button></header>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950">{notice}</p>}
    <section className="card p-4 sm:p-5"><div className="mb-4"><h2 className="text-xl font-bold text-slate-900">Report a stock count</h2><p className="mt-1 text-sm text-slate-600">Submit the count you checked on site. An official must approve it before the shared totals change.</p></div>
      <form onSubmit={(event) => void submit(event)} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Supply type<select required value={form.resource_type} onChange={(event) => setForm((current) => ({ ...current, resource_type: event.target.value as Resource["type"] }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">{Object.entries(labels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Count observed<input required type="number" min="0" max="10000000" step="1" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} placeholder="Total units currently available" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">Location or shelter<input required minLength={2} maxLength={200} value={form.location_name} onChange={(event) => setForm((current) => ({ ...current, location_name: event.target.value }))} placeholder="e.g. Vasna community shelter" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">Report note<textarea required minLength={3} maxLength={2000} rows={3} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="When you checked the stock and any relevant details" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><button type="button" onClick={useLocation} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Add my location</button><span className="text-xs text-slate-500">{form.lat && form.lon ? `Location attached (${Number(form.lat).toFixed(4)}, ${Number(form.lon).toFixed(4)})` : "GPS is optional; the location name is required."}</span></div>
        <div className="sm:col-span-2"><button disabled={busy} className="rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-50">{busy ? "Sending report…" : "Send count to officials"}</button></div>
      </form>
    </section>
    <section><div className="mb-3 flex items-baseline justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-900">Confirmed available stock</h2><p className="text-sm text-slate-600">Only official-approved counts appear here.</p></div><span className="text-xs text-slate-500">Refreshes automatically</span></div>
      {loading ? <p role="status" className="card p-5 text-sm text-slate-500">Loading stock…</p> : stockRecords.length === 0 ? <p className="card p-5 text-sm text-slate-500">No resources are registered.</p> : <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(grouped).map(([type, quantity]) => <article key={type} className="card border-[#d9e5e1] p-4"><p className="text-sm text-slate-600">{labels[type as Resource["type"]] || type}</p><p className="mt-1 text-3xl font-bold tabular-nums text-teal-900">{quantity}</p><p className="text-xs text-slate-500">available units</p></article>)}</div><div className="mt-3 space-y-2">{stockRecords.map((resource) => <div key={resource.id} className="card flex flex-wrap justify-between gap-2 border-[#d9e5e1] p-3 text-sm"><span><span className="font-medium text-slate-800">{labels[resource.type]}</span><span className="ml-2 text-slate-500">{resource.location_name}</span>{resource.status !== "available" && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">{resource.status}</span>}</span><span className="tabular-nums text-slate-600">{resource.status === "available" ? resource.quantity : 0}{resource.lat !== null && resource.lon !== null ? ` · ${resource.lat.toFixed(4)}, ${resource.lon.toFixed(4)}` : " units"}</span></div>)}</div></>}
    </section>
    <section><h2 className="mb-3 text-xl font-bold text-slate-900">My submitted stock reports</h2>{reports.length === 0 ? <p className="card p-4 text-sm text-slate-600">No stock reports submitted yet.</p> : <div className="space-y-2">{reports.map((report) => <article key={report.id} className="card flex flex-wrap items-start justify-between gap-3 p-4"><div><p className="font-semibold text-slate-900">{labels[report.resource_type]} · {report.quantity} units</p><p className="text-sm text-slate-700">{report.location_name} — {report.note}</p><p className="mt-1 text-xs text-slate-500">Submitted {new Date(report.submitted_at).toLocaleString()}</p>{report.review_note && <p className="mt-1 text-sm text-slate-600">Official note: {report.review_note}</p>}</div><span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${report.status === "approved" ? "bg-emerald-100 text-emerald-900" : report.status === "rejected" ? "bg-red-100 text-red-900" : "bg-amber-100 text-amber-900"}`}>{report.status}</span></article>)}</div>}</section>
  </div></main>;
}
