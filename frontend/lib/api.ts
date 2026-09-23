import { ResponsePlan } from "./types";

export const fetchApi = async (path: string, options?: RequestInit) => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, options);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
};

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
