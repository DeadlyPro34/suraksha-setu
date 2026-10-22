"use client";

import { useCallback, useEffect, useState } from "react";
import { acknowledgeDispatch, getMyDispatches } from "@/lib/api";
import { Dispatch } from "@/lib/types";

export default function FieldOfficerHome() {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setDispatches(await getMyDispatches()); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not load assignments."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const acknowledge = async (dispatchId: string) => {
    setBusyId(dispatchId);
    setError(null);
    try {
      await acknowledgeDispatch(dispatchId);
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not acknowledge assignment."); }
    finally { setBusyId(null); }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-start justify-between gap-4 mb-6"><div><h1 className="text-3xl font-bold text-slate-900">My assignments</h1><p className="text-slate-500 mt-1">Dispatch instructions assigned by the response team.</p></div><button onClick={() => void refresh()} className="rounded-lg border bg-white px-3 py-2 text-sm font-medium">Refresh</button></header>
        {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {loading ? <p role="status" className="card p-5 text-sm text-slate-500">Loading assignments…</p> : dispatches.length === 0 ? <div className="card p-8 text-center text-slate-500">No assignments have been assigned to your account yet.</div> : <div className="space-y-3">{dispatches.map((dispatch) => <article key={dispatch.id} className="card p-5">
          <div className="flex flex-wrap justify-between gap-4"><div className="min-w-0"><span className={`badge ${dispatch.status === "acknowledged" ? "badge-success" : "badge-warning"}`}>{dispatch.status}</span><h2 className="font-semibold text-slate-900 mt-2">{dispatch.message}</h2><p className="text-xs text-slate-500 mt-2">{dispatch.report_id ? `Report ${dispatch.report_id}` : `Incident ${dispatch.incident_id || "unavailable"}`}</p>{dispatch.dispatched_at && <p className="text-xs text-slate-400 mt-1">Assigned {new Date(dispatch.dispatched_at).toLocaleString()}</p>}</div>
            {dispatch.status !== "acknowledged" && <button disabled={busyId === dispatch.id} onClick={() => void acknowledge(dispatch.id)} className="self-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyId === dispatch.id ? "Saving…" : "Acknowledge"}</button>}
          </div>
        </article>)}</div>}
      </div>
    </main>
  );
}
