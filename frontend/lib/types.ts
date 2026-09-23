export interface User {}
export interface Report {}
export interface Incident {}
export interface Shelter {}
export interface Resource {}

export interface ResponsePlan {
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

export interface Approval {}
export interface Alert {}
