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

type ApprovalView = "pending" | "approved" | "rejected" | "dispatches";

export default function ApprovalsPage() {
  const [plans, setPlans] = useState<ResponsePlanSummary[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [officers, setOfficers] = useState<Array<Pick<User, "id" | "name">>>([]);
  const [selectedOfficer, setSelectedOfficer] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<ApprovalView>("pending");

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
  const approved = plans.filter((plan) => plan.status === "approved" || plan.status === "modified");
  const rejected = plans.filter((plan) => plan.status === "rejected");
  const tabs: Array<{ id: ApprovalView; label: string; count: number }> = [
    { id: "pending", label: "Awaiting decision", count: pending.length },
    { id: "approved", label: "Approved", count: approved.length },
    { id: "rejected", label: "Rejected", count: rejected.length },
    { id: "dispatches", label: "Dispatches to assign", count: dispatches.length },
  ];

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900">Response approvals</h1><p className="mt-1 text-sm text-slate-600">Pending plans, decisions, and dispatch assignments are kept in separate views.</p></div>
        <Link className="text-sm font-semibold text-blue-700 hover:underline" href="/incidents">View incident reports →</Link>
      </header>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{notice}</p>}

      <nav className="card flex flex-wrap gap-2 p-3" aria-label="Approval views">
        {tabs.map((tab) => <button key={tab.id} aria-pressed={view === tab.id} onClick={() => setView(tab.id)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${view === tab.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
          {tab.label}<span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${view === tab.id ? "bg-white/20" : "bg-white"}`}>{loading ? "…" : tab.count}</span>
        </button>)}
      </nav>

      {view === "pending" && <section className="space-y-3" aria-label="Plans awaiting decision">
        {loading ? <p role="status" className="card p-5 text-sm text-slate-500">Loading plans…</p> : pending.length === 0 ? <p className="card p-6 text-sm text-slate-500">No plans need a decision. Analyze a report to add one here.</p> : pending.map((plan) => <article className="card p-5" key={plan.id}>
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
            <div className="w-full min-w-0 flex-1 sm:w-auto"><div className="flex flex-wrap items-center gap-2"><span className="badge badge-warning">Pending</span><span className="badge badge-info">Priority {plan.priority_score.toFixed(1)}</span><span className="text-xs text-slate-500">{new Date(plan.generated_at).toLocaleString()}</span></div><h2 className="mt-2 font-semibold text-slate-900">{plan.report_description || `Incident ${plan.incident_id}`}</h2><p className="mt-2 text-sm leading-6 text-slate-700">{plan.summary}</p><p className="mt-2 break-all text-xs text-slate-400">Report ID: {plan.report_id || plan.incident_id}</p></div>
            <div className="flex w-full shrink-0 gap-2 sm:w-auto"><button disabled={busyId === plan.id} onClick={() => void decide(plan, "approved")} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:flex-none flex-1">Approve</button><button disabled={busyId === plan.id} onClick={() => void decide(plan, "rejected")} className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:flex-none flex-1">Reject</button></div>
          </div>
        </article>)}
      </section>}

      {(view === "approved" || view === "rejected") && <section className="space-y-3" aria-label={`${view} plans`}>
        {loading ? <p role="status" className="card p-5 text-sm text-slate-500">Loading decisions…</p> : (view === "approved" ? approved : rejected).length === 0 ? <p className="card p-6 text-sm text-slate-500">No {view} plans yet.</p> : (view === "approved" ? approved : rejected).map((plan) => <article key={plan.id} className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-900">{plan.report_description || `Incident ${plan.incident_id}`}</h2><p className="mt-1 text-sm text-slate-600">{plan.summary}</p><p className="mt-2 text-xs text-slate-500">Priority {plan.priority_score.toFixed(1)} · Decided plan · {new Date(plan.generated_at).toLocaleString()}</p></div><span className={`badge capitalize ${plan.status === "rejected" ? "badge-danger" : "badge-success"}`}>{plan.status === "modified" ? "approved · modified" : plan.status}</span></div>
        </article>)}
      </section>}

      {view === "dispatches" && <section className="space-y-3" aria-label="Unassigned dispatches">
        {loading ? <p role="status" className="card p-5 text-sm text-slate-500">Loading dispatches…</p> : dispatches.length === 0 ? <p className="card p-6 text-sm text-slate-500">No unassigned field dispatches.</p> : dispatches.map((dispatch) => <article key={dispatch.id} className="card flex flex-wrap items-center justify-between gap-3 p-4"><div className="text-sm text-slate-700">{dispatch.message}<p className="mt-1 text-xs text-slate-400">Incident {dispatch.incident_id || "unknown"}</p></div><div className="flex flex-wrap gap-2"><select aria-label="Assign to field officer" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={selectedOfficer[dispatch.id] || ""} onChange={(event) => setSelectedOfficer((current) => ({ ...current, [dispatch.id]: event.target.value }))}><option value="">Choose officer</option>{officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.name}</option>)}</select><button disabled={!selectedOfficer[dispatch.id] || busyId === dispatch.id} onClick={() => void assign(dispatch)} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Assign</button></div></article>)}
        {officers.length === 0 && dispatches.length > 0 && <p className="text-xs text-amber-800">No field-officer accounts exist yet. Register an officer account first.</p>}
      </section>}
    </div>
  );
}
