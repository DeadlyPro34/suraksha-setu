"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { getMyResourceReports, getResources, submitResourceReport } from "@/lib/api";
import { Resource, ResourceReport } from "@/lib/types";

const labels: Record<Resource["type"], string> = { medical: "Medical kits", food: "Food rations", water: "Drinking water", boat: "Rescue boats", personnel: "Personnel" };
type ResourceSection = "report" | "stock" | "reports";

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [reports, setReports] = useState<ResourceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [activeSection, setActiveSection] = useState<ResourceSection>("report");
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
      setActiveSection("reports");
      await load(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not submit the stock report."); }
    finally { setBusy(false); }
  };

  const stockRecords = resources.filter((resource) => resource.incident_id === null);
  const grouped = stockRecords.reduce<Record<string, number>>((totals, resource) => {
    totals[resource.type] = (totals[resource.type] || 0) + (resource.status === "available" ? resource.quantity : 0);
    return totals;
  }, {});
  const pendingReports = reports.filter((report) => report.status === "pending").length;

  return <main className="min-h-screen bg-[#f2f6f5] p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#d9e5e1] bg-white p-4 shadow-sm sm:p-6"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-800">Volunteer workspace</p><h1 className="mt-1 text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">Available resources</h1><p className="mt-2 text-base text-slate-600">Check approved stock or report what you find on site.</p></div><button type="button" onClick={() => void load()} className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-bold text-teal-950 hover:bg-teal-100">Refresh stock</button></header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-900">{error}</p>}{notice && <p role="status" className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm font-medium text-teal-950">{notice}</p>}
    <nav aria-label="Resource page sections" className="sticky top-[96px] z-20 flex gap-1 rounded-xl border border-[#d9e5e1] bg-white p-1.5 shadow-sm xl:hidden">{([{ id: "report", label: "Report count" }, { id: "stock", label: "Current stock" }, { id: "reports", label: `My reports${pendingReports ? ` · ${pendingReports} pending` : ""}` }] as { id: ResourceSection; label: string }[]).map((item) => <button key={item.id} type="button" aria-current={activeSection === item.id ? "page" : undefined} onClick={() => setActiveSection(item.id)} className={`min-w-0 flex-1 rounded-lg px-2 py-2.5 text-xs font-bold leading-tight ${activeSection === item.id ? "bg-teal-800 text-white shadow-sm" : "text-slate-600 hover:bg-teal-50"}`}>{item.label}</button>)}</nav>
    <div className="grid items-start gap-5 xl:grid-cols-2 xl:gap-6">
      <div className={`space-y-5 xl:space-y-6 ${activeSection === "stock" ? "hidden xl:block" : ""}`}>
      <section className={`card border-[#d9e5e1] p-4 shadow-sm sm:p-6 ${activeSection !== "report" ? "hidden xl:block" : ""}`}><div className="mb-5"><span className="inline-flex rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-teal-900">Field report</span><h2 className="mt-2 text-2xl font-bold text-slate-950">Report a stock count</h2><p className="mt-1 text-base leading-relaxed text-slate-600">Send the count you verified at a location. Officials review it before shared totals change.</p></div>
        <form onSubmit={(event) => void submit(event)} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-800">Supply type<select required value={form.resource_type} onChange={(event) => setForm((current) => ({ ...current, resource_type: event.target.value as Resource["type"] }))} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-medium text-slate-900 focus:border-teal-700 focus:ring-2 focus:ring-teal-100">{Object.entries(labels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-800">Available count<input required type="number" min="0" max="10000000" step="1" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} placeholder="Units at this location" className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base font-medium text-slate-900 placeholder:font-normal focus:border-teal-700 focus:ring-2 focus:ring-teal-100" /></label>
          <label className="text-sm font-semibold text-slate-800 sm:col-span-2">Location or shelter<input required minLength={2} maxLength={200} value={form.location_name} onChange={(event) => setForm((current) => ({ ...current, location_name: event.target.value }))} placeholder="e.g. Vasna community shelter" className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base font-medium text-slate-900 placeholder:font-normal focus:border-teal-700 focus:ring-2 focus:ring-teal-100" /></label>
          <label className="text-sm font-semibold text-slate-800 sm:col-span-2">What did you find?<textarea required minLength={3} maxLength={2000} rows={4} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Add the time checked and any important stock details." className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base font-normal text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:ring-2 focus:ring-teal-100" /></label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><button type="button" onClick={useLocation} className="min-h-10 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-teal-300 hover:bg-teal-50">Add my location</button><span className="text-sm text-slate-600">{form.lat && form.lon ? `GPS attached · ${Number(form.lat).toFixed(4)}, ${Number(form.lon).toFixed(4)}` : "GPS is optional; enter the location name."}</span></div>
          <div className="sm:col-span-2"><button disabled={busy} className="min-h-11 w-full rounded-xl bg-teal-800 px-5 py-2.5 text-base font-bold text-white shadow-sm hover:bg-teal-900 disabled:cursor-wait disabled:opacity-60 sm:w-auto">{busy ? "Sending report…" : "Send count to officials"}</button></div>
        </form>
      </section>
      <section className={`${activeSection !== "reports" ? "hidden xl:block" : ""}`}><div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-sky-900">Your submissions</span><h2 className="mt-2 text-2xl font-bold text-slate-950">My stock reports</h2></div>{reports.length > 0 && <p className="text-sm text-slate-600">{reports.length} {reports.length === 1 ? "report" : "reports"}{pendingReports ? ` · ${pendingReports} awaiting review` : ""}</p>}</div>
        {reports.length === 0 ? <p className="card border-[#d9e5e1] p-5 text-base text-slate-600">No stock reports submitted yet. Your reports and official decisions will appear here.</p> : <div className="grid gap-3 xl:grid-cols-1">{reports.map((report) => <article key={report.id} className="card border-[#d9e5e1] p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-lg font-bold text-slate-950">{labels[report.resource_type]} <span className="tabular-nums text-teal-900">· {report.quantity}</span></p><p className="mt-0.5 text-sm font-medium text-slate-700">{report.location_name}</p></div><span className={`rounded-full px-3 py-1 text-sm font-bold capitalize ${report.status === "approved" ? "bg-emerald-100 text-emerald-900" : report.status === "rejected" ? "bg-red-100 text-red-900" : "bg-amber-100 text-amber-950"}`}>{report.status}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{report.note}</p><p className="mt-3 text-xs font-medium text-slate-500">Submitted {new Date(report.submitted_at).toLocaleString()}</p>{report.review_note && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><strong>Official note:</strong> {report.review_note}</p>}</article>)}</div>}
      </section>
      </div>
      <section className={`card border-[#d9e5e1] p-4 shadow-sm sm:p-6 ${activeSection !== "stock" ? "hidden xl:block" : ""}`}><div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-900">Officially confirmed</span><h2 className="mt-2 text-2xl font-bold text-slate-950">Current stock</h2><p className="mt-1 text-sm leading-relaxed text-slate-600">Totals combine approved counts across locations.</p></div><span className="text-xs font-medium text-slate-500">Auto-refreshes</span></div>
        {loading ? <p role="status" className="rounded-xl bg-slate-50 p-5 text-base text-slate-600">Loading stock…</p> : stockRecords.length === 0 ? <p className="rounded-xl bg-slate-50 p-5 text-base text-slate-600">No resources are registered.</p> : <><div className="grid gap-3 sm:grid-cols-2">{Object.entries(grouped).map(([type, quantity]) => <article key={type} className="rounded-xl border border-[#d9e5e1] bg-gradient-to-br from-white to-teal-50/60 p-4"><p className="text-sm font-semibold text-slate-600">{labels[type as Resource["type"]] || type}</p><p className="mt-1 text-4xl font-bold tabular-nums leading-none text-teal-900">{quantity}</p><p className="mt-2 text-sm text-slate-600">available units</p></article>)}</div><div className="mt-5"><h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">By location</h3><div className="space-y-2">{stockRecords.map((resource) => <article key={resource.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-3"><div><p className="text-sm font-bold text-slate-900">{labels[resource.type]}</p><p className="mt-0.5 text-sm text-slate-600">{resource.location_name}</p></div><div className="text-right"><p className="text-lg font-bold tabular-nums text-slate-900">{resource.status === "available" ? resource.quantity : 0}</p>{resource.lat !== null && resource.lon !== null ? <p className="text-xs tabular-nums text-slate-500">{resource.lat.toFixed(4)}, {resource.lon.toFixed(4)}</p> : <p className="text-xs text-slate-500">units</p>}{resource.status !== "available" && <span className="text-xs font-semibold capitalize text-slate-500">{resource.status}</span>}</div></article>)}</div></div></>}
      </section>
    </div>
  </div></main>;
}
