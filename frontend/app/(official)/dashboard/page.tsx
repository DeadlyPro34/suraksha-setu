"use client";

import { useEffect, useState } from "react";
import { checkHealth, runPipeline } from "@/lib/api";
import { ResponsePlan } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Human-friendly labels for each agent key. */
const AGENT_META: Record<string, { label: string; icon: string }> = {
  flood_agent:          { label: "Flood Analysis",          icon: "🌊" },
  road_agent:           { label: "Road Status",             icon: "🛣️" },
  shelter_agent:        { label: "Shelter Finder",          icon: "🏠" },
  resource_agent:       { label: "Resource Allocation",     icon: "📦" },
  misinformation_agent: { label: "Credibility Check",      icon: "🔍" },
};

/** Format a raw key like "flooded_pct" → "Flooded Pct". */
function humanize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Render a single value as readable text. */
function formatValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

/** Color for the priority badge. */
function priorityColor(score: number): string {
  if (score >= 8) return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  if (score >= 5) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                    */
/* ------------------------------------------------------------------ */

export default function CommandDashboard() {
  const [healthStatus, setHealthStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [incidentId, setIncidentId] = useState("");
  const [responsePlan, setResponsePlan] = useState<ResponsePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---- health check on mount ---- */
  useEffect(() => {
    checkHealth()
      .then(() => setHealthStatus("connected"))
      .catch(() => setHealthStatus("disconnected"));
  }, []);

  /* ---- run pipeline ---- */
  const handleRunPipeline = async () => {
    if (!incidentId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const plan = await runPipeline(incidentId.trim());
      setResponsePlan(plan);
    } catch (err: any) {
      setError(err.message || "Failed to run pipeline");
    } finally {
      setLoading(false);
    }
  };

  /* ---- UI ---- */
  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* ── Header + health indicator ── */}
      <div className="mb-8 flex items-center justify-between border-b pb-4">
        <h1 className="text-3xl font-bold">Command Dashboard</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500">Backend:</span>
          <span
            className={`px-2 py-1 text-xs font-semibold rounded-full ${
              healthStatus === "connected"
                ? "bg-green-100 text-green-800"
                : healthStatus === "disconnected"
                ? "bg-red-100 text-red-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {healthStatus}
          </span>
        </div>
      </div>

      {/* ── Pipeline trigger ── */}
      <div className="mb-8 p-6 border rounded-lg bg-gray-50 dark:bg-gray-900">
        <h2 className="text-lg font-semibold mb-4">Run Test Pipeline</h2>
        <div className="flex gap-4">
          <input
            type="text"
            value={incidentId}
            onChange={(e) => setIncidentId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRunPipeline()}
            placeholder="Enter incident ID (e.g. 550e8400-e29b-41d4-a716-446655440000)"
            className="flex-1 px-4 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
          />
          <button
            onClick={handleRunPipeline}
            disabled={loading || !incidentId.trim()}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
          >
            {loading ? "Running…" : "Run Pipeline"}
          </button>
        </div>
        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}
      </div>

      {/* ── Results ── */}
      {responsePlan && (
        <div className="space-y-6">
          {/* Priority + Summary card */}
          <div className="p-6 border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
            <h2 className="text-2xl font-bold mb-4">Response Plan</h2>

            <div className="flex items-center gap-4 mb-4">
              <div>
                <span className="text-sm text-gray-500 uppercase tracking-wider block">
                  Priority Score
                </span>
                <span
                  className={`inline-block mt-1 px-3 py-1 text-2xl font-bold rounded-lg ${priorityColor(
                    responsePlan.priority_score
                  )}`}
                >
                  {responsePlan.priority_score}
                </span>
              </div>
            </div>

            <div>
              <span className="text-sm text-gray-500 uppercase tracking-wider block mb-1">
                Summary
              </span>
              <p className="text-lg leading-relaxed">{responsePlan.summary}</p>
            </div>
          </div>

          {/* Agent output cards */}
          <h3 className="text-xl font-semibold pt-4">Agent Outputs</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Object.entries(responsePlan.raw_agent_outputs || {}).map(
              ([agentName, output]) => {
                const meta = AGENT_META[agentName] ?? {
                  label: humanize(agentName),
                  icon: "🤖",
                };

                return (
                  <div
                    key={agentName}
                    className="p-5 border rounded-lg bg-white dark:bg-gray-800 shadow-sm flex flex-col"
                  >
                    <h4 className="font-semibold text-lg mb-3 pb-2 border-b flex items-center gap-2">
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                    </h4>

                    <dl className="flex-1 space-y-2">
                      {Object.entries(output as Record<string, unknown>).map(
                        ([key, value]) => (
                          <div key={key} className="flex justify-between items-baseline">
                            <dt className="text-sm text-gray-500">{humanize(key)}</dt>
                            <dd className="font-medium text-sm text-right max-w-[60%] break-words">
                              {formatValue(value)}
                            </dd>
                          </div>
                        )
                      )}
                    </dl>
                  </div>
                );
              }
            )}
          </div>
        </div>
      )}
    </div>
  );
}
