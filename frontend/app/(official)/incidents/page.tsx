"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getReports } from "@/lib/api";
import { Report } from "@/lib/types";

const typeIcon: Record<string, string> = { flood: "🌊", road_block: "🚧", medical: "🏥", other: "⚠️" };

export default function IncidentsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReports(await getReports());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load incident reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col min-h-screen">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛡️</span>
            <div>
              <h1 className="font-bold text-sm">Suraksha Setu</h1>
              <p className="text-[10px] text-slate-400">Official Dashboard</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {[
            { icon: "📊", label: "Dashboard", href: "/dashboard" },
            { icon: "🚨", label: "Incidents", active: true },
            { icon: "✅", label: "Approvals", href: "/approvals" },
          ].map((item) => (
            <Link
              key={item.label}
              href={"href" in item ? item.href : "#"}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                "active" in item && item.active
                  ? "bg-blue-600 text-white font-medium"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-40">
          <h2 className="text-xl font-bold text-slate-900">All Incidents</h2>
          <p className="text-xs text-slate-500">Manage and track all reported incidents</p>
        </header>

        <div className="p-6 space-y-3">
          {loading && <div role="status" className="card p-5 text-sm text-slate-500">Loading reports…</div>}
          {error && (
            <div role="alert" className="card p-5 text-sm text-red-700">
              <p>Could not load reports: {error}</p>
              <button onClick={() => void loadReports()} className="mt-3 font-medium underline">Try again</button>
            </div>
          )}
          {!loading && !error && reports.length === 0 && (
            <div className="card p-5 text-sm text-slate-500">No incident reports have been submitted yet.</div>
          )}
          {reports.map((inc, i) => (
            <div key={inc.id} className="card p-5 animate-fade-in" style={{ animationDelay: `${i * 0.06}s` }}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                    inc.type === "flood" ? "bg-blue-100" : inc.type === "road_block" ? "bg-amber-100" : inc.type === "medical" ? "bg-red-100" : "bg-slate-100"
                  }`}>
                    {typeIcon[inc.type] || "⚠️"}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 capitalize">{inc.type.replace("_", " ")} report</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{inc.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span>📍 {inc.lat.toFixed(5)}, {inc.lon.toFixed(5)}</span>
                      <span>⏰ {new Date(inc.created_at).toLocaleString()}</span>
                      <span>🆔 {inc.id}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`badge ${
                    inc.status === "verified" ? "badge-success" :
                    inc.status === "pending_verification" ? "badge-warning" : "badge-danger"
                  }`}>
                    {inc.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
