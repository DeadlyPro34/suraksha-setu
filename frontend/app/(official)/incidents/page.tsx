"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { analyzeReport, getReports } from "@/lib/api";
import { Report } from "@/lib/types";
import { ReportMedia } from "@/components/ReportMedia";

const typeIcon: Record<string, string> = { flood: "🌊", road_block: "🚧", medical: "🏥", other: "⚠️" };
const reportStatus: Record<string, string> = {
  pending_verification: "badge-warning",
  verified: "badge-success",
  rejected: "badge-danger",
};

export default function IncidentsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyReport, setBusyReport] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReports(await getReports());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load incident reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  const analyze = async (reportId: string) => {
    setBusyReport(reportId);
    setError(null);
    setNotice(null);
    try {
      const result = await analyzeReport(reportId);
      setNotice(`Analysis complete. Priority ${result.priority_score.toFixed(1)} response plan is ready for review.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not analyze this report.");
    } finally {
      setBusyReport(null);
    }
  };

  useEffect(() => { void loadReports(); }, [loadReports]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-lg font-bold text-slate-900">All reports</h2><p className="mt-1 text-sm text-slate-500">Review submitted incidents, then send them to the analysis workflow.</p></div>
        <span className="badge badge-info">{loading ? "Loading…" : `${reports.length} reports`}</span>
      </div>

      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice} <Link className="ml-1 font-semibold underline" href="/approvals">Go to plan approvals</Link></p>}
      {loading && <div role="status" className="card p-5 text-sm text-slate-500">Loading reports…</div>}
      {error && <div role="alert" className="card flex flex-wrap items-center justify-between gap-3 border-red-200 p-5 text-sm text-red-700"><span>Could not load reports: {error}</span><button onClick={() => void loadReports()} className="font-semibold underline">Try again</button></div>}
      {!loading && !error && reports.length === 0 && <div className="card p-8 text-center"><p className="font-semibold text-slate-800">No reports yet</p><p className="mt-1 text-sm text-slate-500">Citizen submissions will appear here for review.</p></div>}

      {!error && <div className="space-y-3">{reports.map((report) => <article key={report.id} className="card p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl" aria-hidden="true">{typeIcon[report.type] || "⚠️"}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold capitalize text-slate-900">{report.type.replace(/_/g, " ")} report</h3><span className={`badge capitalize ${reportStatus[report.status] || "badge-neutral"}`}>{report.status.replace(/_/g, " ")}</span>{report.verification_result && <span className="badge badge-info">Check: {report.verification_result}</span>}</div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{report.description}</p>
              {report.image_url && (report.image_url.startsWith("/api/media/")
                ? <ReportMedia url={report.image_url} />
                : <a className="mt-3 inline-block text-sm font-semibold text-blue-700 underline" href={report.image_url} target="_blank" rel="noreferrer">Open attached media</a>)}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>📍 {report.lat.toFixed(5)}, {report.lon.toFixed(5)}</span><span>{new Date(report.created_at).toLocaleString()}</span><span className="break-all">ID: {report.id}</span></div>
            </div>
          </div>
          <button disabled={busyReport === report.id} onClick={() => void analyze(report.id)} className="shrink-0 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-50">
            {busyReport === report.id ? "Analyzing…" : "Analyze report"}
          </button>
        </div>
      </article>)}</div>}
    </div>
  );
}
