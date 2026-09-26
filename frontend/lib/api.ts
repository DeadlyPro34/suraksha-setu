import { Alert, Report, ResponsePlan, ResponsePlanActions, Shelter } from "./types";

export const fetchApi = async (path: string, options?: RequestInit) => {
  // Keep browser requests same-origin; Next.js proxies /_api to the backend.
  const res = await fetch(`/_api${path}`, options);
  if (!res.ok) {
    let detail = `API error: ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // Keep the status-based error when the response has no JSON body.
    }
    throw new Error(detail);
  }
  return res.json();
};

export const createReport = (report: Omit<Report, "id" | "status" | "created_at">) =>
  fetchApi("/api/reports/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
  }) as Promise<Report>;

export const getReports = (limit = 100) =>
  fetchApi(`/api/reports/?limit=${limit}`) as Promise<Report[]>;

export const getAlerts = (limit = 100) =>
  fetchApi(`/api/alerts/?limit=${limit}`) as Promise<Alert[]>;

export const getShelters = (limit = 200) =>
  fetchApi(`/api/shelters/?limit=${limit}`) as Promise<Shelter[]>;

export const runPipeline = async (incidentId: string): Promise<ResponsePlan> => {
  const options: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  };
  return fetchApi(`/api/test/run-pipeline/${incidentId}`, options);
};

export const checkHealth = async () => {
  return fetchApi('/health');
};

export const submitDecision = async (
  planId: string,
  decision: "approved" | "rejected" | "modified",
  notes?: string,
  modifiedSummary?: string,
) => {
  return fetchApi(`/api/response-plans/${planId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, notes, modified_summary: modifiedSummary }),
  });
};

export const getResponsePlanActions = (planId: string) =>
  fetchApi(`/api/response-plans/${planId}/actions`) as Promise<ResponsePlanActions>;
