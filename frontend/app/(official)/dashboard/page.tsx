"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkHealth, getAlerts, getReports, getShelters, getResponsePlanActions, runPipeline, submitDecision } from "@/lib/api";
import { getCurrentUser } from "@/lib/api";
import { homeForRole } from "@/lib/auth";
import { Alert, Report, ResponsePlan, ResponsePlanActions, Shelter } from "@/lib/types";
import { BrandMark } from "@/components/Brand";
import { Icon } from "@/components/Icons";

/* ── Agent metadata ── */
const AGENT_META: Record<string, { label: string; icon: string; color: string }> = {
  flood_agent:          { label: "Flood analysis",      icon: "flood",  color: "border-l-blue-500" },
  road_agent:           { label: "Road status",         icon: "road",   color: "border-l-saffron" },
  shelter_agent:        { label: "Shelter finder",      icon: "shelter", color: "border-l-emerald-600" },
  resource_agent:       { label: "Resource allocation", icon: "box",    color: "border-l-blue-800" },
  misinformation_agent: { label: "Credibility check",   icon: "search", color: "border-l-slate-400" },
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

function availableResourceLines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const resource = item as Record<string, unknown>;
    if (
      typeof resource.type !== "string" ||
      typeof resource.quantity !== "number" ||
      typeof resource.status !== "string"
    ) {
      return [];
    }
    return [`${humanize(resource.type)}: ${resource.quantity} ${resource.status}`];
  });
}

function priorityBadge(score: number) {
  if (score >= 8) return { label: "Critical", cls: "bg-red-100 text-red-700 border-red-200" };
  if (score >= 5) return { label: "High", cls: "bg-amber-100 text-amber-700 border-amber-200" };
  return { label: "Normal", cls: "bg-green-100 text-green-700 border-green-200" };
}

export default function OfficialDashboard() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
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

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((user) => {
        if (!active) return;
        if (user.role !== "official") {
          router.replace(homeForRole(user.role));
          return;
        }
        setAuthChecked(true);
      })
      .catch(() => {
        if (!active) return;
        window.localStorage.removeItem("access_token");
        router.replace("/login");
      });
    return () => {
      active = false;
    };
  }, [router]);

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
    if (!authChecked) return;
    checkHealth().then(() => setHealth("connected")).catch(() => setHealth("disconnected"));
  }, [authChecked]);

  useEffect(() => {
    if (!authChecked) return;
    void loadRecentReports();
  }, [authChecked, loadRecentReports]);

  const activeAlerts = alerts.filter((alert) => alert.type !== "all_clear").length;
  const openShelters = shelters.filter((shelter) => shelter.status === "open").length;
  const pendingReports = recentReports.filter((report) => report.status === "pending_verification").length;
  const stat = (isLoading: boolean, err: string | null, n: number) => (isLoading ? "…" : err ? "—" : String(n));
  const dashboardStats = [
    { label: "Recent reports", value: stat(reportsLoading, reportsError, recentReports.length), accent: "border-t-blue-500" },
    { label: "Pending verification", value: stat(reportsLoading, reportsError, pendingReports), accent: "border-t-saffron" },
    { label: "Open shelters", value: stat(reportsLoading, sheltersError, openShelters), accent: "border-t-emerald-600" },
    { label: "Active alerts", value: stat(reportsLoading, alertsError, activeAlerts), accent: "border-t-alarm" },
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
  const [isModifying, setIsModifying] = useState(false);
  const [modifiedSummaryText, setModifiedSummaryText] = useState("");

  const handleSubmitDecision = async (decision: "approved" | "rejected" | "modified", summary?: string) => {
    if (!plan?.id) return;
    let modifiedSummary: string | undefined;
    if (decision === "modified") {
      if (!summary?.trim()) return;
      modifiedSummary = summary.trim();
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

  if (!authChecked) {
    return <main className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">Checking authentication…</main>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex w-64 bg-ink text-white flex-shrink-0 flex-col h-screen sticky top-0">
        {/* Logo */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <BrandMark />
            <div>
              <h1 className="font-bold text-sm">Suraksha Setu</h1>
              <p className="text-xs text-blue-200">Official dashboard</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {[
            { icon: "dashboard", label: "Dashboard", href: "/dashboard", active: true },
            { icon: "incident", label: "Incidents", href: "/incidents", active: false },
            { icon: "check", label: "Approvals", href: "/approvals", active: false },
            { icon: "shelter", label: "Shelters", href: "/shelters", active: false },
            { icon: "team", label: "Teams", href: null, active: false },
            { icon: "box", label: "Resources", href: null, active: false },
            { icon: "map", label: "Map View", href: null, active: false },
          ].map((item) => (
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  item.active
                    ? "bg-white/10 text-white font-semibold"
                    : "text-blue-200 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon name={item.icon} className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            ) : (
              <div
                key={item.label}
                aria-disabled="true"
                title={`${item.label} page is not available yet`}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-blue-300/40 cursor-not-allowed"
              >
                <Icon name={item.icon} className="w-5 h-5" />
                <span className="flex-1">{item.label}</span>
                <span className="text-xs text-blue-300/50">Soon</span>
              </div>
            )
          ))}
        </nav>

        {/* Connection status */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              health === "connected" ? "bg-green-400 animate-pulse-dot" :
              health === "disconnected" ? "bg-red-400" : "bg-yellow-400"
            }`} />
            <span className="text-sm text-blue-200">
              Backend: {health}
            </span>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0">
        <nav aria-label="Sections" className="lg:hidden flex gap-1 overflow-x-auto bg-ink px-3 py-2">
          {[["Dashboard", "/dashboard"], ["Incidents", "/incidents"], ["Approvals", "/approvals"], ["Shelters", "/shelters"]].map(([l, h]) => (
            <Link key={l} href={h} className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${h === "/dashboard" ? "bg-white/15 text-white font-semibold" : "text-blue-200"}`}>{l}</Link>
          ))}
        </nav>
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-40">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Command Center</h2>
            <p className="text-xs text-slate-500">Real-time disaster response coordination</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge badge-danger">{reportsLoading ? "…" : alertsError ? "—" : activeAlerts} active alerts</span>
            <div className="w-8 h-8 gradient-primary rounded-full flex items-center justify-center text-white text-xs font-bold">A</div>
          </div>
        </header>

        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {dashboardStats.map((st) => (
              <div key={st.label} className={`card p-4 border-t-4 ${st.accent}`}>
                <div className="font-display text-3xl font-bold text-slate-900">{st.value}</div>
                <div className="text-sm text-slate-600 mt-1">{st.label}</div>
              </div>
            ))}
          </div>

          <div role="tablist" className="flex gap-6 border-b border-slate-200">
            {(["overview", "pipeline"] as const).map((t) => (
              <button key={t} role="tab" aria-selected={activeTab === t} onClick={() => setActiveTab(t)}
                className={`pb-2.5 -mb-px text-sm font-semibold border-b-2 ${activeTab === t ? "border-saffron text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
                {t === "overview" ? "Overview" : "AI pipeline"}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-fade-in">
              {/* Recent incidents */}
              <div className="xl:col-span-2">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-3">Recent incidents</h3>
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
                  {recentReports.map((inc) => (
                    <div key={inc.id} className="card p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          inc.type === "flood" ? "bg-blue-100 text-blue-800" : inc.type === "road_block" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                        }`}>
                          <Icon name={inc.type === "flood" ? "flood" : inc.type === "road_block" ? "road" : "medical"} className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-slate-900 capitalize">{inc.type.replace("_", " ")} report</div>
                          <div className="text-xs text-slate-500">{inc.lat.toFixed(4)}, {inc.lon.toFixed(4)} — {new Date(inc.created_at).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`badge ${inc.status === "verified" ? "badge-success" : inc.status === "pending_verification" ? "badge-warning" : "badge-danger"}`}>
                          {inc.status.replace(/_/g, " ")}
                        </span>
                        <button
                          onClick={() => { setIncidentId(inc.id); setActiveTab("pipeline"); }}
                          className="text-sm text-blue-700 hover:underline font-semibold"
                        >
                          Analyze
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick stats sidebar */}
              <div className="space-y-4">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-3">Right now</h3>
                <div className="card p-4">
                  <div className="text-sm font-semibold text-slate-700 mb-2">Weather</div>
                  <div className="flex items-center gap-2">
                    <Icon name="weather" className="w-7 h-7 text-blue-700" />
                    <div>
                      <div className="font-bold text-slate-900">No live reading</div>
                      <div className="text-xs text-slate-500">Weather is checked per incident in the analysis pipeline.</div>
                    </div>
                  </div>
                </div>
                <div className="card p-4">
                  <div className="text-sm font-semibold text-slate-700 mb-2">Shelter availability</div>
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
                <h3 className="font-semibold text-slate-900 mb-3">Run the agent pipeline</h3>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={incidentId}
                    onChange={(e) => setIncidentId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRun()}
                    placeholder="Enter incident ID"
                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                  <button
                    onClick={handleRun}
                    disabled={loading || !incidentId.trim()}
                    className="px-6 py-2.5 bg-ink text-white font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-50"
                  >
                    {loading ? "Running…" : "Run pipeline"}
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
                        <p className="text-xs text-slate-500 mt-0.5">Generated by the agent pipeline</p>
                      </div>
                      <div className={`badge border ${priorityBadge(plan.priority_score).cls}`}>
                        Priority: {plan.priority_score} — {priorityBadge(plan.priority_score).label}
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed mb-5">{plan.summary}</p>

                    <div className="border-t border-slate-100 pt-4 flex flex-wrap gap-3">
                      {plan.status === "pending_approval" || !plan.status ? (
                        <>
                          <button onClick={() => handleSubmitDecision("approved")} className="px-4 py-2 bg-emerald-700 text-white rounded-lg font-semibold hover:bg-emerald-800">Approve</button>
                          {isModifying ? (
                            <div className="w-full flex gap-2">
                              <textarea
                                value={modifiedSummaryText}
                                onChange={(e) => setModifiedSummaryText(e.target.value)}
                                placeholder="Describe the changes made to this response plan..."
                                className="w-full p-2 border border-slate-200 rounded text-sm"
                                rows={2}
                              />
                              <div className="flex flex-col gap-2">
                                <button onClick={() => { handleSubmitDecision("modified", modifiedSummaryText); setIsModifying(false); setModifiedSummaryText(""); }} disabled={!modifiedSummaryText.trim()} className="px-3 py-1 bg-saffron text-ink rounded-md text-sm font-semibold disabled:opacity-50">Submit</button>
                                <button onClick={() => { setIsModifying(false); setModifiedSummaryText(""); }} className="px-3 py-1 bg-slate-200 text-slate-700 rounded text-sm hover:bg-slate-300">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setIsModifying(true)} className="px-4 py-2 bg-saffron text-ink rounded-lg font-semibold hover:brightness-105">Modify</button>
                          )}
                          <button onClick={() => handleSubmitDecision("rejected")} className="px-4 py-2 bg-alarm text-white rounded-lg font-semibold hover:brightness-110">Reject</button>
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
                            <p className="text-sm font-semibold text-green-800">Citizen alert: {humanize(alert.type)}</p>
                            <p className="mt-1 text-sm text-slate-800">{alert.message}</p>
                          </div>
                        ))}
                        {planActions.dispatches.map((dispatch) => (
                          <div key={dispatch.id} className="rounded-lg border border-blue-200 bg-white p-3">
                            <p className="text-sm font-semibold text-blue-800">Dispatch to {humanize(dispatch.target_role)} ({dispatch.status})</p>
                            <p className="mt-1 text-sm text-slate-800">{dispatch.message}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Agent output cards */}
                  <h3 className="font-display text-lg font-bold text-slate-900">Agent outputs</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {Object.entries(plan.raw_agent_outputs || {}).map(([agentName, output]) => {
                      const meta = AGENT_META[agentName] ?? { label: humanize(agentName), icon: "bot", color: "border-l-slate-400" };
                      // Filter out raw_weather and raw_roads from display to keep cards clean
                      const displayEntries = Object.entries(output as Record<string, unknown>).filter(
                        ([k]) => !k.startsWith("raw_")
                      );

                      return (
                        <div key={agentName} className={`card p-4 border-l-4 ${meta.color}`}>
                      <h4 className="font-semibold text-sm mb-3 pb-2 border-b border-slate-200 flex items-center gap-2">
                            <Icon name={meta.icon} className="w-5 h-5 text-blue-700" />
                            <span className="text-slate-900">{meta.label}</span>
                          </h4>
                          <dl className="space-y-2">
                            {displayEntries.map(([key, value]) => (
                              <div
                                key={key}
                                className={`flex justify-between ${agentName === "resource_agent" && key === "available_resources" ? "items-start" : "items-baseline"}`}
                              >
                                <dt className="text-xs text-slate-500">{humanize(key)}</dt>
                                <dd className="text-sm font-medium text-slate-900 text-right max-w-[60%] break-words">
                                  {agentName === "resource_agent" && key === "available_resources" ? (
                                    <ul className="space-y-1">
                                      {availableResourceLines(value).map((line) => (
                                        <li key={line}>{line}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    formatValue(value)
                                  )}
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
