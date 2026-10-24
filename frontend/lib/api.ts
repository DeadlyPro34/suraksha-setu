import { Alert, AuthResponse, Dispatch, DrivingDirections, FieldOfficerSupportMessage, FieldOfficerSupportRequest, NearbyShelter, Report, Resource, ResourceReport, ResponsePlan, ResponsePlanActions, ResponsePlanSummary, Shelter, SupplyRequest, User, VolunteerLocation, VolunteerProfile, VolunteerSafetyEvent, WeatherSnapshot } from "./types";

const fetchApiBridge = async (path: string, options?: RequestInit) => {
  try {
    return await fetch(path, options);
  } catch {
    throw new Error("Could not reach the Suraksha Setu API. Check your connection and confirm the backend is running.");
  }
};

export const fetchApi = async (path: string, options?: RequestInit) => {
  // Keep browser requests same-origin; Next.js proxies /api-bridge to the backend.
  const headers = new Headers(options?.headers);
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("access_token");
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  const res = await fetchApiBridge(`/api-bridge${path}`, { ...options, headers });
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
    if (
      res.status === 401 &&
      typeof window !== "undefined" &&
      !path.startsWith("/api/auth/login") &&
      !path.startsWith("/api/auth/signup")
    ) {
      window.localStorage.removeItem("access_token");
      if (window.location.pathname !== "/login") {
        window.location.assign("/login?reason=session-expired");
      }
    }
    throw new Error(detail);
  }
  return res.json();
};

// Public dashboard requests intentionally omit any saved session token. A stale
// staff token must never turn a public safety page into a sign-in redirect.
export const fetchPublicApi = async (path: string, options?: RequestInit) => {
  const res = await fetchApiBridge(`/api-bridge${path}`, options);
  if (!res.ok) {
    let detail = `Could not load public information (${res.status}).`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // Keep the status-based message when the response has no JSON body.
    }
    throw new Error(detail);
  }
  return res.json();
};

export const getPublicShelters = (limit = 200) =>
  fetchPublicApi(`/api/shelters/?limit=${limit}`) as Promise<Shelter[]>;

export const getPublicAlerts = (limit = 50) =>
  fetchPublicApi(`/api/alerts/public?limit=${limit}`) as Promise<Alert[]>;

export const getWeather = (lat: number, lon: number) =>
  fetchPublicApi(`/api/weather?lat=${lat.toFixed(1)}&lon=${lon.toFixed(1)}`, { cache: "no-store" }) as Promise<WeatherSnapshot>;

export const submitPublicReport = (report: {
  type: Report["type"];
  description: string;
  location: { lat: number; lon: number };
  website?: string;
}) => fetchPublicApi("/api/reports/public", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(report),
}) as Promise<Report>;

export const createReport = (report: {
  type: Report["type"];
  description: string;
  location: { lat: number; lon: number };
  image_url?: string;
}) =>
  fetchApi("/api/reports/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
  }) as Promise<Report>;

export interface MediaUpload {
  media_id: string;
  url: string;
  upload_url: string;
  content_type: string;
  size_bytes: number;
}

export const uploadReportMedia = async (file: File): Promise<MediaUpload> => {
  const upload = await fetchApi("/api/media/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content_type: file.type, size_bytes: file.size }),
  }) as MediaUpload;
  let response: Response;
  try {
    response = await fetch(upload.upload_url, {
      method: "PUT",
      headers: { "Content-Type": file.type, "x-upsert": "false" },
      body: file,
    });
  } catch {
    throw new Error("Could not upload the photo to storage. Check your connection and Supabase Storage settings.");
  }
  if (!response.ok) {
    throw new Error(`Photo upload failed (${response.status}). Check that the Supabase bucket allows this file type and size.`);
  }
  return upload;
};

export const getReports = (limit = 100) =>
  fetchApi(`/api/reports/?limit=${limit}`) as Promise<Report[]>;

export const getMyReports = (limit = 100) =>
  fetchApi(`/api/reports/mine?limit=${limit}`) as Promise<Report[]>;

export interface AnalysisResult {
  incident_id: string;
  response_plan_id: string;
  priority_score: number;
  summary: string;
  ai_used: boolean;
  raw_agent_outputs?: Record<string, Record<string, unknown>>;
}

export const analyzeReport = (reportId: string) =>
  fetchApi(`/api/reports/${reportId}/analyze`, { method: "POST" }) as Promise<AnalysisResult>;

export const getAlerts = (limit = 100) =>
  fetchApi(`/api/alerts/?limit=${limit}`) as Promise<Alert[]>;

export const getMapAlerts = (limit = 200) =>
  fetchApi(`/api/alerts/map?limit=${limit}`) as Promise<Alert[]>;

export const getCitizenAlerts = (limit = 100) =>
  fetchApi(`/api/alerts/nearby?limit=${limit}`) as Promise<Alert[]>;

export const getShelters = (limit = 200) =>
  fetchApi(`/api/shelters/?limit=${limit}`) as Promise<Shelter[]>;

export const getNearbyShelters = (lat: number, lon: number) =>
  fetchApi(`/api/shelters/nearby?lat=${lat}&lon=${lon}`) as Promise<NearbyShelter[]>;

export const getDrivingDirections = (start: { lat: number; lon: number }, end: { lat: number; lon: number }, hazards: Array<{ lat: number; lon: number }> = []) => {
  const params = new URLSearchParams({ start_lat: String(start.lat), start_lon: String(start.lon), end_lat: String(end.lat), end_lon: String(end.lon) });
  hazards.slice(0, 30).forEach((hazard) => params.append("hazard", `${hazard.lat},${hazard.lon}`));
  return fetch(`/api/directions?${params.toString()}`, { cache: "no-store" }).then(async (response) => {
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(typeof body.detail === "string" ? body.detail : `Could not load directions (${response.status}).`);
    }
    return response.json() as Promise<DrivingDirections>;
  });
};

export type ShelterMutation = Pick<Shelter, "name" | "lat" | "lon" | "capacity" | "current_occupancy" | "has_electricity" | "has_medical" | "status">;

export const createShelter = (data: ShelterMutation) => fetchApi("/api/shelters/", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
}) as Promise<Shelter>;

export const updateShelter = (shelterId: string, data: ShelterMutation) => fetchApi(`/api/shelters/${shelterId}`, {
  method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
}) as Promise<Shelter>;

export const getMySupplyRequests = () => fetchApi("/api/supply-requests/mine") as Promise<SupplyRequest[]>;
export const createSupplyRequest = (data: Pick<SupplyRequest, "resource_type" | "requested_quantity" | "location_name" | "note" | "lat" | "lon">) => fetchApi("/api/supply-requests", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
}) as Promise<SupplyRequest>;
export const getSupplyRequests = (status?: SupplyRequest["status"]) => fetchApi(`/api/supply-requests${status ? `?status=${status}` : ""}`) as Promise<SupplyRequest[]>;
export const reviewSupplyRequest = (id: string, decision: "approved" | "rejected", approved_quantity?: number, review_note = "") => fetchApi(`/api/supply-requests/${id}/review`, {
  method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, approved_quantity, review_note }),
}) as Promise<SupplyRequest>;
export const dispatchSupplyRequest = (id: string, stock_source_resource_id: string, dispatched_quantity: number, delivery_handler: string, dispatch_note: string) => fetchApi(`/api/supply-requests/${id}/dispatch`, {
  method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stock_source_resource_id, dispatched_quantity, delivery_handler, dispatch_note }),
}) as Promise<SupplyRequest>;
export const confirmSupplyReceipt = (id: string, received_quantity: number, receipt_note = "") => fetchApi(`/api/supply-requests/${id}/receipt`, {
  method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ received_quantity, receipt_note }),
}) as Promise<SupplyRequest>;
export const closeSupplyDelivery = (id: string, received_quantity: number, reason = "") => fetchApi(`/api/supply-requests/${id}/close-delivery`, {
  method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ received_quantity, reason }),
}) as Promise<SupplyRequest>;

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

export const getResponsePlans = (limit = 100) =>
  fetchApi(`/api/response-plans/?limit=${limit}`) as Promise<ResponsePlanSummary[]>;

export const getFieldOfficers = () =>
  fetchApi("/api/dispatches/field-officers") as Promise<Array<Pick<User, "id" | "name">>>;

export const getVolunteers = () =>
  fetchApi("/api/dispatches/volunteers") as Promise<Array<Pick<User, "id" | "name" | "phone"> & { available: boolean; skills: string | null; languages: string | null; has_transport: boolean }>>;
export const getMyVolunteerProfile = () => fetchApi("/api/volunteers/me/profile") as Promise<VolunteerProfile>;
export const updateMyVolunteerProfile = (profile: Pick<VolunteerProfile, "available" | "skills" | "languages" | "has_transport">) => fetchApi("/api/volunteers/me/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) }) as Promise<VolunteerProfile>;
export const shareVolunteerLocation = (dispatch_id: string, lat: number, lon: number) => fetchApi("/api/volunteers/me/location", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dispatch_id, lat, lon }) });
export const stopVolunteerLocation = () => fetchApi("/api/volunteers/me/location", { method: "DELETE" });
export const getVolunteerLocations = () => fetchApi("/api/volunteers/locations") as Promise<VolunteerLocation[]>;
export const checkInVolunteer = (dispatchId: string) => fetchApi(`/api/volunteers/me/dispatches/${dispatchId}/check-in`, { method: "POST" });
export const checkOutVolunteer = (dispatchId: string) => fetchApi(`/api/volunteers/me/dispatches/${dispatchId}/check-out`, { method: "POST" });
export const sendVolunteerSOS = (dispatchId: string, data: { lat?: number; lon?: number; accuracy_m?: number; message?: string } = {}) => fetchApi(`/api/volunteers/me/dispatches/${dispatchId}/sos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }) as Promise<VolunteerSafetyEvent>;
export const getVolunteerSafetyEvents = () => fetchApi("/api/volunteers/safety-events") as Promise<VolunteerSafetyEvent[]>;
export const resolveVolunteerSafetyEvent = (eventId: string) => fetchApi(`/api/volunteers/safety-events/${eventId}/resolve`, { method: "PATCH" });

export const getVolunteerTasks = () =>
  fetchApi("/api/dispatches/volunteer-tasks") as Promise<Dispatch[]>;

export const createVolunteerTask = (data: { response_plan_id: string; message: string; volunteers_needed: number; shift_starts_at?: string | null; shift_ends_at?: string | null; meeting_point?: string | null }) =>
  fetchApi("/api/dispatches/volunteer-tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }) as Promise<Dispatch[]>;

export const assignVolunteer = (dispatchId: string, userId: string) =>
  fetchApi(`/api/dispatches/${dispatchId}/assign-volunteer`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  }) as Promise<Dispatch>;

export const getUnassignedDispatches = () =>
  fetchApi("/api/dispatches/unassigned") as Promise<Dispatch[]>;

export const getFieldOfficerTasks = () =>
  fetchApi("/api/dispatches/field-officer-tasks") as Promise<Dispatch[]>;

export const getFieldOfficerSupportRequests = () =>
  fetchApi("/api/dispatches/support-requests") as Promise<FieldOfficerSupportRequest[]>;

export const assignVolunteersToSupportRequest = (requestId: string, volunteerIds: string[]) =>
  fetchApi(`/api/dispatches/support-requests/${requestId}/assign`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ volunteer_ids: volunteerIds }),
  }) as Promise<FieldOfficerSupportRequest>;

export const requestFieldOfficerSupport = (dispatchId: string, request: Pick<FieldOfficerSupportRequest, "support_type" | "volunteers_needed" | "details" | "location">) =>
  fetchApi(`/api/dispatches/mine/${dispatchId}/support-requests`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  }) as Promise<FieldOfficerSupportRequest>;

export const sendSupportRequestMessage = (requestId: string, message: string) =>
  fetchApi(`/api/dispatches/support-requests/${requestId}/messages`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  }) as Promise<FieldOfficerSupportMessage>;

export const assignDispatch = (dispatchId: string, userId: string, details?: { instructions?: string; due_at?: string; meeting_point?: string }) =>
  fetchApi(`/api/dispatches/${dispatchId}/assign`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, ...details }),
  }) as Promise<Dispatch>;

export const getMyDispatches = () =>
  fetchApi("/api/dispatches/mine") as Promise<Dispatch[]>;

export const getResources = (limit = 200) =>
  fetchApi(`/api/resources/?limit=${limit}`) as Promise<Resource[]>;

export const getMyResourceReports = () =>
  fetchApi("/api/resources/reports/mine") as Promise<ResourceReport[]>;

export const submitResourceReport = (data: {
  resource_type: Resource["type"];
  quantity: number;
  location_name: string;
  note: string;
  lat?: number | null;
  lon?: number | null;
}) => fetchApi("/api/resources/reports", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
}) as Promise<ResourceReport>;

export const getResourceReports = (status?: ResourceReport["status"]) =>
  fetchApi(`/api/resources/reports${status ? `?status=${status}` : ""}`) as Promise<ResourceReport[]>;

export const reviewResourceReport = (reportId: string, decision: "approved" | "rejected", review_note = "") =>
  fetchApi(`/api/resources/reports/${reportId}/review`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, review_note }),
  }) as Promise<ResourceReport>;

export const acknowledgeDispatch = (dispatchId: string) =>
  updateDispatchStatus(dispatchId, "acknowledged");

export const updateDispatchStatus = (dispatchId: string, status: "acknowledged" | "en_route" | "arrived" | "needs_help") =>
  fetchApi(`/api/dispatches/mine/${dispatchId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  }) as Promise<Dispatch>;

export const completeAssignedTask = (dispatchId: string, completionNote: string, details: { remaining_work?: string; resources_used?: string; media_id?: string } = {}) =>
  fetchApi(`/api/dispatches/mine/${dispatchId}/complete`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completion_note: completionNote, ...details }),
  }) as Promise<Dispatch>;

export const addDispatchUpdate = (dispatchId: string, kind: "progress" | "blocker", note: string, media_id?: string) =>
  fetchApi(`/api/dispatches/mine/${dispatchId}/updates`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, note, media_id }),
  }) as Promise<Dispatch>;

export const addOfficialDispatchUpdate = (dispatchId: string, note: string) =>
  fetchApi(`/api/dispatches/${dispatchId}/updates`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "official_instruction", note }),
  }) as Promise<Dispatch>;

export const uploadDispatchPhoto = async (file: File): Promise<string> => {
  const result = await uploadReportMedia(file);
  return result.media_id;
};

export const acknowledgeDispatchCompletion = (dispatchId: string) =>
  fetchApi(`/api/dispatches/${dispatchId}/acknowledge-completion`, { method: "PATCH" }) as Promise<Dispatch>;
