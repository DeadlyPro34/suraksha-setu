"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { confirmSupplyReceipt, createSupplyRequest, getMySupplyRequests } from "@/lib/api";
import { Resource, SupplyRequest } from "@/lib/types";

const supplyLabels: Record<Resource["type"], string> = {
  medical: "Medical supplies", food: "Food", water: "Drinking water", boat: "Rescue boats", personnel: "Personnel",
};
const statusClasses: Record<SupplyRequest["status"], string> = {
  pending: "bg-amber-100 text-amber-950", approved: "bg-blue-100 text-blue-950", rejected: "bg-red-100 text-red-950",
  dispatched: "bg-violet-100 text-violet-950", receipt_submitted: "bg-cyan-100 text-cyan-950", delivery_issue: "bg-orange-100 text-orange-950", delivered: "bg-emerald-100 text-emerald-950",
};
const dateLabel = (date: string) => new Date(date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function SupplyRequestPanel() {
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [resourceType, setResourceType] = useState<Resource["type"]>("water");
  const [quantity, setQuantity] = useState(1);
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [receipts, setReceipts] = useState<Record<string, { quantity: number; note: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try { setRequests(await getMySupplyRequests()); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load supply requests."); }
    finally { if (!quiet) setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 20000);
    return () => window.clearInterval(timer);
  }, [load]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("create"); setError(""); setNotice("");
    try {
      await createSupplyRequest({ resource_type: resourceType, requested_quantity: quantity, location_name: location.trim(), note: note.trim(), lat: coords?.lat ?? null, lon: coords?.lon ?? null });
      setQuantity(1); setLocation(""); setNote(""); setCoords(null);
      setNotice("Supply request sent to officials for approval.");
      await load(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not submit the supply request."); }
    finally { setBusy(null); }
  };

  const captureLocation = () => {
    if (!navigator.geolocation) { setError("This device does not provide location access. Enter the location manually."); return; }
    setBusy("location"); setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => { setCoords({ lat: position.coords.latitude, lon: position.coords.longitude }); setBusy(null); },
      (cause) => { setError(cause.message || "Could not get your current location."); setBusy(null); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  const sendReceipt = async (event: FormEvent, request: SupplyRequest) => {
    event.preventDefault();
    const dispatched = request.dispatched_quantity ?? request.approved_quantity ?? 0;
    const draft = receipts[request.id] || { quantity: dispatched, note: "" };
    setBusy(request.id); setError(""); setNotice("");
    try {
      await confirmSupplyReceipt(request.id, draft.quantity, draft.note.trim());
      setNotice(draft.quantity < dispatched ? "Short delivery reported. Officials will review and close the delivery." : "Receipt submitted. Officials will review and close the delivery.");
      await load(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not submit delivery confirmation."); }
    finally { setBusy(null); }
  };

  const updateReceipt = (
    id: string,
    request: SupplyRequest,
    update: { quantity?: number; note?: string },
  ) => {
    setReceipts((current) => ({
      ...current,
      [id]: {
        quantity: current[id]?.quantity ?? request.dispatched_quantity ?? request.approved_quantity ?? 0,
        note: current[id]?.note ?? "",
        ...update,
      },
    }));
  };

  return <section className="card border-l-4 border-l-teal-600 p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-teal-800">Field supplies</p><h2 className="mt-1 text-xl font-bold text-slate-900">Request and track supplies</h2><p className="mt-1 text-sm text-slate-600">Only this account&apos;s requests appear here. Officials approve requests and close delivery reports; recipients only submit what arrived.</p></div><span className="rounded-full bg-teal-50 px-3 py-1.5 text-sm font-bold text-teal-900">{requests.filter((request) => ["pending", "approved", "dispatched", "receipt_submitted", "delivery_issue"].includes(request.status)).length} open</span></div>
    {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    <form onSubmit={(event) => void create(event)} className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
      <label className="text-sm font-semibold text-slate-700">Supply type<select value={resourceType} onChange={(event) => setResourceType(event.target.value as Resource["type"])} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="water">Drinking water</option><option value="food">Food</option><option value="medical">Medical supplies</option><option value="boat">Rescue boats</option><option value="personnel">Personnel</option></select></label>
      <label className="text-sm font-semibold text-slate-700">Quantity needed<input type="number" min={1} max={1000000} required value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" /></label>
      <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Delivery location<input required minLength={2} maxLength={200} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Address, shelter, or field landmark" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" /></label>
      <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Why is it needed?<textarea required minLength={3} maxLength={2000} rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Describe who needs the supplies and how urgently." className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" /></label>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2"><button type="button" disabled={busy === "location"} onClick={captureLocation} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">{busy === "location" ? "Getting location…" : coords ? `Location attached · ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}` : "Attach current location (optional)"}</button><button type="submit" disabled={busy === "create" || !location.trim() || !note.trim()} className="rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy === "create" ? "Sending request…" : "Submit supply request"}</button></div>
    </form>
    <div className="mt-5"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-semibold text-slate-900">Your supply requests</h3><button type="button" onClick={() => void load()} disabled={loading} className="text-sm font-semibold text-teal-800 hover:underline">{loading ? "Refreshing…" : "Refresh"}</button></div>
      {loading ? <p role="status" className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Loading requests…</p> : requests.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No supply requests submitted yet.</p> : <div className="space-y-3">{requests.map((request) => <article key={request.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-bold text-slate-900">{supplyLabels[request.resource_type]} · {request.approved_quantity ?? request.requested_quantity} {request.approved_quantity == null ? "requested" : "approved"}</h4><p className="mt-1 text-sm text-slate-700">{request.location_name} · {request.note}</p><p className="mt-1 text-xs text-slate-500">Requested by {request.requester_name} ({request.requester_role.replace(/_/g, " ")}) · {dateLabel(request.created_at)}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusClasses[request.status]}`}>{request.status.replace(/_/g, " ")}</span></div>
        <ol aria-label="Delivery progress" className="mt-4 grid grid-cols-2 gap-2 text-center text-xs font-semibold sm:grid-cols-5 sm:gap-1 sm:text-xs">{["Requested", "Approved", "Dispatched", "Receipt sent", "Officially closed"].map((step, index) => { const completedThrough = request.status === "delivered" ? 4 : request.status === "receipt_submitted" ? 3 : request.status === "delivery_issue" ? 2 : request.status === "dispatched" ? 2 : request.status === "approved" ? 1 : 0; const complete = request.status !== "rejected" && index <= completedThrough; return <li key={step} className={`rounded-md px-1 py-2 ${complete ? "bg-teal-100 text-teal-950" : "bg-slate-100 text-slate-500"}`}>{step}</li>; })}</ol>
        {(request.reviewer_name || request.review_note) && <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-950"><strong>Official review{request.reviewer_name ? ` · ${request.reviewer_name}` : ""}</strong>{request.reviewed_at ? ` · ${dateLabel(request.reviewed_at)}` : ""}{request.review_note && <p className="mt-1">{request.review_note}</p>}</div>}
        {(request.dispatched_quantity != null && request.approved_quantity != null && request.dispatched_quantity < request.approved_quantity) && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>Stock shortage:</strong> {request.dispatched_quantity} of {request.approved_quantity} approved units are being sent; {request.approved_quantity - request.dispatched_quantity} remain unfulfilled due to limited stock.</p>}
        {(request.delivery_handler || request.dispatcher_name || request.stock_source_location || request.dispatched_at || request.dispatch_note) && <div className="mt-2 rounded-lg bg-violet-50 p-3 text-sm text-violet-950"><strong>Dispatch details</strong>{request.delivery_handler && <p className="mt-1">Handler: {request.delivery_handler}</p>}{request.dispatcher_name && <p>Recorded by: {request.dispatcher_name}</p>}{request.stock_source_location && <p>Stock sent from: {request.stock_source_location}</p>}{request.dispatched_at && <p>Dispatched: {dateLabel(request.dispatched_at)}</p>}{request.dispatch_note && <p className="mt-1">{request.dispatch_note}</p>}</div>}
        {request.status === "dispatched" || request.status === "delivery_issue" ? <form onSubmit={(event) => void sendReceipt(event, request)} className="mt-4 grid gap-2 rounded-lg border border-violet-200 bg-violet-50/60 p-3 sm:grid-cols-[minmax(120px,.35fr)_1fr_auto] sm:items-end"><label className="text-sm font-semibold text-slate-700">Quantity received<input type="number" min={0} max={request.dispatched_quantity ?? request.approved_quantity ?? 0} required value={receipts[request.id]?.quantity ?? request.dispatched_quantity ?? request.approved_quantity ?? 0} onChange={(event) => updateReceipt(request.id, request, { quantity: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label><label className="text-sm font-semibold text-slate-700">Receipt note (required if fewer arrived)<input value={receipts[request.id]?.note || ""} onChange={(event) => updateReceipt(request.id, request, { note: event.target.value })} placeholder="Confirm receipt or describe missing items" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label><button type="submit" disabled={busy === request.id || ((receipts[request.id]?.quantity ?? request.dispatched_quantity ?? request.approved_quantity ?? 0) < (request.dispatched_quantity ?? request.approved_quantity ?? 0) && !receipts[request.id]?.note?.trim())} className="rounded-lg bg-violet-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy === request.id ? "Sending…" : "Submit receipt to officials"}</button></form> : null}
        {request.status === "receipt_submitted" && (
          <div role="status" className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-950">
            <strong>Receipt sent · awaiting official closure</strong>
            <p className="mt-1">
              {request.receiver_name || "Recipient"} reported {request.received_quantity} of {request.dispatched_quantity ?? request.approved_quantity} dispatched units received
              {request.received_at ? ` · ${dateLabel(request.received_at)}` : ""}.
            </p>
            {request.receipt_note && <p className="mt-1">Receipt note: {request.receipt_note}</p>}
            <p className="mt-2 font-medium">Officials will review the received quantity and update the stock record when they close this delivery.</p>
          </div>
        )}
        {request.status === "delivery_issue" && (
          <p role="alert" className="mt-2 text-sm font-semibold text-orange-900">
            Short delivery reported: {request.received_quantity} of {request.dispatched_quantity ?? request.approved_quantity} dispatched units received. Officials have been notified.
          </p>
        )}
        {request.status === "delivered" && (
          <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-950">
            <strong>Delivery officially closed</strong>
            {request.receipt_status === "official_override" ? (
              <p className="mt-1">
                Closed by {request.closer_name || "an official"} without recipient confirmation
                {request.closed_at ? ` · ${dateLabel(request.closed_at)}` : ""}.
              </p>
            ) : (
              <p className="mt-1">
                {request.receiver_name || "Recipient"} confirmed {request.received_quantity} received
                {request.received_at ? ` · ${dateLabel(request.received_at)}` : ""}.
              </p>
            )}
            {request.dispatched_quantity != null && request.approved_quantity != null && request.dispatched_quantity < request.approved_quantity && <p className="mt-1">Still unfulfilled due to limited stock: {request.approved_quantity - request.dispatched_quantity} units.</p>}
            {request.stock_source_location && <p>Stock was issued from: {request.stock_source_location}</p>}
            {request.closer_name && request.receipt_status !== "official_override" && (
              <p>Closed by {request.closer_name}{request.closed_at ? ` · ${dateLabel(request.closed_at)}` : ""}</p>
            )}
            {request.receipt_note && <p className="mt-1">Recipient note: {request.receipt_note}</p>}
            {request.official_close_note && <p className="mt-1">Official note: {request.official_close_note}</p>}
          </div>
        )}
      </article>)}</div>}
    </div>
  </section>;
}
