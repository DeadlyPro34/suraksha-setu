"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function UpdateStatus() {
  const router = useRouter();
  useEffect(() => router.replace("/field-officer"), [router]);
  return <main className="min-h-screen grid place-items-center bg-slate-50 text-slate-600">Opening your assignments…</main>;
}
