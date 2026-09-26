"use client";

import { useCallback, useEffect, useState } from "react";
import { checkHealth, getAlerts, getReports, getShelters, getResponsePlanActions, runPipeline, submitDecision } from "@/lib/api";
import { Alert, Report, ResponsePlan, ResponsePlanActions, Shelter } from "@/lib/types";

/* ── Agent metadata ── */
const AGENT_META: Record<string, { label: string; icon: string; color: string }> = {
  flood_agent:          { label: "Flood Analysis",      icon: "🌊", color: "border-blue-200 bg-blue-50" },
  road_agent:           { label: "Road Status",         icon: "🛣️", color: "border-amber-200 bg-amber-50" },
  shelter_agent:        { label: "Shelter Finder",      icon: "🏠", color: "border-green-200 bg-green-50" },
  resource_agent:       { label: "Resource Allocation", icon: "📦", color: "border-purple-200 bg-purple-50" },
  misinformation_agent: { label: "Credibility Check",   icon: "🔍", color: "border-slate-200 bg-slate-50" },
};

function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value);
}

function priorityBadge(score: number) {
  if (score >= 8) return { label: "Critical", cls: "bg-red-100 text-red-700 border-red-200" };
  if (score >= 5) return { label: "High", cls: "bg-amber-100 text-amber-700 border-amber-200" };
  return { label: "Normal", cls: "bg-green-100 text-green-700 border-green-200" };
}

export default function OfficialDashboard() {
  const [health, setHealth] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [incidentId, setIncidentId] = useState("");
  const [plan, setPlan] = useState<ResponsePlan | null>(null);
  const [planActions, setPlanActions] = useState<ResponsePlanActions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "pipeline">("overview");
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [sheltersError, setSheltersError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  const loadRecentReports = useCallback(async () => {
    setReportsLoading(true);
    setReportsError(null);
    setSheltersError(null);
    setAlertsError(null);
    const [reportResult, shelterResult, alertResult] = await Promise.allSettled([
      getReports(100),
      getShelters(200),
      getAlerts(100),
    ]);
    if (reportResult.status === "fulfilled") setRecentReports(reportResult.value);
    else setReportsError(reportResult.reason instanceof Error ? reportResult.reason.message : "Could not load reports.");
    if (shelterResult.status === "fulfilled") setShelters(shelterResult.value);
    else setSheltersError(shelterResult.reason instanceof Error ? shelterResult.reason.message : "Could not load shelters.");
    if (alertResult.status === "fulfilled") setAlerts(alertResult.value);
    else setAlertsError(alertResult.reason instanceof Error ? alertResult.reason.message : "Could not load alerts.");
    setReportsLoading(false);
  }, []);

  useEffect(() => {
    checkHealth().then(() => setHealth("connected")).catch(() => setHealth("disconnected"));
  }, []);

  useEffect(() => {
    void loadRecentReports();
  }, [loadRecentReports]);

  const activeAlerts = alerts.filter((alert) => alert.type !== "all_clear").length;
  const openShelters = shelters.filter((shelter) => shelter.status === "open").length;
  const pendingReports = recentReports.filter((report) => report.status === "pending_verification").length;
  const dashboardStats = [
    { label: "Reports Loaded (latest 100)", value: reportsLoading ? "…" : reportsError ? "—" : String(recentReports.length), icon: "📋", trend: reportsLoading ? "Loading" : reportsError ? "Unavailable" : "Database", trendType: "info" },
    { label: "Pending Verification", value: reportsLoading ? "…" : reportsError ? "—" : String(pendingReports), icon: "⏳", trend: reportsError ? "Unavailable" : "Reports", trendType: "warning" },
    { label: "Open Shelters", value: reportsLoading ? "…" : sheltersError ? "—" : String(openShelters), icon: "🏠", trend: sheltersError ? "Unavailable" : "Database", trendType: "success" },
    { label: "Active Alerts (latest 100)", value: reportsLoading ? "…" : alertsError ? "—" : String(activeAlerts), icon: "📢", trend: alertsError ? "Unavailable" : "Database", trendType: "danger" },
  ];

  const handleRun = async () => {
    if (!incidentId.trim()) return;
    setLoading(true);
    setError(null);
    setDecisionTime(null);
    setPlanActions(null);
    try {
      const result = await runPipeline(incidentId.trim());
      setPlan(result);
      setActiveTab("pipeline");
    } catch (err: any) {
      setError(err.message || "Pipeline failed");
    } finally {
      setLoading(false);
    }
  };

  const [decisionTime, setDecisionTime] = useState<string | null>(null);

  const handleSubmitDecision = async (decision: "approved" | "rejected" | "modified") => {
    if (!plan?.id) return;
    let modifiedSummary: string | undefined;
    if (decision === "modified") {
      const enteredSummary = window.prompt("Describe the changes made to this response plan:");
      if (enteredSummary === null || !enteredSummary.trim()) return;
      modifiedSummary = enteredSummary.trim();
    }
    try {
      await submitDecision(plan.id, decision, undefined, modifiedSummary);
      setPlan({ ...plan, status: decision });
      setDecisionTime(new Date().toLocaleTimeString());
      if (decision === "approved") {
        try {
          const actions = await getResponsePlanActions(plan.id);
          setPlanActions(actions);
        } catch (actionError: any) {
          setError(`Decision recorded, but action records could not be loaded: ${actionError.message || "request failed"}`);
        }
      } else {
        setPlanActions(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit decision");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* ── Sidebar ── */}
      <aside className="w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col min-h-screen">
        {/* Logo */}
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛡️</span>
            <div>
              <h1 className="font-bold text-sm">Suraksha Setu</h1>
              <p className="text-[10px] text-slate-400">Official Dashboard</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {[
            { icon: "📊", label: "Dashboard", active: true },
            { icon: "🚨", label: "Incidents", active: false },
            { icon: "✅", label: "Approvals", active: false },
            { icon: "🏠", label: "Shelters", active: false },
            { icon: "👥", label: "Teams", active: false },
            { icon: "📦", label: "Resources", active: false },
            { icon: "🗺️", label: "Map View", active: false },
          ].map((item) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                item.active
                  ? "bg-blue-600 text-white font-medium"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Connection status */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              health === "connected" ? "bg-green-400 animate-pulse-dot" :
              health === "disconnected" ? "bg-red-400" : "bg-yellow-400"
            }`} />
            <span className="text-xs text-slate-400">
              Backend: {health}
            </span>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Command Center</h2>
            <p className="text-xs text-slate-500">Real-time disaster response coordination</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge badge-danger animate-pulse-dot">● {reportsLoading ? "…" : alertsError ? "—" : activeAlerts} Active Alerts</span>
            <div className="w-8 h-8 gradient-primary rounded-full flex items-center justify-center text-white text-xs font-bold">A</div>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* ── Stats Row ── */}
          <div className="grid grid-cols-4 gap-4">
            {dashboardStats.map((stat, i) => (
              <div key={stat.label} className="card p-4 animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{stat.icon}</span>
                  <span className={`badge badge-${stat.trendType}`}>{stat.trend}</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* ── Tabs ── */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === "overview" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >Overview</button>
            <button
              onClick={() => setActiveTab("pipeline")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === "pipeline" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >AI Pipeline</button>
          </div>

          {activeTab === "overview" && (
            <div className="grid grid-cols-3 gap-6 animate-fade-in">
              {/* Recent incidents */}
              <div className="col-span-2">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Recent Incidents</h3>
                <div className="space-y-2">
                  {reportsLoading && <div role="status" className="card p-4 text-sm text-slate-500">Loading reports…</div>}
                  {reportsError && (
                    <div role="alert" className="card p-4 text-sm text-red-700">
                      <p>Could not load reports: {reportsError}</p>
                      <button onClick={() => void loadRecentReports()} className="mt-2 font-medium underline">Try again</button>
                    </div>
                  )}
                  {!reportsLoading && !reportsError && recentReports.length === 0 && (
                    <div className="card p-4 text-sm text-slate-500">No reports have been submitted yet.</div>
                  )}
                  {recentReports.map((inc, i) => (
                    <div key={inc.id} className="card p-4 flex items-center justify-between animate-fade-in" style={{ animationDelay: `${i * 0.08}s` }}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                          inc.type === "flood" ? "bg-blue-100" : inc.type === "road_block" ? "bg-amber-100" : "bg-red-100"
                        }`}>
                          {inc.type === "flood" ? "🌊" : inc.type === "road_block" ? "🚧" : "🏥"}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-slate-900 capitalize">{inc.type.replace("_", " ")} report</div>
                          <div className="text-xs text-slate-500">{inc.lat.toFixed(4)}, {inc.lon.toFixed(4)} • {new Date(inc.created_at).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`badge ${inc.status === "verified" ? "badge-success" : inc.status === "pending_verification" ? "badge-warning" : "badge-danger"}`}>
                          {inc.status.replace(/_/g, " ")}
                        </span>
                        <button
                          onClick={() => { setIncidentId(inc.id); setActiveTab("pipeline"); }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Analyze →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick stats sidebar */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Live Updates</h3>
                <div className="card p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Weather</div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🌦️</span>
                    <div>
                      <div className="font-bold text-slate-900">No live reading</div>
                      <div className="text-xs text-slate-500">Weather is checked per incident in the analysis pipeline.</div>
                    </div>
                  </div>
                </div>
                <div className="card p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Shelter Availability</div>
                  {sheltersError && <p className="text-xs text-red-600">Could not load shelter data.</p>}
                  {!sheltersError && shelters.length === 0 && <p className="text-xs text-slate-500">No shelters registered.</p>}
                  <div className="space-y-2">
                    {shelters.filter((shelter) => shelter.status === "open").slice(0, 3).map((shelter) => (
                      <div key={shelter.id}>
                        <div className="flex justify-between text-xs"><span className="text-slate-600">{shelter.name}</span><span className="font-medium text-green-600">{shelter.available_percentage}%</span></div>
                        <div className="h-1.5 bg-slate-100 rounded-full"><div className="h-full bg-green-500 rounded-full" style={{ width: `${shelter.available_percentage}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "pipeline" && (
            <div className="space-y-6 animate-fade-in">
              {/* ── Pipeline trigger ── */}
              <div className="card p-5">
                <h3 className="font-semibold text-slate-900 mb-3">Run Agent Pipeline</h3>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={incidentId}
                    onChange={(e) => setIncidentId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRun()}
                    placeholder="Enter incident ID"
                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                  <button
                    onClick={handleRun}
                    disabled={loading || !incidentId.trim()}
                    className="px-6 py-2.5 gradient-primary text-white font-medium rounded-xl hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20"
                  >
                    {loading ? "Running…" : "🤖 Run Pipeline"}
                  </button>
                </div>
                {error && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
                )}
              </div>

              {/* ── Response Plan ── */}
              {plan && (
                <>
                  {/* Summary card */}
                  <div className="card p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">AI Recommended Plan</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Generated by CrewAI Agent Pipeline</p>
                      </div>
                      <div className={`badge border ${priorityBadge(plan.priority_score).cls}`}>
                        Priority: {plan.priority_score} — {priorityBadge(plan.priority_score).label}
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed mb-5">{plan.summary}</p>

                    <div className="border-t border-slate-100 pt-4 flex gap-3">
                      {plan.status === "pending_approval" || !plan.status ? (
                        <>
                          <button onClick={() => handleSubmitDecision("approved")} className="px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700">Approve</button>
                          <button onClick={() => handleSubmitDecision("modified")} className="px-4 py-2 bg-amber-500 text-white rounded font-medium hover:bg-amber-600">Modify</button>
                          <button onClick={() => handleSubmitDecision("rejected")} className="px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700">Reject</button>
                        </>
                      ) : (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700 font-medium">
                          Decision recorded: {plan.status} {decisionTime ? `at ${decisionTime}` : ""}
                        </div>
                      )}
                    </div>
                  </div>

                  {plan.status === "approved" && planActions && (
                    <section aria-live="polite" className="card p-6 border border-green-200 bg-green-50">
                      <h3 className="text-lg font-bold text-green-900">Simulated Actions Sent</h3>
                      <p className="mt-1 text-sm text-green-800">
                        {planActions.alerts.length} alerts sent to citizens, {planActions.dispatches.length} dispatch instructions sent to field teams.
                      </p>
                      <div className="mt-4 space-y-3">
                        {planActions.alerts.map((alert) => (
                          <div key={alert.id} className="rounded-lg border border-green-200 bg-white p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-green-800">Citizen alert · {alert.type}</p>
                            <p className="mt-1 text-sm text-slate-800">{alert.message}</p>
                          </div>
                        ))}
                        {planActions.dispatches.map((dispatch) => (
                          <div key={dispatch.id} className="rounded-lg border border-blue-200 bg-white p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">Dispatch · {humanize(dispatch.target_role)} · {dispatch.status}</p>
                            <p className="mt-1 text-sm text-slate-800">{dispatch.message}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Agent output cards */}
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Agent Outputs</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {Object.entries(plan.raw_agent_outputs || {}).map(([agentName, output]) => {
                      const meta = AGENT_META[agentName] ?? { label: humanize(agentName), icon: "🤖", color: "border-slate-200 bg-slate-50" };
                      // Filter out raw_weather and raw_roads from display to keep cards clean
                      const displayEntries = Object.entries(output as Record<string, unknown>).filter(
                        ([k]) => !k.startsWith("raw_")
                      );

                      return (
                        <div key={agentName} className={`card p-4 border ${meta.color}`}>
                          <h4 className="font-semibold text-sm mb-3 pb-2 border-b border-slate-200 flex items-center gap-2">
                            <span className="text-lg">{meta.icon}</span>
                            <span className="text-slate-900">{meta.label}</span>
                          </h4>
                          <dl className="space-y-2">
                            {displayEntries.map(([key, value]) => (
                              <div key={key} className="flex justify-between items-baseline">
                                <dt className="text-xs text-slate-500">{humanize(key)}</dt>
                                <dd className="text-sm font-medium text-slate-900 text-right max-w-[60%] break-words">
                                  {formatValue(value)}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
