"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { acknowledgeDispatchCompletion, assignDispatch, getFieldOfficers, getFieldOfficerTasks, getUnassignedDispatches } from "@/lib/api";
import { Dispatch, User } from "@/lib/types";

export default function FieldOfficersPage() {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [officerTasks, setOfficerTasks] = useState<Dispatch[]>([]);
  const [reportsUnavailable, setReportsUnavailable] = useState(false);
  const [officers, setOfficers] = useState<Array<Pick<User, "id" | "name">>>([]);
  const [selectedOfficer, setSelectedOfficer] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dispatchRows, officerRows] = await Promise.all([getUnassignedDispatches(), getFieldOfficers()]);
      setDispatches(dispatchRows);
      setOfficers(officerRows);
      try {
        setOfficerTasks(await getFieldOfficerTasks());
        setReportsUnavailable(false);
      } catch {
        setOfficerTasks([]);
        setReportsUnavailable(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load field officer assignments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const assign = async (dispatch: Dispatch) => {
    const officerId = selectedOfficer[dispatch.id];
    if (!officerId) return;
    setBusyId(dispatch.id);
    setError(null);
    setNotice(null);
    try {
      const officer = officers.find((person) => person.id === officerId);
      await assignDispatch(dispatch.id, officerId);
      setDispatches((current) => current.filter((item) => item.id !== dispatch.id));
      setNotice(`${officer?.name || "Field officer"} was assigned to the dispatch.`);
      setSelectedOfficer((current) => { const next = { ...current }; delete next[dispatch.id]; return next; });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not assign the dispatch.");
    } finally {
      setBusyId(null);
    }
  };

  const acknowledgeReport = async (task: Dispatch) => {
    setBusyId(task.id);
    setError(null);
    setNotice(null);
    try {
      const updated = await acknowledgeDispatchCompletion(task.id);
      setOfficerTasks((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice(`Work report from ${task.assignee_name || "the field officer"} acknowledged.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not acknowledge the work report.");
    } finally {
      setBusyId(null);
    }
  };

  const stats = [
    { label: "Registered field officers", value: officers.length, accent: "border-sky-700" },
    { label: "Dispatches awaiting assignment", value: dispatches.length, accent: "border-emerald-600" },
    { label: "Ready to assign", value: officers.length > 0 ? dispatches.length : 0, accent: "border-slate-400" },
    { label: "Dispatches blocked", value: officers.length === 0 ? dispatches.length : 0, accent: "border-amber-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Field officer coordination</h2>
          <p className="mt-1 text-sm text-slate-600">Review the officer roster, assign response work, and track dispatches waiting for an officer.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{loading ? "Refreshing…" : "Refresh"}</button>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}

      <section aria-label="Field officer summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((item) => <article key={item.label} className={`card border-t-4 ${item.accent} p-4 sm:p-5`}>
          <p className="text-2xl font-bold text-slate-900">{loading ? "…" : error ? "—" : item.value}</p>
          <p className="mt-1 text-sm text-slate-600">{item.label}</p>
        </article>)}
      </section>

      <section className="card p-5">
        <div className="mb-3 flex items-baseline justify-between gap-2"><div><h3 className="font-semibold text-slate-900">Field officer roster</h3><p className="mt-1 text-sm text-slate-500">Registered accounts available for assignment.</p></div><span className="badge badge-info">{officers.length} {officers.length === 1 ? "officer" : "officers"}</span></div>
        {loading ? <p role="status" className="text-sm text-slate-500">Loading field officers…</p> : officers.length === 0 ? <p className="text-sm text-slate-500">No field officer accounts registered yet. Register an officer to start assigning dispatches.</p> : <ul className="grid gap-3 sm:grid-cols-2">{officers.map((officer) => <li key={officer.id} className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-800">{officer.name}</li>)}</ul>}
      </section>

      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div><h3 className="font-semibold text-slate-900">Unassigned dispatches</h3><p className="mt-1 text-sm text-slate-500">Dispatches are created when a response plan is approved.</p></div>
          <Link href="/approvals" className="text-sm font-semibold text-blue-700 hover:underline">Review plans →</Link>
        </div>
        {loading ? <p role="status" className="text-sm text-slate-500">Loading dispatches and officers…</p> : dispatches.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No field dispatches are waiting for assignment.</p> : (
          <div className="space-y-3">
            {dispatches.map((dispatch) => (
              <article key={dispatch.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{dispatch.message}</p>
                  <p className="mt-1 text-xs text-slate-500">Incident {dispatch.incident_id || "unavailable"}{dispatch.priority_score != null ? ` · Priority ${dispatch.priority_score}` : ""}</p>
                </div>
                {officers.length > 0 ? <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  <select aria-label={`Choose field officer for ${dispatch.message}`} className="min-w-52 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:flex-none" value={selectedOfficer[dispatch.id] || ""} onChange={(event) => setSelectedOfficer((current) => ({ ...current, [dispatch.id]: event.target.value }))}>
                    <option value="">Choose field officer</option>
                    {officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.name}</option>)}
                  </select>
                  <button type="button" disabled={!selectedOfficer[dispatch.id] || busyId === dispatch.id} onClick={() => void assign(dispatch)} className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyId === dispatch.id ? "Assigning…" : "Assign"}</button>
                </div> : <span className="text-sm text-amber-800">No field officer accounts. Register an officer first.</span>}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div><h3 className="font-semibold text-slate-900">Field officer work reports</h3><p className="mt-1 text-sm text-slate-500">Progress updates and completion reports submitted from officers’ assignment pages.</p></div>
          <span className="badge badge-info">{officerTasks.filter((task) => task.completion_note).length} reports</span>
        </div>
        {reportsUnavailable && <p role="status" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Officer report data is unavailable because the backend has not loaded the latest routes. Restart the backend service, then refresh this page.</p>}
        {loading ? <p role="status" className="text-sm text-slate-500">Loading officer activity…</p> : officerTasks.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No field officer assignments yet.</p> : <div className="space-y-3">{officerTasks.map((task) => (
          <article key={task.id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{task.assignee_name || "Field officer"}</p><span className={`badge ${task.status === "completed" ? "badge-success" : task.status === "needs_help" ? "badge-danger" : ["acknowledged", "en_route", "arrived"].includes(task.status) ? "badge-info" : "badge-warning"}`}>{task.status.replace(/_/g, " ")}</span></div>
                <p className="mt-1 text-sm text-slate-700">{task.message}</p>
                <p className="mt-1 text-xs text-slate-500">Incident {task.incident_id || "unavailable"}{task.completed_at ? ` · Reported ${new Date(task.completed_at).toLocaleString()}` : ""}</p>
              </div>
            </div>
            {task.completion_note ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3"><p className="text-sm font-semibold text-emerald-900">Officer work report</p><p className="mt-1 whitespace-pre-wrap text-sm text-emerald-950">{task.completion_note}</p>{task.completion_acknowledged_at ? <p className="mt-2 text-xs font-semibold text-emerald-800">Acknowledged · {new Date(task.completion_acknowledged_at).toLocaleString()}</p> : <button type="button" disabled={busyId === task.id} onClick={() => void acknowledgeReport(task)} className="mt-3 rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyId === task.id ? "Saving…" : "Acknowledge report"}</button>}</div> : <p className="mt-3 text-sm text-slate-500">No completion report submitted yet.</p>}
          </article>
        ))}</div>}
      </section>

    </div>
  );
}
