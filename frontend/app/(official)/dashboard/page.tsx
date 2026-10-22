"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getAlerts, getReports, getShelters } from "@/lib/api";
import { Alert, Report, Shelter } from "@/lib/types";

const statusClass: Record<string, string> = {
  pending_verification: "badge-warning",
  verified: "badge-success",
  rejected: "badge-danger",
};

export default function OfficialDashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
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

  return (
    <div className="space-y-6">
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
    </div>
  );
}
