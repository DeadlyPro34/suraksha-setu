"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { analyzeReport, getReports, getResponsePlans } from "@/lib/api";
import { Report, ResponsePlanSummary } from "@/lib/types";
import { ReportMedia } from "@/components/ReportMedia";

type Queue = "needs_analysis" | "analyzed" | "all";
const pageSize = 8;
const typeIcon: Record<string, string> = { flood: "🌊", road_block: "🚧", medical: "🏥", other: "⚠️" };
const statusLabel: Record<string, string> = {
  pending_verification: "Pending verification",
  verified: "Verified",
  rejected: "Rejected",
};

export default function IncidentsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [plans, setPlans] = useState<ResponsePlanSummary[]>([]);
  const [queue, setQueue] = useState<Queue>("needs_analysis");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyReport, setBusyReport] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; aiUsed?: boolean } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportRows, planRows] = await Promise.all([getReports(100), getResponsePlans(100)]);
      setReports(reportRows);
      setPlans(planRows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load incident reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const latestPlanByReport = useMemo(() => {
    const byReport = new Map<string, ResponsePlanSummary>();
    for (const plan of plans) {
      if (plan.report_id && !byReport.has(plan.report_id)) byReport.set(plan.report_id, plan);
    }
    return byReport;
  }, [plans]);

  const counts = useMemo(() => {
    const analyzed = reports.filter((report) => latestPlanByReport.has(report.id)).length;
    return { analyzed, needsAnalysis: reports.length - analyzed };
  }, [reports, latestPlanByReport]);

  const visibleReports = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reports.filter((report) => {
      const analyzed = latestPlanByReport.has(report.id);
      if (queue === "needs_analysis" && analyzed) return false;
      if (queue === "analyzed" && !analyzed) return false;
      if (!query) return true;
      return [report.type, report.description, report.id, statusLabel[report.status]]
        .some((value) => value?.toLowerCase().includes(query));
    });
  }, [reports, latestPlanByReport, queue, search]);

  const totalPages = Math.max(1, Math.ceil(visibleReports.length / pageSize));
  const pageReports = visibleReports.slice((page - 1) * pageSize, page * pageSize);

  const analyze = async (report: Report) => {
    setBusyReport(report.id);
    setError(null);
    setNotice(null);
    try {
      const result = await analyzeReport(report.id);
      await loadData();
      setNotice({
        aiUsed: result.ai_used,
        text: result.ai_used
          ? `AI analysis finished and the pending plan was refreshed (priority ${result.priority_score.toFixed(1)}).`
          : "Analysis finished with the rules-only fallback. Set a valid GROQ_API_KEY on the backend to enable AI summaries.",
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not analyze this report.");
    } finally {
      setBusyReport(null);
    }
  };

  const tabs: Array<{ id: Queue; label: string; count: number }> = [
    { id: "needs_analysis", label: "Needs analysis", count: counts.needsAnalysis },
    { id: "analyzed", label: "Analyzed", count: counts.analyzed },
    { id: "all", label: "All reports", count: reports.length },
  ];

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Incident reports</h1>
          <p className="mt-1 text-sm text-slate-600">Review incoming reports and generate or refresh a response plan.</p>
        </div>
        <Link className="text-sm font-semibold text-blue-700 hover:underline" href="/approvals">Open plan approvals →</Link>
      </header>

      {notice && <div role="status" className={`rounded-xl border p-4 text-sm ${notice.aiUsed ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
        <p>{notice.text}</p>
        <Link className="mt-2 inline-block font-semibold underline" href="/approvals">View response plans</Link>
      </div>}
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{error}</span><button onClick={() => void loadData()} className="font-semibold underline">Try again</button></div>}

      <section className="card space-y-4 p-4 sm:p-5" aria-label="Report filters">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Report queue">
          {tabs.map((tab) => <button key={tab.id} role="tab" aria-selected={queue === tab.id} onClick={() => { setQueue(tab.id); setPage(1); }} className={`rounded-lg px-3 py-2 text-sm font-semibold ${queue === tab.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
            {tab.label}<span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${queue === tab.id ? "bg-white/20" : "bg-white"}`}>{tab.count}</span>
          </button>)}
        </div>
        <label className="block">
          <span className="sr-only">Search reports</span>
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search description, type, status, or ID" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400" />
        </label>
      </section>

      {loading ? <div role="status" className="card p-5 text-sm text-slate-500">Loading reports…</div> : visibleReports.length === 0 ? (
        <div className="card p-8 text-center"><p className="font-semibold text-slate-800">No reports in this view</p><p className="mt-1 text-sm text-slate-500">Try another tab or change your search.</p></div>
      ) : <div className="space-y-3">
        {pageReports.map((report) => {
          const plan = latestPlanByReport.get(report.id);
          return <article key={report.id} className="card p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl" aria-hidden="true">{typeIcon[report.type] || "⚠️"}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold capitalize text-slate-900">{report.type.replace(/_/g, " ")}</h2>
                    <span className="badge capitalize">{statusLabel[report.status] || report.status.replace(/_/g, " ")}</span>
                    {plan ? <span className="badge badge-info">Plan: {plan.status.replace(/_/g, " ")} · priority {plan.priority_score.toFixed(1)}</span> : <span className="badge badge-warning">Needs analysis</span>}
                  </div>
                  <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{report.description}</p>
                  <p className="mt-2 text-xs text-slate-500">{new Date(report.created_at).toLocaleString()} · {report.lat.toFixed(5)}, {report.lon.toFixed(5)}</p>
                </div>
              </div>
              <button disabled={busyReport === report.id} onClick={() => void analyze(report)} className="shrink-0 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-50">
                {busyReport === report.id ? "Analyzing…" : plan ? "Re-analyze" : "Analyze"}
              </button>
            </div>
            <details className="mt-3 border-t border-slate-100 pt-3">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">Report details and evidence</summary>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{report.description}</p>
              {report.image_url && (report.image_url.startsWith("/api/media/")
                ? <ReportMedia url={report.image_url} />
                : <a className="mt-3 inline-block text-sm font-semibold text-blue-700 underline" href={report.image_url} target="_blank" rel="noreferrer">Open attached media</a>)}
              <p className="mt-3 break-all text-xs text-slate-400">Report ID: {report.id}</p>
              {plan && <div className="mt-3 rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest response plan · {new Date(plan.generated_at).toLocaleString()}</p><p className="mt-1 text-sm text-slate-700">{plan.summary}</p></div>}
            </details>
          </article>;
        })}
      </div>}

      {!loading && visibleReports.length > pageSize && <nav className="flex items-center justify-between gap-3" aria-label="Report pages">
        <p className="text-sm text-slate-500">Page {page} of {totalPages}</p>
        <div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40">Previous</button><button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40">Next</button></div>
      </nav>}
    </div>
  );
}
