export interface User {
  id: string;
  name: string;
  phone: string;
  role: "citizen" | "field_officer" | "volunteer" | "official";
}
export interface VolunteerProfile {
  id: string; name: string; phone: string; available: boolean;
  skills: string | null; languages: string | null; has_transport: boolean;
}
export interface VolunteerLocation {
  volunteer_id: string; volunteer_name: string; dispatch_id: string;
  task_group_id: string | null; task: string; status: string;
  lat: number; lon: number; updated_at: string;
}
export interface VolunteerSafetyEvent {
  id: string; event_type: "sos" | "missed_checkin";
  volunteer_id: string; volunteer_name: string; phone: string;
  dispatch_id: string; task: string; message: string | null;
  lat: number | null; lon: number | null; created_at: string;
  shift_starts_at: string | null; resolved_at: string | null;
  location_source: "current_device" | "last_shared" | "task_area" | "unavailable";
  accuracy_m: number | null;
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
  location_name: string;
  lat: number | null;
  lon: number | null;
  status: "available" | "allocated" | "depleted";
}

export interface ResourceReport {
  id: string;
  resource_type: Resource["type"];
  quantity: number;
  location_name: string;
  note: string;
  lat: number | null;
  lon: number | null;
  status: "pending" | "approved" | "rejected";
  submitted_by: string;
  submitter_name: string;
  submitted_at: string;
  reviewed_by: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  review_note: string | null;
}

export interface SupplyRequest {
  id: string;
  requester_id: string;
  requester_name: string;
  requester_role: "field_officer" | "volunteer";
  resource_type: Resource["type"];
  requested_quantity: number;
  approved_quantity: number | null;
  stock_source_resource_id: string | null;
  stock_source_location: string | null;
  location_name: string;
  lat: number | null;
  lon: number | null;
  note: string;
  status: "pending" | "approved" | "rejected" | "dispatched" | "receipt_submitted" | "delivery_issue" | "delivered";
  created_at: string;
  reviewed_by: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  delivery_handler: string | null;
  dispatch_note: string | null;
  dispatched_by: string | null;
  dispatcher_name: string | null;
  dispatched_at: string | null;
  received_quantity: number | null;
  receipt_note: string | null;
  receipt_status: "awaiting_confirmation" | "confirmed" | "shortfall_reported" | "official_override";
  received_by: string | null;
  receiver_name: string | null;
  received_at: string | null;
  official_close_note: string | null;
  closed_by: string | null;
  closer_name: string | null;
  closed_at: string | null;
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
  completion_acknowledged_at?: string | null;
  message: string;
  status: "pending" | "sent" | "acknowledged" | "en_route" | "arrived" | "needs_help" | "completed";
  dispatched_at: string | null;
  lat?: number | null; lon?: number | null;
  priority_score?: number | null;
  shift_starts_at?: string | null; shift_ends_at?: string | null;
  checked_in_at?: string | null; checked_out_at?: string | null;
  meeting_point?: string | null;
    instructions?: string | null;
    due_at?: string | null;
    updates?: DispatchUpdate[];
    support_requests?: FieldOfficerSupportRequest[];
    support_request_id?: string | null;
    support_request_messages?: FieldOfficerSupportMessage[];
}

  export interface DispatchUpdate {
    id: string;
    author_id: string;
    author_name: string;
    kind: "progress" | "blocker" | "official_instruction" | "completion" | "status_update";
    note: string;
    media_id?: string | null;
    remaining_work?: string | null;
    resources_used?: string | null;
    created_at: string;
  }

export interface FieldOfficerSupportVolunteer {
  dispatch_id: string;
  name: string;
  status: string;
}

export interface FieldOfficerSupportMessage {
  id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  message: string;
  created_at: string;
}

export interface FieldOfficerSupportRequest {
  id: string;
  dispatch_id: string;
  requested_by: string;
  officer_name: string;
  support_type: "medical" | "rescue" | "logistics" | "general";
  details: string;
  location: string | null;
  volunteers_needed: number;
  volunteers_assigned: number;
  volunteers: FieldOfficerSupportVolunteer[];
  messages?: FieldOfficerSupportMessage[];
  status: string;
  created_at: string;
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
