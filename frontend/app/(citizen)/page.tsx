"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { checkHealth, getAlerts, getReports, getShelters } from "@/lib/api";
import { Alert, Report, Shelter } from "@/lib/types";

const QUICK_ACTIONS = [
  { icon: "🚨", label: "Report Incident", desc: "Report with GPS, photo & description", href: "/report", color: "bg-red-50 border-red-200 hover:bg-red-100" },
  { icon: "🏠", label: "Find Shelters", desc: "Nearest safe shelters & capacity", href: "/shelters", color: "bg-blue-50 border-blue-200 hover:bg-blue-100" },
  { icon: "📢", label: "Alerts", desc: "Weather alerts & evacuation warnings", href: "#alerts", color: "bg-amber-50 border-amber-200 hover:bg-amber-100" },
  { icon: "📞", label: "Emergency", desc: "Quick dial emergency services", href: "tel:112", color: "bg-green-50 border-green-200 hover:bg-green-100" },
];

export default function CitizenHome() {
  const [backendUp, setBackendUp] = useState<boolean | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [sheltersError, setSheltersError] = useState<string | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    checkHealth().then(() => { if (active) setBackendUp(true); }).catch(() => { if (active) setBackendUp(false); });
    Promise.allSettled([getReports(5), getAlerts(10), getShelters(200)]).then(([reportResult, alertResult, shelterResult]) => {
      if (!active) return;
      if (reportResult.status === "fulfilled") setReports(reportResult.value);
      else setReportsError(reportResult.reason instanceof Error ? reportResult.reason.message : "Could not load reports.");
      if (alertResult.status === "fulfilled") setAlerts(alertResult.value);
      else setAlertsError(alertResult.reason instanceof Error ? alertResult.reason.message : "Could not load alerts.");
      if (shelterResult.status === "fulfilled") setShelters(shelterResult.value);
      else setSheltersError(shelterResult.reason instanceof Error ? shelterResult.reason.message : "Could not load shelters.");
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const activeAlertCount = alerts.filter((alert) => alert.type !== "all_clear").length;
  const openShelterCount = shelters.filter((shelter) => shelter.status === "open").length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Top nav ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛡️</span>
            <h1 className="text-lg font-bold text-slate-900">Suraksha Setu</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${backendUp ? "bg-green-500 animate-pulse-dot" : "bg-red-500"}`} />
            <Link href="/login" className="text-sm text-slate-500 hover:text-blue-600 transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* ── Live service overview ── */}
        <div className="card overflow-hidden animate-fade-in">
          <div className="relative h-52 bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
            <div className="text-center text-white relative z-10">
              <div className="text-4xl mb-2">🛡️</div>
              <h2 className="text-xl font-bold">Community Safety</h2>
              <p className="text-sm text-blue-200 mt-1">
                {backendUp === false ? "Backend unavailable — live records could not be reached." : "Counts below come from the incident, alert, and shelter records."}
              </p>
              <p className="text-xs text-blue-100 mt-2">A live map and weather feed are not connected yet.</p>
            </div>
          </div>

          {/* Counts from API results */}
          <div className="grid grid-cols-3 divide-x divide-slate-200">
            <div className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{loading ? "…" : alertsError ? "—" : activeAlertCount}</div>
              <div className="text-xs text-slate-500 mt-0.5">Recent Alerts</div>
            </div>
            <div className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{loading ? "…" : sheltersError ? "—" : openShelterCount}</div>
              <div className="text-xs text-slate-500 mt-0.5">Open Shelters</div>
            </div>
            <div className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{loading ? "…" : reportsError ? "—" : reports.length}</div>
              <div className="text-xs text-slate-500 mt-0.5">Recent Reports</div>
            </div>
          </div>
        </div>

        {/* ── Quick Actions ── */}
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className={`card card-interactive p-4 border ${action.color} transition-all duration-200`}
              >
                <div className="text-2xl mb-2">{action.icon}</div>
                <div className="font-semibold text-sm text-slate-900">{action.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{action.desc}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Recent alerts from database ── */}
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Recent Alerts</h3>
          <div className="space-y-2">
            {loading && <div role="status" className="card p-4 text-sm text-slate-500">Loading alerts…</div>}
            {alertsError && <div role="alert" className="card p-4 text-sm text-red-700">Could not load alerts: {alertsError}</div>}
            {!loading && !alertsError && alerts.length === 0 && <div className="card p-4 text-sm text-slate-500">No alerts have been published.</div>}
            {alerts.map((alert) => (
              <div key={alert.id} className="card p-4 flex items-start gap-3">
                <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${alert.type === "evacuation" ? "bg-red-500" : alert.type === "warning" ? "bg-amber-500" : alert.type === "all_clear" ? "bg-green-500" : "bg-blue-500"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm text-slate-900 capitalize">{alert.type.replace(/_/g, " ")}</h4>
                    <span className="text-xs text-slate-400 flex-shrink-0 ml-2">{alert.sent_at ? new Date(alert.sent_at).toLocaleString() : "Time unavailable"}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Latest real reports ── */}
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Latest Reports</h3>
          <div className="space-y-2">
            {reportsError && <div role="alert" className="card p-4 text-sm text-red-700">Could not load reports: {reportsError}</div>}
            {!loading && !reportsError && reports.length === 0 && <div className="card p-4 text-sm text-slate-500">No reports have been submitted.</div>}
            {reports.map((report) => (
              <div key={report.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-sm text-slate-900 capitalize">{report.type.replace(/_/g, " ")}</h4>
                    <p className="text-xs text-slate-500 mt-1">{report.description}</p>
                    <p className="text-xs text-slate-400 mt-1">{report.lat.toFixed(4)}, {report.lon.toFixed(4)} · {new Date(report.created_at).toLocaleString()}</p>
                  </div>
                  <span className="badge badge-warning">{report.status.replace(/_/g, " ")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
