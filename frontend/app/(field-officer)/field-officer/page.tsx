"use client";

import { useCallback, useEffect, useState } from "react";
import { acknowledgeDispatch, completeVolunteerTask, getCurrentUser, getMyDispatches } from "@/lib/api";
import { Dispatch, User } from "@/lib/types";

export default function FieldOfficerHome() {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [account, setAccount] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setDispatches(await getMyDispatches()); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not load assignments."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => { getCurrentUser().then(setAccount).catch(() => undefined); }, []);

  const acknowledge = async (dispatchId: string) => {
    setBusyId(dispatchId);
    setError(null);
    try {
      await acknowledgeDispatch(dispatchId);
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not acknowledge assignment."); }
    finally { setBusyId(null); }
  };

  const complete = async (dispatchId: string) => {
    const note = completionNotes[dispatchId]?.trim();
    if (!note) {
      setError("Add a short note about the work completed before submitting.");
      return;
    }
    setBusyId(dispatchId);
    setError(null);
    try {
      await completeVolunteerTask(dispatchId, note);
      setCompletionNotes((current) => ({ ...current, [dispatchId]: "" }));
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not submit the completion report."); }
    finally { setBusyId(null); }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-start justify-between gap-4 mb-6"><div><h1 className="text-3xl font-bold text-slate-900">{account?.role === "volunteer" ? "My volunteer tasks" : "My field assignments"}</h1><p className="text-slate-500 mt-1">{account ? `For ${account.name} · ${account.role === "volunteer" ? "Volunteer" : "Field officer"} account` : "Dispatch instructions assigned by the response team."}</p></div><button onClick={() => void refresh()} className="rounded-lg border bg-white px-3 py-2 text-sm font-medium">Refresh</button></header>
        {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {loading ? <p role="status" className="card p-5 text-sm text-slate-500">Loading assignments…</p> : dispatches.length === 0 ? <div className="card p-8 text-center text-slate-500">{account?.role === "volunteer" ? "No volunteer tasks have been assigned to your account yet. Your assignments will appear here." : "No assignments have been assigned to your account yet."}</div> : <div className="space-y-3">{dispatches.map((dispatch) => <article key={dispatch.id} className="card p-5">
          <div className="flex flex-wrap justify-between gap-4"><div className="min-w-0"><span className={`badge ${dispatch.status === "completed" || dispatch.status === "acknowledged" ? "badge-success" : "badge-warning"}`}>{dispatch.status === "completed" ? "Completed" : dispatch.status}</span><h2 className="font-semibold text-slate-900 mt-2">{dispatch.message}</h2><p className="text-xs text-slate-500 mt-2">{dispatch.report_id ? `Report ${dispatch.report_id}` : `Incident ${dispatch.incident_id || "unavailable"}`}</p>{dispatch.target_role === "volunteer" && <p className="mt-2 text-sm font-medium text-blue-800">Team staffing: {dispatch.volunteers_assigned ?? 1} of {dispatch.volunteers_needed ?? 1} volunteers assigned</p>}{dispatch.dispatched_at && <p className="text-xs text-slate-400 mt-1">Assigned {new Date(dispatch.dispatched_at).toLocaleString()}</p>}</div>
            {dispatch.status === "sent" && <button disabled={busyId === dispatch.id} onClick={() => void acknowledge(dispatch.id)} className="self-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyId === dispatch.id ? "Saving…" : "Acknowledge"}</button>}
          </div>
          {dispatch.status === "acknowledged" && account?.role === "volunteer" && dispatch.target_role === "volunteer" && <div className="mt-4 border-t border-slate-100 pt-4"><label htmlFor={`completion-${dispatch.id}`} className="block text-sm font-semibold text-slate-800">Report task completion</label><p className="mt-1 text-xs text-slate-500">Tell the response team what you completed or anything that still needs attention.</p><textarea id={`completion-${dispatch.id}`} rows={3} maxLength={2000} required value={completionNotes[dispatch.id] || ""} onChange={(event) => setCompletionNotes((current) => ({ ...current, [dispatch.id]: event.target.value }))} placeholder="Example: Distributed water to 18 families. The north entrance still needs supplies." className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /><button type="button" disabled={busyId === dispatch.id || !completionNotes[dispatch.id]?.trim()} onClick={() => void complete(dispatch.id)} className="mt-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyId === dispatch.id ? "Submitting report…" : "Mark task complete and send report"}</button></div>}
          {dispatch.status === "completed" && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm font-semibold text-emerald-900">Completion report sent to officials</p><p className="mt-1 whitespace-pre-wrap text-sm text-emerald-900">{dispatch.completion_note}</p>{dispatch.completed_at && <p className="mt-2 text-xs text-emerald-800">Submitted {new Date(dispatch.completed_at).toLocaleString()}</p>}</div>}
        </article>)}</div>}
      </div>
    </main>
  );
}
