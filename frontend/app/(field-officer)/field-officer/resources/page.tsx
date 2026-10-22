"use client";

import { useCallback, useEffect, useState } from "react";
import { getResources } from "@/lib/api";
import { Resource } from "@/lib/types";

const labels: Record<Resource["type"], string> = { medical: "Medical kits", food: "Food rations", water: "Drinking water", boat: "Rescue boats", personnel: "Personnel" };

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setResources(await getResources()); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not load resource stock."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const available = resources.filter((resource) => resource.status === "available");
  const grouped = available.reduce<Record<string, number>>((totals, resource) => {
    totals[resource.type] = (totals[resource.type] || 0) + resource.quantity;
    return totals;
  }, {});

  return <main className="min-h-screen bg-slate-50 p-6 sm:p-8"><div className="max-w-4xl mx-auto"><header className="mb-6"><h1 className="text-3xl font-bold text-slate-900">Available resources</h1><p className="mt-1 text-slate-500">Current stock registered across response locations.</p></header>
    {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error} <button onClick={() => void load()} className="ml-2 underline">Retry</button></p>}
    {loading ? <p role="status" className="card p-5 text-sm text-slate-500">Loading resource stock…</p> : available.length === 0 ? <p className="card p-5 text-sm text-slate-500">No available resources are registered.</p> : <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(grouped).map(([type, quantity]) => <article key={type} className="card p-5"><p className="text-sm text-slate-500">{labels[type as Resource["type"]] || type}</p><p className="mt-1 text-3xl font-bold text-slate-900">{quantity}</p><p className="text-xs text-slate-400">available units</p></article>)}</div><div className="mt-5 space-y-2">{available.map((resource) => <div key={resource.id} className="card flex justify-between gap-4 p-4 text-sm"><span className="font-medium text-slate-800">{labels[resource.type]}</span><span className="text-slate-600">{resource.quantity} · {resource.lat !== null && resource.lon !== null ? `${resource.lat.toFixed(4)}, ${resource.lon.toFixed(4)}` : "Regional stock"}</span></div>)}</div></>}
  </div></main>;
}
