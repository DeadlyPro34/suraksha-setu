"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { closeSupplyDelivery, dispatchSupplyRequest, getResources, getSupplyRequests, reviewSupplyRequest } from "@/lib/api";
import { Resource, SupplyRequest } from "@/lib/types";

const labels: Record<Resource["type"], string> = { medical: "Medical supplies", food: "Food", water: "Drinking water", boat: "Rescue boats", personnel: "Personnel" };
const statusColor: Record<SupplyRequest["status"], string> = { pending: "bg-amber-100 text-amber-950", approved: "bg-blue-100 text-blue-950", rejected: "bg-red-100 text-red-950", dispatched: "bg-violet-100 text-violet-950", receipt_submitted: "bg-cyan-100 text-cyan-950", delivery_issue: "bg-orange-100 text-orange-950", delivered: "bg-emerald-100 text-emerald-950" };
const stamp = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
type Filter = "open" | "pending" | "receipt_review" | "delivered" | "all";

export default function SupplyRequestsPage() {
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [stock, setStock] = useState<Resource[]>([]);
  const [filter, setFilter] = useState<Filter>("open");
  const [approvedQuantities, setApprovedQuantities] = useState<Record<string, number>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [handlers, setHandlers] = useState<Record<string, string>>({});
  const [dispatchNotes, setDispatchNotes] = useState<Record<string, string>>({});
  const [stockSources, setStockSources] = useState<Record<string, string>>({});
  const [dispatchQuantities, setDispatchQuantities] = useState<Record<string, number>>({});
  const [closeQuantities, setCloseQuantities] = useState<Record<string, number>>({});
  const [closeReasons, setCloseReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try { const [requestRows, stockRows] = await Promise.all([getSupplyRequests(), getResources()]); setRequests(requestRows); setStock(stockRows); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load supply requests."); }
    finally { if (!quiet) setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 20000);
    const onFocus = () => { if (document.visibilityState === "visible") void load(true); };
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [load]);

  const filtered = useMemo(() => requests.filter((item) => {
    if (filter === "open") return ["pending", "approved", "dispatched", "receipt_submitted", "delivery_issue"].includes(item.status);
    if (filter === "receipt_review") return ["receipt_submitted", "delivery_issue"].includes(item.status);
    return filter === "all" || item.status === filter;
  }), [filter, requests]);
  const counts = {
    open: requests.filter((item) => ["pending", "approved", "dispatched", "receipt_submitted", "delivery_issue"].includes(item.status)).length,
    pending: requests.filter((item) => item.status === "pending").length,
    receipt_review: requests.filter((item) => ["receipt_submitted", "delivery_issue"].includes(item.status)).length,
    delivered: requests.filter((item) => item.status === "delivered").length,
  };

  const review = async (item: SupplyRequest, decision: "approved" | "rejected") => {
    if (decision === "rejected" && !window.confirm("Reject this supply request? The requester will see the decision and review note.")) return;
    setBusy(item.id); setError(""); setNotice("");
    try {
      await reviewSupplyRequest(item.id, decision, decision === "approved" ? (approvedQuantities[item.id] ?? item.requested_quantity) : undefined, reviewNotes[item.id] || "");
      setNotice(decision === "approved" ? "Supply request approved. Record the handoff when it leaves." : "Supply request rejected and requester notified.");
      await load(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not review the request."); }
    finally { setBusy(null); }
  };

  const dispatch = async (item: SupplyRequest) => {
    setBusy(item.id); setError(""); setNotice("");
    try {
      const selectedStock = stock.find((row) => row.id === stockSources[item.id]);
      const dispatched = dispatchQuantities[item.id] ?? Math.min(item.approved_quantity || 0, selectedStock?.quantity || 0);
      const approved = item.approved_quantity || 0;
      const shortageNote = dispatched < approved ? `Partial dispatch: ${dispatched} of ${approved} approved units sent; ${approved - dispatched} remain unfulfilled due to limited stock.` : "";
      const note = [dispatchNotes[item.id]?.trim(), shortageNote].filter(Boolean).join(" ");
      await dispatchSupplyRequest(item.id, stockSources[item.id] || "", dispatched, handlers[item.id]?.trim() || "", note);
      setNotice(dispatched < approved ? `Partial dispatch recorded: ${dispatched} sent, ${approved - dispatched} remain unfulfilled. The requester can confirm receipt.` : "Dispatch recorded. The requester can now confirm receipt.");
      await load(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not record dispatch."); }
    finally { setBusy(null); }
  };

  const closeDelivery = async (item: SupplyRequest) => {
    const hasReceipt = item.status === "receipt_submitted";
    if (!window.confirm(hasReceipt ? "Close this recipient-confirmed delivery and update destination stock?" : "Close this delivery without recipient confirmation? Record a reason for the audit trail.")) return;
    setBusy(item.id); setError(""); setNotice("");
    try {
      await closeSupplyDelivery(item.id, closeQuantities[item.id] ?? item.received_quantity ?? item.dispatched_quantity ?? item.approved_quantity ?? 0, closeReasons[item.id]?.trim() || "");
      setNotice("Delivery report closed. The received stock was added to destination inventory.");
      await load(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not close delivery."); }
    finally { setBusy(null); }
  };

  const tabs: Array<{ id: Filter; label: string; count?: number }> = [
    { id: "open", label: "Open requests", count: counts.open }, { id: "pending", label: "Needs approval", count: counts.pending },
    { id: "receipt_review", label: "Receipts to close", count: counts.receipt_review }, { id: "delivered", label: "Delivered", count: counts.delivered }, { id: "all", label: "All" },
  ];

  return <div className="mx-auto w-full max-w-screen-2xl space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-teal-800">Field logistics</p><h2 className="mt-1 text-2xl font-bold text-slate-900">Supply delivery tracking</h2><p className="mt-1 max-w-2xl text-sm text-slate-600">Review requests from field officers and volunteers, record handoffs, and close the loop when supplies arrive.</p></div><button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">{loading ? "Refreshing…" : "Refresh"}</button></header>
    <section aria-label="Supply request totals" className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[{ label: "Open", value: counts.open, color: "border-teal-500" }, { label: "Needs approval", value: counts.pending, color: "border-amber-500" }, { label: "Receipts to close", value: counts.receipt_review, color: "border-orange-500" }, { label: "Delivered", value: counts.delivered, color: "border-emerald-500" }].map((item) => <article key={item.label} className={`card border-l-4 ${item.color} p-4`}><p className="text-2xl font-bold tabular-nums text-slate-900">{loading ? "…" : item.value}</p><p className="mt-1 text-sm text-slate-600">{item.label}</p></article>)}</section>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    <nav aria-label="Filter supply requests" className="flex flex-wrap gap-2">{tabs.map((tab) => <button key={tab.id} type="button" aria-pressed={filter === tab.id} onClick={() => setFilter(tab.id)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${filter === tab.id ? "bg-ink text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>{tab.label}{tab.count !== undefined ? ` · ${tab.count}` : ""}</button>)}</nav>
    {loading ? <p role="status" className="card p-6 text-slate-600">Loading supply requests…</p> : filtered.length === 0 ? <div className="card p-8 text-center"><h3 className="font-semibold text-slate-900">No requests here</h3><p className="mt-1 text-sm text-slate-600">Requests will appear as soon as a field officer or volunteer submits one.</p></div> : <div className="space-y-4">{filtered.map((item) => <article key={item.id} className="card border-l-4 border-l-teal-600 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold text-slate-900">{labels[item.resource_type]} · {item.requested_quantity} requested</h3><span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusColor[item.status]}`}>{item.status.replace(/_/g, " ")}</span></div><p className="mt-1 text-sm font-semibold text-slate-800">{item.location_name}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{item.note}</p><p className="mt-2 text-xs text-slate-500">Requested by {item.requester_name} · {item.requester_role.replace(/_/g, " ")} · {stamp(item.created_at)}</p>{item.lat !== null && item.lon !== null && <a href={`/map?lat=${item.lat}&lon=${item.lon}`} className="mt-2 inline-block text-sm font-semibold text-blue-800 underline">View delivery location on response map</a>}</div></div>
      {item.status === "pending" && <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[180px_1fr]"><label className="text-sm font-semibold text-slate-700">Approve quantity<input type="number" min={1} max={item.requested_quantity} value={approvedQuantities[item.id] ?? item.requested_quantity} onChange={(event) => setApprovedQuantities((state) => ({ ...state, [item.id]: Number(event.target.value) }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-semibold text-slate-700">Review note<textarea rows={2} maxLength={2000} value={reviewNotes[item.id] || ""} onChange={(event) => setReviewNotes((state) => ({ ...state, [item.id]: event.target.value }))} placeholder="Optional reason, substitutions, or pickup instructions" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><div className="flex flex-wrap gap-2 sm:col-span-2"><button type="button" disabled={busy === item.id || !approvedQuantities[item.id] && approvedQuantities[item.id] !== undefined} onClick={() => void review(item, "approved")} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy === item.id ? "Saving…" : "Approve request"}</button><button type="button" disabled={busy === item.id} onClick={() => void review(item, "rejected")} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 disabled:opacity-50">Reject</button></div></div>}
      {item.status === "approved" && (() => {
        const needed = item.approved_quantity || 0;
        const matchingStock = stock.filter((row) => row.type === item.resource_type && row.status === "available" && row.quantity > 0);
        const eligibleStock = matchingStock;
        const totalAvailable = matchingStock.reduce((sum, row) => sum + row.quantity, 0);
        const selectedStock = matchingStock.find((row) => row.id === stockSources[item.id]);
        const maxDispatch = Math.min(needed, selectedStock?.quantity || 0);
        const dispatchQuantity = dispatchQuantities[item.id] ?? maxDispatch;
        return <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2"><p className="text-sm font-semibold text-emerald-900 sm:col-span-2">Approved: {item.approved_quantity} {labels[item.resource_type].toLowerCase()}</p><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Dispatch from stock location<select required value={stockSources[item.id] || ""} onChange={(event) => { const sourceId = event.target.value; const source = matchingStock.find((row) => row.id === sourceId); setStockSources((state) => ({ ...state, [item.id]: sourceId })); setDispatchQuantities((state) => ({ ...state, [item.id]: Math.min(needed, source?.quantity || 0) })); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">{eligibleStock.length ? "Choose a stock location" : "No available stock locations"}</option>{eligibleStock.map((row) => <option key={row.id} value={row.id}>{row.location_name} · {row.quantity} available</option>)}</select>{eligibleStock.length === 0 ? <span role="status" className="mt-2 block rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-normal text-amber-950">No {labels[item.resource_type].toLowerCase()} stock is currently marked available. Update or verify stock counts in <Link href="/resource-reports" className="font-semibold underline">Stock reports</Link>.</span> : totalAvailable < needed && <span className="mt-2 block rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-normal text-amber-950">Stock is short: {totalAvailable} available across {matchingStock.length} location{matchingStock.length === 1 ? "" : "s"}, {needed} approved. Choose a location and dispatch what it has; the requester will be told how many remain unfulfilled.</span>}</label><label className="text-sm font-semibold text-slate-700">Quantity to dispatch<input type="number" min={1} max={maxDispatch || undefined} required disabled={!selectedStock} value={dispatchQuantity || ""} onChange={(event) => setDispatchQuantities((state) => ({ ...state, [item.id]: Number(event.target.value) }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />{selectedStock && <span className="mt-1 block text-xs font-normal text-slate-500">Up to {maxDispatch} units available at {selectedStock.location_name}. Any approved balance will be marked unfulfilled.</span>}</label><label className="text-sm font-semibold text-slate-700">Delivery handler / team<input value={handlers[item.id] || ""} onChange={(event) => setHandlers((state) => ({ ...state, [item.id]: event.target.value }))} placeholder="Name of person or delivery team" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-semibold text-slate-700">Dispatch note<input value={dispatchNotes[item.id] || ""} onChange={(event) => setDispatchNotes((state) => ({ ...state, [item.id]: event.target.value }))} placeholder="Vehicle, ETA, or handoff details" maxLength={1800} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 sm:col-span-2" /></label><button type="button" disabled={busy === item.id || !stockSources[item.id] || dispatchQuantity < 1 || dispatchQuantity > maxDispatch || !handlers[item.id]?.trim() || !dispatchNotes[item.id]?.trim()} onClick={() => void dispatch(item)} className="rounded-lg bg-violet-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">{busy === item.id ? "Saving…" : dispatchQuantity < needed ? `Record partial dispatch · ${dispatchQuantity} of ${needed}` : "Record dispatch and deduct stock"}</button></div>;
      })()}
      {item.review_note && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><strong>Review:</strong> {item.review_note}{item.reviewer_name ? ` · ${item.reviewer_name}` : ""}</p>}
      {(item.status === "dispatched" || item.status === "delivery_issue" || item.status === "receipt_submitted") && <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4"><h4 className="font-semibold text-violet-950">Delivery handoff</h4><p className="mt-1 text-sm text-slate-700"><strong>Stock source:</strong> {item.stock_source_location || "Source location unavailable"}</p><p className="mt-1 text-sm text-slate-700"><strong>Handler:</strong> {item.delivery_handler} · Dispatched {item.dispatched_at ? stamp(item.dispatched_at) : ""}</p><p className="mt-1 text-sm text-slate-700"><strong>Quantity sent:</strong> {item.dispatched_quantity ?? item.approved_quantity} of {item.approved_quantity} approved</p>{item.dispatched_quantity != null && item.approved_quantity != null && item.dispatched_quantity < item.approved_quantity && <p className="mt-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>Stock shortage:</strong> {item.approved_quantity - item.dispatched_quantity} approved units remain unfulfilled.</p>}<p className="mt-1 text-sm text-slate-700">{item.dispatch_note}</p>{item.status === "receipt_submitted" && <p className="mt-2 rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-950"><strong>Recipient report:</strong> {item.received_quantity} of {item.dispatched_quantity ?? item.approved_quantity} dispatched units received{item.receiver_name ? ` · confirmed by ${item.receiver_name}` : ""}{item.received_at ? ` · ${stamp(item.received_at)}` : ""}{item.receipt_note ? ` · ${item.receipt_note}` : ""}</p>}{item.status === "delivery_issue" && <p className="mt-2 rounded-lg bg-orange-100 p-3 text-sm font-semibold text-orange-950">Previous short-delivery report: {item.received_quantity} of {item.dispatched_quantity ?? item.approved_quantity} dispatched units received. {item.receipt_note}</p>}{item.status === "receipt_submitted" ? <div className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr_auto] sm:items-end"><label className="text-sm font-semibold text-slate-700">Quantity received<input type="number" min={0} max={item.dispatched_quantity ?? item.approved_quantity ?? 0} value={closeQuantities[item.id] ?? item.received_quantity ?? 0} onChange={(event) => setCloseQuantities((state) => ({ ...state, [item.id]: Number(event.target.value) }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label><label className="text-sm font-semibold text-slate-700">Adjustment reason (if changing quantity)<input value={closeReasons[item.id] || ""} onChange={(event) => setCloseReasons((state) => ({ ...state, [item.id]: event.target.value }))} placeholder="Required only if changing the reported quantity" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label><button type="button" disabled={busy === item.id || ((closeQuantities[item.id] ?? item.received_quantity ?? 0) !== item.received_quantity && (closeReasons[item.id] || "").trim().length < 5)} onClick={() => void closeDelivery(item)} className="rounded-lg bg-violet-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === item.id ? "Saving…" : "Close delivery report"}</button></div> : <div className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr_auto] sm:items-end"><label className="text-sm font-semibold text-slate-700">Quantity confirmed<input type="number" min={0} max={item.dispatched_quantity ?? item.approved_quantity ?? 0} value={closeQuantities[item.id] ?? item.received_quantity ?? item.dispatched_quantity ?? item.approved_quantity ?? 0} onChange={(event) => setCloseQuantities((state) => ({ ...state, [item.id]: Number(event.target.value) }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label><label className="text-sm font-semibold text-slate-700">Reason to close without recipient confirmation<input value={closeReasons[item.id] || ""} onChange={(event) => setCloseReasons((state) => ({ ...state, [item.id]: event.target.value }))} placeholder="Required when recipient cannot confirm" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label><button type="button" disabled={busy === item.id || (closeReasons[item.id] || "").trim().length < 5} onClick={() => void closeDelivery(item)} className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-semibold text-violet-900 disabled:opacity-50">{busy === item.id ? "Saving…" : "Close without recipient confirmation"}</button></div>}</div>}
      {item.status === "delivered" && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h4 className="font-semibold text-emerald-950">Delivery closed · {item.received_quantity} received out of {item.dispatched_quantity ?? item.approved_quantity} sent</h4>{item.dispatched_quantity != null && item.approved_quantity != null && item.dispatched_quantity < item.approved_quantity && <p className="mt-1 text-sm text-amber-900">{item.approved_quantity - item.dispatched_quantity} approved units remain unfulfilled due to limited stock.</p>}{item.receipt_status === "official_override" ? <p className="mt-1 text-sm text-emerald-900">Closed by {item.closer_name || "an official"} without requester confirmation: {item.official_close_note}</p> : <p className="mt-1 text-sm text-emerald-900">Confirmed by {item.receiver_name || item.requester_name}{item.received_at ? ` · ${stamp(item.received_at)}` : ""}{item.receipt_note ? ` · ${item.receipt_note}` : ""}</p>}</div>}
      {item.status === "rejected" && item.review_note && <p className="mt-3 text-sm text-red-800">Rejection note: {item.review_note}</p>}
    </article>)}</div>}
    <p className="text-xs text-slate-500">A request is complete when the recipient confirms the approved quantity. Officials can close it without confirmation only by recording the quantity received and a reason.</p>
  </div>;
}
