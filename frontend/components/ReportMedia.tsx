"use client";

import { useEffect, useState } from "react";

export function ReportMedia({ url }: { url: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;
    const load = async () => {
      try {
        const headers = new Headers();
        const token = window.localStorage.getItem("access_token");
        if (token) headers.set("Authorization", `Bearer ${token}`);
        const response = await fetch(`/api-bridge${url}`, { headers });
        if (!response.ok) throw new Error(`Could not load attached media (${response.status}).`);
        const blob = await response.blob();
        setIsVideo(blob.type.startsWith("video/"));
        createdUrl = URL.createObjectURL(blob);
        if (active) setObjectUrl(createdUrl);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load attached media.");
      }
    };
    void load();
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [url]);

  if (error) return <p role="status" className="mt-3 text-sm text-amber-800">{error}</p>;
  if (!objectUrl) return <p role="status" className="mt-3 text-sm text-slate-500">Loading attached media…</p>;
  return isVideo
    ? <video src={objectUrl} controls playsInline className="mt-3 max-h-96 w-full rounded-lg bg-black" />
    : <img src={objectUrl} alt="Evidence attached to this incident report" className="mt-3 max-h-96 w-full rounded-lg object-contain bg-slate-100" />;
}
