"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { acknowledgeDispatch, getMyDispatches } from "@/lib/api";
import { Dispatch } from "@/lib/types";

export default function MissionDetail() {
  const params = useParams<{ id: string }>();
  const [dispatch, setDispatch] = useState<Dispatch | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getMyDispatches().then((items) => {
      if (active) setDispatch(items.find((item) => item.id === params.id) ?? null);
    }).catch((err: unknown) => {
      if (active) setError(err instanceof Error ? err.message : "Could not load this assignment.");
    });
    return () => { active = false; };
  }, [params.id]);

  const acknowledge = async () => {
    if (!dispatch) return;
    setBusy(true);
    setError("");
    try { setDispatch(await acknowledgeDispatch(dispatch.id)); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not acknowledge assignment."); }
    finally { setBusy(false); }
  };

  return <main className="min-h-screen bg-slate-50 p-6 sm:p-8"><article className="card mx-auto max-w-3xl p-6">
    <Link href="/field-officer" className="text-sm font-medium text-blue-700 underline">← My assignments</Link>
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!dispatch && !error && <p role="status" className="mt-5 text-slate-600">Loading assignment…</p>}
    {dispatch && <><div className="mt-5 flex items-center justify-between gap-3"><h1 className="text-2xl font-bold text-slate-900">Assignment details</h1><span className="badge badge-warning">{dispatch.status}</span></div>
      <p className="mt-4 text-slate-800">{dispatch.message}</p>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Report</dt><dd className="break-all font-medium">{dispatch.report_id ?? "Not linked"}</dd></div><div><dt className="text-slate-500">Assigned</dt><dd className="font-medium">{dispatch.dispatched_at ? new Date(dispatch.dispatched_at).toLocaleString() : "Time unavailable"}</dd></div></dl>
      {dispatch.status !== "acknowledged" && <button disabled={busy} onClick={() => void acknowledge()} className="mt-6 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Acknowledge assignment"}</button>}
    </>}
  </article></main>;
}
