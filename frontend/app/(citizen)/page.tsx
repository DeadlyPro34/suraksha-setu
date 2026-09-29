"use client";

import { useState, useEffect, ReactNode } from "react";
import Link from "next/link";
import { analyzeMyReport, checkHealth, getCitizenAlerts, getMyReports, getShelters } from "@/lib/api";
import { Alert, Report, Shelter } from "@/lib/types";
import { BrandMark, Waves } from "@/components/Brand";

const Icon = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

const ACTIONS = [
  { label: "Report an incident", desc: "Add your location and what you see", href: "/report", tone: "text-alarm bg-red-50",
    icon: <Icon><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 10v4M12 17.2v.1" /></Icon> },
  { label: "Find a shelter", desc: "Nearest open shelters and free beds", href: "/shelters", tone: "text-blue-700 bg-blue-50",
    icon: <Icon><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v10h13V10M10 20v-5h4v5" /></Icon> },
  { label: "Read alerts", desc: "Warnings and evacuation notices", href: "#alerts", tone: "text-saffron-dark bg-amber-50",
    icon: <Icon><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" /><path d="M10 21h4" /></Icon> },
  { label: "Call 112", desc: "Reach emergency services now", href: "tel:112", tone: "text-emerald-700 bg-emerald-50",
    icon: <Icon><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></Icon> },
];

const SEVERITY: Record<Alert["type"], { stripe: string; label: string }> = {
  evacuation: { stripe: "border-l-alarm", label: "Evacuate now" },
  warning: { stripe: "border-l-saffron", label: "Warning" },
  resupply: { stripe: "border-l-blue-500", label: "Supplies" },
  all_clear: { stripe: "border-l-emerald-600", label: "All clear" },
};

const errText = (r: PromiseRejectedResult, fallback: string) => (r.reason instanceof Error ? r.reason.message : fallback);

export default function CitizenHome() {
  const [backendUp, setBackendUp] = useState<boolean | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [sheltersError, setSheltersError] = useState<string | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [verification, setVerification] = useState<Record<string, string>>({});
  const [verifyingReportId, setVerifyingReportId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    checkHealth().then(() => { if (active) setBackendUp(true); }).catch(() => { if (active) setBackendUp(false); });
    Promise.allSettled([getMyReports(10), getCitizenAlerts(10), getShelters(200)]).then(([rep, alr, shl]) => {
      if (!active) return;
      if (rep.status === "fulfilled") setReports(rep.value); else setReportsError(errText(rep, "Could not load reports."));
      if (alr.status === "fulfilled") setAlerts(alr.value); else setAlertsError(errText(alr, "Could not load alerts."));
      if (shl.status === "fulfilled") setShelters(shl.value); else setSheltersError(errText(shl, "Could not load shelters."));
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const activeAlertCount = alerts.filter((a) => a.type !== "all_clear").length;
  const openShelterCount = shelters.filter((s) => s.status === "open").length;
  const val = (isLoading: boolean, err: string | null, n: number) => (isLoading ? "…" : err ? "—" : n);

  const stats = [
    { n: val(loading, alertsError, activeAlertCount), label: "active alerts" },
    { n: val(loading, sheltersError, openShelterCount), label: "shelters open" },
    { n: val(loading, reportsError, reports.length), label: "recent reports" },
  ];

  const verifyReport = async (reportId: string) => {
    setVerifyingReportId(reportId);
    setVerification((current) => ({ ...current, [reportId]: "Checking report timestamp and location…" }));
    try {
      const result = await analyzeMyReport(reportId);
      const output = result.raw_agent_outputs?.misinformation_agent;
      const credibility = output?.credibility_score;
      const status = output?.verification_status;
      setVerification((current) => ({
        ...current,
        [reportId]: typeof credibility === "number"
          ? `Checked · credibility ${credibility.toFixed(2)} · ${String(status ?? "")}`
          : `Check complete · ${String(status ?? "details unavailable")}`,
      }));
    } catch (err) {
      setVerification((current) => ({ ...current, [reportId]: err instanceof Error ? err.message : "Could not check report." }));
    } finally {
      setVerifyingReportId(null);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="gradient-primary text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <span className="font-display text-lg font-bold">Suraksha Setu</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-sm text-blue-100">
              <span className={`w-2 h-2 rounded-full ${backendUp ? "bg-emerald-400 animate-pulse-dot" : backendUp === false ? "bg-red-400" : "bg-slate-400"}`} />
              {backendUp ? "Live" : backendUp === false ? "Offline" : "Connecting"}
            </span>
            <button onClick={() => { window.localStorage.removeItem("access_token"); window.location.assign("/login"); }} className="text-sm font-semibold px-3.5 py-1.5 rounded-lg border border-white/30 hover:bg-white/10">Sign out</button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 pt-8 pb-10 sm:pt-14 sm:pb-16 animate-fade-in">
          <h1 className="font-display text-3xl sm:text-5xl font-extrabold leading-[1.08] max-w-2xl">
            Know what is happening near you. Reach safety faster.
          </h1>
          <p className="mt-4 text-blue-100 max-w-xl text-base sm:text-lg">
            {backendUp === false
              ? "We can't reach live records right now. If you are in danger, call 112."
              : "Alerts, open shelters and citizen reports from your area, in one place."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/report" className="px-5 py-3 rounded-xl bg-saffron text-ink font-bold hover:brightness-105">Report an incident</Link>
            <a href="tel:112" className="px-5 py-3 rounded-xl border border-white/40 font-semibold hover:bg-white/10">Call 112</a>
          </div>
          <dl className="mt-8 grid grid-cols-3 max-w-xl rounded-xl bg-white/10 divide-x divide-white/15">
            {stats.map((s) => (
              <div key={s.label} className="px-4 py-3">
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-display text-2xl sm:text-3xl font-bold">{s.n}</dd>
                <dd className="text-xs sm:text-sm text-blue-100">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Waves />
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        <section aria-labelledby="actions-h">
          <h2 id="actions-h" className="font-display text-xl font-bold mb-3">What do you need?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ACTIONS.map((a) => (
              <Link key={a.label} href={a.href} className="card card-interactive p-4 flex sm:block items-center gap-4">
                <span className={`inline-flex items-center justify-center w-11 h-11 rounded-lg shrink-0 ${a.tone}`}>{a.icon}</span>
                <span className="block sm:mt-3">
                  <span className="block font-semibold text-slate-900">{a.label}</span>
                  <span className="block text-sm text-slate-500 mt-0.5">{a.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section id="alerts" aria-labelledby="alerts-h" className="scroll-mt-4">
          <h2 id="alerts-h" className="font-display text-xl font-bold mb-3">Alerts</h2>
          <div className="space-y-2">
            {loading && <div role="status" className="card p-4 text-slate-500">Loading alerts…</div>}
            {alertsError && <div role="alert" className="card p-4 text-red-700">Could not load alerts: {alertsError}</div>}
            {!loading && !alertsError && alerts.length === 0 && <div className="card p-4 text-slate-500">No alerts right now.</div>}
            {alerts.map((alert) => {
              const sev = SEVERITY[alert.type];
              return (
                <article key={alert.id} className={`card border-l-4 ${sev.stripe} p-4`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-semibold text-slate-900">{sev.label}</h3>
                    <time className="text-xs text-slate-500 shrink-0">{alert.sent_at ? new Date(alert.sent_at).toLocaleString() : "Time unavailable"}</time>
                  </div>
                  <p className="text-slate-600 mt-1">{alert.message}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="reports-h">
          <div className="flex items-baseline justify-between mb-3">
            <h2 id="reports-h" className="font-display text-xl font-bold">My reports</h2>
            <Link href="/report" className="text-sm font-semibold text-blue-700 hover:underline">Add a report</Link>
          </div>
          <div className="space-y-2">
            {reportsError && <div role="alert" className="card p-4 text-red-700">Could not load reports: {reportsError}</div>}
            {!loading && !reportsError && reports.length === 0 && (
              <div className="card p-4 text-slate-500">No reports yet. Seen something? <Link href="/report" className="text-blue-700 font-semibold hover:underline">Report it</Link>.</div>
            )}
            {reports.map((report) => (
              <article key={report.id} className="card p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 capitalize">{report.type.replace(/_/g, " ")}</h3>
                  <p className="text-slate-600 mt-0.5">{report.description}</p>
                  <p className="text-xs text-slate-500 mt-1.5">{report.lat.toFixed(4)}, {report.lon.toFixed(4)} — {new Date(report.created_at).toLocaleString()}</p>
                  <button type="button" disabled={verifyingReportId === report.id} onClick={() => void verifyReport(report.id)} className="mt-2 text-xs font-medium text-blue-700 hover:underline disabled:opacity-50">
                    {verifyingReportId === report.id ? "Checking…" : "Run timestamp and location checks"}
                  </button>
                  {verification[report.id] && <p role="status" className="text-xs text-slate-600 mt-1">{verification[report.id]}</p>}
                </div>
                <span className={`badge shrink-0 ${report.status === "verified" ? "badge-success" : report.status === "rejected" ? "badge-danger" : "badge-warning"}`}>
                  {report.status.replace(/_/g, " ")}
                </span>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
