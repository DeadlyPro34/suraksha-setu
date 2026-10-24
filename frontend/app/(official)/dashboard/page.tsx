"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { acknowledgeDispatchCompletion, getAlerts, getFieldOfficerTasks, getReports, getShelters } from "@/lib/api";
import { Alert, Dispatch, Report, Shelter } from "@/lib/types";

const statusClass: Record<string, string> = {
  pending_verification: "badge-warning",
  verified: "badge-success",
  rejected: "badge-danger",
};

export default function OfficialDashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [officerTasks, setOfficerTasks] = useState<Dispatch[]>([]);
  const [officerReportsUnavailable, setOfficerReportsUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyReport, setBusyReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportRows, shelterRows, alertRows] = await Promise.all([
        getReports(), getShelters(), getAlerts(),
      ]);
      setReports(reportRows);
      setShelters(shelterRows);
      setAlerts(alertRows);
      try {
        const officerTaskRows = await getFieldOfficerTasks();
        setOfficerTasks(officerTaskRows.filter((task) => task.completion_note));
        setOfficerReportsUnavailable(false);
      } catch {
        setOfficerTasks([]);
        setOfficerReportsUnavailable(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const openShelters = shelters.filter((shelter) => shelter.status === "open").length;
  const activeAlerts = alerts.filter((alert) => alert.type !== "all_clear").length;
  const pendingReports = reports.filter((report) => report.status === "pending_verification").length;
  const stats = [
    { label: "Recent reports", value: reports.length, accent: "border-t-sky-600" },
    { label: "Pending verification", value: pendingReports, accent: "border-t-amber-500" },
    { label: "Open shelters", value: openShelters, accent: "border-t-emerald-600" },
    { label: "Active alerts", value: activeAlerts, accent: "border-t-red-600" },
  ];

  const acknowledgeOfficerReport = async (task: Dispatch) => {
    setBusyReport(task.id);
    setError(null);
    try {
      const updated = await acknowledgeDispatchCompletion(task.id);
      setOfficerTasks((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not acknowledge the officer report.");
    } finally {
      setBusyReport(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6">
      {error && <div role="alert" className="card flex flex-wrap items-center justify-between gap-3 border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>Could not load dashboard data: {error}</span><button onClick={() => void refresh()} className="font-semibold underline">Try again</button></div>}

      <section aria-label="Response summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((item) => <article key={item.label} className={`card border-t-4 ${item.accent} p-4 sm:p-5`}>
          <p className="text-3xl font-bold text-slate-900">{loading ? "…" : error ? "—" : item.value}</p>
          <p className="mt-1 text-sm text-slate-600">{item.label}</p>
        </article>)}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">Recent incident reports</h2>
            <Link href="/incidents" className="text-sm font-semibold text-blue-700 hover:underline">All incidents</Link>
          </div>
          {loading ? <p role="status" className="card p-5 text-sm text-slate-500">Loading reports…</p>
            : !error && reports.length === 0 ? <p className="card p-5 text-sm text-slate-500">No reports yet. New citizen reports will appear here.</p>
              : !error && <div className="space-y-3">{reports.slice(0, 5).map((report) => <article key={report.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0"><h3 className="font-semibold capitalize text-slate-900">{report.type.replace(/_/g, " ")} report</h3><p className="mt-1 line-clamp-2 text-sm text-slate-600">{report.description}</p><p className="mt-2 text-xs text-slate-400">{new Date(report.created_at).toLocaleString()} · {report.lat.toFixed(4)}, {report.lon.toFixed(4)}</p></div>
                  <span className={`badge capitalize ${statusClass[report.status] || "badge-neutral"}`}>{report.status.replace(/_/g, " ")}</span>
                </div>
              </article>)}</div>}
        </section>

        <aside className="space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-slate-900">Shelter availability</h2><Link href="/official/shelters" className="text-sm font-semibold text-blue-700 hover:underline">View all</Link></div>
            <div className="card space-y-4 p-5">
              {loading ? <p role="status" className="text-sm text-slate-500">Loading shelters…</p>
                : shelters.length === 0 ? <p className="text-sm text-slate-500">No shelters are registered.</p>
                  : shelters.filter((shelter) => shelter.status === "open").slice(0, 4).map((shelter) => <div key={shelter.id}>
                    <div className="flex justify-between gap-3 text-sm"><span className="truncate text-slate-700">{shelter.name}</span><span className="shrink-0 font-semibold text-emerald-700">{shelter.available_percentage}% free</span></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, shelter.available_percentage))}%` }} /></div>
                  </div>)}
              <Link href="/official/shelters" className="inline-flex text-sm font-semibold text-blue-700 hover:underline">Open shelter directory →</Link>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-slate-900">Latest alerts</h2><Link href="/approvals" className="text-sm font-semibold text-blue-700 hover:underline">Review plans</Link></div>
            <div className="card divide-y divide-slate-100 p-4">
              {loading ? <p className="text-sm text-slate-500">Loading alerts…</p>
                : alerts.length === 0 ? <p className="text-sm text-slate-500">No alerts have been issued.</p>
                  : alerts.slice(0, 4).map((alert) => <article key={alert.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-sm font-medium capitalize text-slate-800">{alert.type.replace(/_/g, " ")}</p><p className="mt-1 text-sm text-slate-600">{alert.message}</p>
                  </article>)}
            </div>
          </section>
        </aside>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">Field officer work reports</h2><p className="mt-1 text-sm text-slate-500">Recent completion updates submitted from the field.</p></div><Link href="/field-officers" className="text-sm font-semibold text-blue-700 hover:underline">Field officer assignments →</Link></div>
        {officerReportsUnavailable && <p role="status" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Officer report data is unavailable because the backend has not loaded the latest routes. Restart the backend service, then refresh.</p>}
        {loading ? <p role="status" className="card p-5 text-sm text-slate-500">Loading officer reports…</p> : officerTasks.length === 0 ? <p className="card p-5 text-sm text-slate-500">No field officer completion reports yet.</p> : <div className="grid gap-3 xl:grid-cols-2">{officerTasks.slice(0, 4).map((task) => <article key={task.id} className="card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{task.assignee_name || "Field officer"}</h3><p className="mt-1 text-sm text-slate-600">{task.message}</p><p className="mt-1 text-xs text-slate-500">Incident {task.incident_id || "unavailable"}{task.completed_at ? ` · ${new Date(task.completed_at).toLocaleString()}` : ""}</p></div><span className={`badge ${task.completion_acknowledged_at ? "badge-success" : "badge-warning"}`}>{task.completion_acknowledged_at ? "Acknowledged" : "Needs review"}</span></div>
          <p className="mt-3 whitespace-pre-wrap rounded-lg bg-emerald-50 p-3 text-sm text-emerald-950">{task.completion_note}</p>
          {!task.completion_acknowledged_at && <button type="button" disabled={busyReport === task.id} onClick={() => void acknowledgeOfficerReport(task)} className="mt-3 rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyReport === task.id ? "Saving…" : "Acknowledge report"}</button>}
        </article>)}</div>}
      </section>
    </div>
  );
}
