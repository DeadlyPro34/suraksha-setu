"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandMark } from "@/components/Brand";
import { getCurrentUser } from "@/lib/api";
import { homeForRole } from "@/lib/auth";
import { User } from "@/lib/types";

export default function FieldOfficerLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let active = true;
    getCurrentUser().then((user) => {
      if (!active) return;
      if (user.role !== "field_officer" && user.role !== "volunteer") {
        router.replace(homeForRole(user.role));
        return;
      }
      setUser(user);
      setAuthorized(true);
    }).catch(() => {
      if (!active) return;
      window.localStorage.removeItem("access_token");
      router.replace("/login");
    });
    return () => { active = false; };
  }, [router]);

  const signOut = () => {
    window.localStorage.removeItem("access_token");
    router.replace("/login");
  };

  if (!authorized) return <main className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">Checking authentication…</main>;
  return <div className="min-h-screen bg-[#f2f6f5]">
    <header className="sticky top-0 z-40 border-b border-[#d9e5e1] bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-3 px-3 py-2 sm:px-5">
        <Link href="/field-officer" className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-teal-700">
          <BrandMark />
          <span className="min-w-0"><span className="block truncate text-sm font-bold leading-tight text-slate-900 sm:text-base">Suraksha Setu</span><span className="block text-xs text-slate-500">{user?.role === "volunteer" ? "Volunteer workspace" : "Field officer workspace"}</span></span>
        </Link>
        <nav aria-label="Workspace navigation" className="hidden items-center gap-1 sm:flex">
          <Link href="/field-officer" aria-current={pathname === "/field-officer" ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-medium ${pathname === "/field-officer" ? "bg-teal-50 text-teal-900" : "text-slate-600 hover:bg-slate-100"}`}>My tasks</Link>
          <Link href="/field-officer/resources" aria-current={pathname.startsWith("/field-officer/resources") ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-medium ${pathname.startsWith("/field-officer/resources") ? "bg-teal-50 text-teal-900" : "text-slate-600 hover:bg-slate-100"}`}>Safety &amp; resources</Link>
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="hidden max-w-40 truncate text-sm text-slate-600 md:block">{user?.name}</span>
          <button type="button" onClick={signOut} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-900">Sign out</button>
        </div>
      </div>
      <nav aria-label="Workspace navigation" className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-1.5 sm:hidden">
        <Link href="/field-officer" aria-current={pathname === "/field-officer" ? "page" : undefined} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold ${pathname === "/field-officer" ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}>My tasks</Link>
        <Link href="/field-officer/resources" aria-current={pathname.startsWith("/field-officer/resources") ? "page" : undefined} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold ${pathname.startsWith("/field-officer/resources") ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Safety &amp; resources</Link>
      </nav>
    </header>
    {children}
  </div>;
}
