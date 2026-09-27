import { Alert, AuthResponse, Report, ResponsePlan, ResponsePlanActions, Shelter, User } from "./types";

export const fetchApi = async (path: string, options?: RequestInit) => {
  // Keep browser requests same-origin; Next.js proxies /_api to the backend.
  const headers = new Headers(options?.headers);
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("access_token");
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  const res = await fetch(`/_api${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = `API error: ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") {
        detail = body.detail;
      } else if (Array.isArray(body.detail)) {
        const messages = body.detail.flatMap((issue: unknown) => {
          if (typeof issue !== "object" || issue === null) return [];
          const validationIssue = issue as { loc?: unknown; msg?: unknown };
          if (typeof validationIssue.msg !== "string") return [];
          const location = Array.isArray(validationIssue.loc)
            ? validationIssue.loc.filter((part): part is string => typeof part === "string").slice(1).join(".")
            : "";
          return [location ? `${location}: ${validationIssue.msg}` : validationIssue.msg];
        });
        if (messages.length) detail = messages.join("; ");
      }
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

export const saveAccessToken = (token: string) => {
  window.localStorage.setItem("access_token", token);
};

export const loginUser = (phone: string, password: string) =>
  fetchApi("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  }) as Promise<AuthResponse>;

export const signupUser = (data: {
  name: string;
  phone: string;
  password: string;
  role: User["role"];
  invite_code?: string;
}) =>
  fetchApi("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }) as Promise<AuthResponse>;

export const getCurrentUser = () => fetchApi("/api/auth/me") as Promise<User>;

export const getResponsePlanActions = (planId: string) =>
  fetchApi(`/api/response-plans/${planId}/actions`) as Promise<ResponsePlanActions>;
