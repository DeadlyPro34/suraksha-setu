"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  assignDispatch,
  getFieldOfficers,
  getResponsePlans,
  getUnassignedDispatches,
  submitDecision,
} from "@/lib/api";
import { Dispatch, ResponsePlanSummary, User } from "@/lib/types";

export default function ApprovalsPage() {
  const [plans, setPlans] = useState<ResponsePlanSummary[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
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
      const [planRows, dispatchRows, officerRows] = await Promise.all([
        getResponsePlans(),
        getUnassignedDispatches(),
        getFieldOfficers(),
      ]);
      setPlans(planRows);
      setDispatches(dispatchRows);
      setOfficers(officerRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load approvals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const decide = async (plan: ResponsePlanSummary, decision: "approved" | "rejected") => {
    setBusyId(plan.id);
    setError(null);
    setNotice(null);
    try {
      await submitDecision(plan.id, decision);
      setNotice(decision === "approved" ? "Plan approved; a field dispatch is ready to assign." : "Plan rejected.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the decision.");
    } finally {
      setBusyId(null);
    }
  };

  const assign = async (dispatch: Dispatch) => {
    const officerId = selectedOfficer[dispatch.id];
    if (!officerId) return;
    setBusyId(dispatch.id);
    setError(null);
    try {
      await assignDispatch(dispatch.id, officerId);
      setNotice("Dispatch assigned to the field officer.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign dispatch.");
    } finally {
      setBusyId(null);
    }
  };

  const pending = plans.filter((plan) => plan.status === "pending_approval");
  const decided = plans.filter((plan) => plan.status !== "pending_approval");

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-slate-900">Plan approvals</h1><p className="text-sm text-slate-500 mt-1">Review AI plans and route approved work to a field officer.</p></div>
          <Link className="text-sm text-blue-700 font-semibold hover:underline" href="/incidents">View incident reports</Link>
        </div>
      </header>
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-3">Awaiting decision</h2>
          {loading ? <p role="status" className="card p-4 text-sm text-slate-500">Loading plans…</p> : pending.length === 0 ? <p className="card p-4 text-sm text-slate-500">No plans need a decision. Analyze an incident report to create one.</p> : (
            <div className="space-y-3">
              {pending.map((plan) => <article className="card p-5" key={plan.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0"><p className="text-xs text-slate-500">Priority {plan.priority_score.toFixed(1)} · {new Date(plan.generated_at).toLocaleString()}</p><h3 className="mt-1 font-semibold text-slate-900">{plan.report_description || `Incident ${plan.incident_id}`}</h3><p className="mt-2 text-sm text-slate-700">{plan.summary}</p><p className="mt-2 text-xs text-slate-400">Report / incident ID: {plan.report_id || plan.incident_id}</p></div>
                  <div className="flex gap-2 shrink-0"><button disabled={busyId === plan.id} onClick={() => void decide(plan, "approved")} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Approve</button><button disabled={busyId === plan.id} onClick={() => void decide(plan, "rejected")} className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Reject</button></div>
                </div>
              </article>)}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-3">Dispatches to assign</h2>
          {dispatches.length === 0 ? <p className="card p-4 text-sm text-slate-500">No unassigned field dispatches.</p> : <div className="space-y-3">{dispatches.map((dispatch) => <article key={dispatch.id} className="card p-4 flex flex-wrap items-center justify-between gap-3"><div className="text-sm text-slate-700">{dispatch.message}<p className="text-xs text-slate-400 mt-1">Incident {dispatch.incident_id || "unknown"}</p></div><div className="flex gap-2"><select aria-label="Assign to field officer" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={selectedOfficer[dispatch.id] || ""} onChange={(event) => setSelectedOfficer((current) => ({ ...current, [dispatch.id]: event.target.value }))}><option value="">Choose officer</option>{officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.name}</option>)}</select><button disabled={!selectedOfficer[dispatch.id] || busyId === dispatch.id} onClick={() => void assign(dispatch)} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Assign</button></div></article>)}</div>}
          {officers.length === 0 && dispatches.length > 0 && <p className="mt-2 text-xs text-amber-800">No field-officer accounts exist yet. Register an officer account first.</p>}
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-3">Recorded decisions</h2>
          {decided.length === 0 ? <p className="card p-4 text-sm text-slate-500">No decisions have been recorded yet.</p> : <div className="space-y-2">{decided.map((plan) => <article key={plan.id} className="card p-4 flex items-center justify-between gap-4"><div><h3 className="font-medium text-slate-800">{plan.report_description || `Incident ${plan.incident_id}`}</h3><p className="text-sm text-slate-500 mt-1">{plan.summary}</p></div><span className="badge capitalize">{plan.status.replace(/_/g, " ")}</span></article>)}</div>}
        </section>
      </div>
    </main>
  );
}
