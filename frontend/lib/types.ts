export interface User {
  id: string;
  name: string;
  phone: string;
  role: "citizen" | "field_officer" | "volunteer" | "official";
}
export interface AuthResponse {
  access_token: string;
  token_type: "bearer";
  user: User;
}
export interface Report {
  id: string;
  reporter_id: string | null;
  type: "flood" | "road_block" | "medical" | "other";
  description: string;
  lat: number;
  lon: number;
  status: "pending_verification" | "verified" | "rejected";
  created_at: string;
  verification_result: "verified" | "rejected" | "uncertain" | null;
  image_url?: string | null;
}
export interface Incident {}
export interface Shelter {
  id: string;
  name: string;
  lat: number;
  lon: number;
  capacity: number;
  current_occupancy: number;
  available_capacity: number;
  available_percentage: number;
  has_electricity: boolean;
  has_medical: boolean;
  status: "open" | "full" | "closed";
}
export interface NearbyShelter extends Shelter {
  distance_km: number;
  capacity_pct: number;
}
export interface Resource {
  id: string;
  incident_id: string | null;
  type: "medical" | "food" | "water" | "boat" | "personnel";
  quantity: number;
  lat: number | null;
  lon: number | null;
  status: "available" | "allocated" | "depleted";
}

export interface ResponsePlan {
  id: string;
  status: string;
  priority_score: number;
  summary: string;
  raw_agent_outputs: {
    flood_agent?: Record<string, any>;
    road_agent?: Record<string, any>;
    shelter_agent?: Record<string, any>;
    resource_agent?: Record<string, any>;
    misinformation_agent?: Record<string, any>;
    [key: string]: any;
  };
}

export interface ResponsePlanSummary {
  id: string;
  incident_id: string;
  report_id: string | null;
  report_description: string | null;
  priority_score: number;
  summary: string;
  status: "pending_approval" | "approved" | "rejected" | "modified";
  generated_at: string;
}

export interface Approval {}
export interface Alert {
  id: string;
  incident_id: string;
  type: "evacuation" | "warning" | "resupply" | "all_clear";
  message: string;
  language: string;
  sent_at: string | null;
  lat?: number | null;
  lon?: number | null;
}

export interface Dispatch {
  id: string;
  response_plan_id: string;
  incident_id: string | null;
  report_id: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  target_role: "field_officer" | "volunteer" | "official";
  task_group_id?: string | null;
  volunteers_needed?: number;
  volunteers_assigned?: number;
  completion_note?: string | null;
  completed_at?: string | null;
  message: string;
  status: "pending" | "sent" | "acknowledged" | "completed";
  dispatched_at: string | null;
}

export interface ResponsePlanActions {
  alerts: Alert[];
  dispatches: Dispatch[];
}

export interface Assignment {
  id: string;
  incidentId: string;
  title: string;
  priority: string;
  location: string;
  eta: string;
  status: string;
}

export interface ResourceRequest {
  type: string;
  quantity: number;
  incidentId: string;
}
