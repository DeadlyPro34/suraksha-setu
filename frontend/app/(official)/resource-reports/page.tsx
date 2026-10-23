"use client";

import { useCallback, useEffect, useState } from "react";
import { getResourceReports, getResources, getSupplyRequests, reviewResourceReport } from "@/lib/api";
import { Resource, ResourceReport, SupplyRequest } from "@/lib/types";

const labels: Record<ResourceReport["resource_type"], string> = { medical: "Medical kits", food: "Food rations", water: "Drinking water", boat: "Rescue boats", personnel: "Personnel" };

export default function ResourceReportsPage() {
  const [reports, setReports] = useState<ResourceReport[]>([]);
  const [stock, setStock] = useState<Resource[]>([]);
  const [deliveries, setDeliveries] = useState<SupplyRequest[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [reportRows, stockRows, deliveryRows] = await Promise.all([
        getResourceReports(filter === "pending" ? "pending" : undefined), getResources(), getSupplyRequests(),
      ]);
      setReports(reportRows); setStock(stockRows); setDeliveries(deliveryRows); setError(null);
    }
    catch (err) { setError(err instanceof Error ? err.message : "Could not load stock reports."); }
    finally { if (!quiet) setLoading(false); }
  }, [filter]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 20000);
    const onFocus = () => { if (document.visibilityState === "visible") void load(true); };
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [load]);

  const review = async (report: ResourceReport, decision: "approved" | "rejected") => {
    const action = decision === "approved" ? "approve this count and update shared stock" : "reject this count";
    if (!window.confirm(`Are you sure you want to ${action}? This decision cannot be changed.`)) return;
    setBusy(report.id); setError(null); setNotice("");
    try {
      await reviewResourceReport(report.id, decision, notes[report.id] || "");
      setNotice(decision === "approved" ? "Count approved. Shared resource stock has been updated." : "Stock report rejected.");
      await load(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not review stock report."); }
    finally { setBusy(null); }
  };

  const pending = reports.filter((report) => report.status === "pending").length;
  const inventory = Object.values(stock.reduce<Record<string, Resource>>((groups, row) => {
    const key = `${row.type}|${row.location_name}`;
    const quantity = row.status === "available" ? row.quantity : 0;
    groups[key] = groups[key]
      ? { ...groups[key], quantity: groups[key].quantity + quantity }
      : { ...row, quantity };
    return groups;
  }, {}));
  return <div className="mx-auto max-w-5xl space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-bold text-slate-900">Resource stock reports</h2><p className="mt-1 text-sm text-slate-600">Verify field counts, then approve them to update the shared resource totals.</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-amber-100 px-3 py-1.5 text-sm font-bold text-amber-950">{pending} pending</span><button type="button" onClick={() => void load()} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">Refresh</button></div></header>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950">{notice}</p>}
    <div className="flex gap-2"><button type="button" aria-pressed={filter === "pending"} onClick={() => setFilter("pending")} className={`rounded-lg px-3 py-2 text-sm font-semibold ${filter === "pending" ? "bg-ink text-white" : "border border-slate-300 bg-white text-slate-700"}`}>Pending review</button><button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")} className={`rounded-lg px-3 py-2 text-sm font-semibold ${filter === "all" ? "bg-ink text-white" : "border border-slate-300 bg-white text-slate-700"}`}>All reports</button></div>
    <section className="card p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold text-slate-900">Current stock by location</h3><p className="mt-1 text-sm text-slate-600">Latest approved stock counts, plus quantities recorded from deliveries officials have closed.</p></div><span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-900">{inventory.length} location and supply totals</span></div>{inventory.length === 0 ? <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No approved stock counts yet.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{inventory.map((row) => <article key={`${row.type}-${row.location_name}`} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-2"><div><h4 className="font-semibold text-slate-900">{labels[row.type]}</h4><p className="mt-1 text-sm text-slate-600">{row.location_name}</p></div><strong className="text-lg tabular-nums text-teal-900">{row.quantity} on hand</strong></div></article>)}</div>}</section>
    <section className="card p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold text-slate-900">Deliveries by destination</h3><p className="mt-1 text-sm text-slate-600">See which location each approved shipment is headed to and how many units are in transit or received.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-900">{deliveries.filter((item) => ["approved", "dispatched", "receipt_submitted", "delivery_issue"].includes(item.status)).length} active</span></div>{deliveries.filter((item) => ["approved", "dispatched", "receipt_submitted", "delivery_issue", "delivered"].includes(item.status)).length === 0 ? <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No approved deliveries yet.</p> : <div className="mt-4 space-y-2">{deliveries.filter((item) => ["approved", "dispatched", "receipt_submitted", "delivery_issue", "delivered"].includes(item.status)).map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3"><div><p className="font-semibold text-slate-900">{labels[item.resource_type]} · {item.status === "delivered" ? `${item.received_quantity ?? 0} received` : `${item.approved_quantity ?? item.requested_quantity} ${item.status === "approved" ? "approved" : "in shipment"}`}</p><p className="text-sm text-slate-600">{item.stock_source_location ? `From ${item.stock_source_location} → ${item.location_name}` : `Destination: ${item.location_name}`}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">{item.status.replace(/_/g, " ")}</span></article>)}</div>}</section>
    {loading ? <p role="status" className="card p-6 text-slate-600">Loading stock reports…</p> : reports.length === 0 ? <p className="card p-6 text-slate-600">{filter === "pending" ? "No stock reports are waiting for review." : "No stock reports have been submitted yet."}</p> : <div className="space-y-3">{reports.map((report) => <article key={report.id} className="card border-[#d9e5e1] p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold text-slate-900">{labels[report.resource_type]} · {report.quantity} units</h3><span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${report.status === "approved" ? "bg-emerald-100 text-emerald-900" : report.status === "rejected" ? "bg-red-100 text-red-900" : "bg-amber-100 text-amber-900"}`}>{report.status}</span></div><p className="mt-1 font-medium text-slate-800">{report.location_name}</p><p className="mt-1 text-sm text-slate-700">{report.note}</p><p className="mt-2 text-xs text-slate-500">Submitted by {report.submitter_name} · {new Date(report.submitted_at).toLocaleString()}</p>{report.lat !== null && report.lon !== null && <a className="mt-1 inline-block text-sm font-semibold text-teal-800 underline" href={`https://www.google.com/maps/search/?api=1&query=${report.lat},${report.lon}`} target="_blank" rel="noreferrer">Open reported location</a>}{report.reviewed_at && <p className="mt-2 text-xs text-slate-500">Reviewed by {report.reviewer_name || "official"} · {new Date(report.reviewed_at).toLocaleString()}{report.review_note ? ` · ${report.review_note}` : ""}</p>}</div></div>
      {report.status === "pending" && <div className="mt-4 border-t border-slate-100 pt-4"><label className="block text-sm font-medium text-slate-700">Review note (optional)<textarea maxLength={2000} rows={2} value={notes[report.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [report.id]: event.target.value }))} placeholder="Record how this count was verified" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy === report.id} onClick={() => void review(report, "approved")} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === report.id ? "Saving…" : "Approve and update stock"}</button><button type="button" disabled={busy === report.id} onClick={() => void review(report, "rejected")} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 disabled:opacity-50">Reject report</button></div></div>}
    </article>)}</div>}
    <p className="text-xs leading-relaxed text-slate-500">Approving a report sets the regional available total for that supply type to the submitted count. A report can only be reviewed once.</p>
  </div>;
}
