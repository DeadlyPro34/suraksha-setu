"use client";

import { useEffect, useState } from "react";
import { checkHealth, runPipeline } from "@/lib/api";
import { ResponsePlan } from "@/lib/types";

export default function CommandDashboard() {
  const [healthStatus, setHealthStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [incidentId, setIncidentId] = useState("");
  const [responsePlan, setResponsePlan] = useState<ResponsePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkHealth()
      .then(() => setHealthStatus("connected"))
      .catch(() => setHealthStatus("disconnected"));
  }, []);

  const handleRunPipeline = async () => {
    if (!incidentId) return;
    setLoading(true);
    setError(null);
    try {
      const plan = await runPipeline(incidentId);
      setResponsePlan(plan);
    } catch (err: any) {
      setError(err.message || "Failed to run pipeline");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between border-b pb-4">
        <h1 className="text-3xl font-bold">Command Dashboard</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500">Backend:</span>
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
            healthStatus === "connected" ? "bg-green-100 text-green-800" : 
            healthStatus === "disconnected" ? "bg-red-100 text-red-800" : 
            "bg-yellow-100 text-yellow-800"
          }`}>
            {healthStatus}
          </span>
        </div>
      </div>

      <div className="mb-8 p-6 border rounded-lg bg-gray-50 dark:bg-gray-900">
        <h2 className="text-lg font-semibold mb-4">Run Test Pipeline</h2>
        <div className="flex gap-4">
          <input 
            type="text" 
            value={incidentId}
            onChange={(e) => setIncidentId(e.target.value)}
            placeholder="Enter incident ID (e.g. 550e8400...)"
            className="flex-1 px-4 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
          />
          <button 
            onClick={handleRunPipeline}
            disabled={loading || !incidentId}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
          >
            {loading ? "Running..." : "Run Pipeline"}
          </button>
        </div>
        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}
      </div>

      {responsePlan && (
        <div className="space-y-6">
          <div className="p-6 border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
            <h2 className="text-2xl font-bold mb-4">Response Plan</h2>
            <div className="mb-4">
              <span className="text-sm text-gray-500 uppercase tracking-wider">Priority Score</span>
              <div className="text-3xl font-bold text-blue-600">{responsePlan.priority_score}</div>
            </div>
            <div>
              <span className="text-sm text-gray-500 uppercase tracking-wider block mb-1">Summary</span>
              <p className="text-lg leading-relaxed">{responsePlan.summary}</p>
            </div>
          </div>

          <h3 className="text-xl font-semibold pt-4">Agent Outputs</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Object.entries(responsePlan.raw_agent_outputs || {}).map(([agentName, output]) => (
              <div key={agentName} className="p-5 border rounded-lg bg-white dark:bg-gray-800 shadow-sm flex flex-col">
                <h4 className="font-semibold text-lg capitalize mb-3 pb-2 border-b">
                  {agentName.replace('_agent', '')} Agent
                </h4>
                <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-4 rounded-md">
                  <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">
                    {JSON.stringify(output, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
