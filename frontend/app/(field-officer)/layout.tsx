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
  const navigation = [
    { label: "My tasks", href: "/field-officer", icon: "tasks" as const, active: pathname === "/field-officer" },
    { label: "Safety & resources", href: "/field-officer/resources", icon: "resources" as const, active: pathname.startsWith("/field-officer/resources") },
  ];

  return <div className="min-h-screen bg-[#f2f6f5] pb-24 md:pb-0">
    <header className="sticky top-0 z-40 border-b border-[#d9e5e1] bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-3 px-3 py-2 sm:px-5">
        <Link href="/field-officer" className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-teal-700">
          <BrandMark />
          <span className="min-w-0"><span className="block truncate text-sm font-bold leading-tight text-slate-900 sm:text-base">Suraksha Setu</span><span className="block text-xs text-slate-500">{user?.role === "volunteer" ? "Volunteer workspace" : "Field officer workspace"}</span></span>
        </Link>
        <nav aria-label="Workspace navigation" className="hidden items-center gap-1 md:flex">
          <Link href="/field-officer" aria-current={pathname === "/field-officer" ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-medium ${pathname === "/field-officer" ? "bg-teal-50 text-teal-900" : "text-slate-600 hover:bg-slate-100"}`}>My tasks</Link>
          <Link href="/field-officer/resources" aria-current={pathname.startsWith("/field-officer/resources") ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-medium ${pathname.startsWith("/field-officer/resources") ? "bg-teal-50 text-teal-900" : "text-slate-600 hover:bg-slate-100"}`}>Safety &amp; resources</Link>
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="hidden max-w-40 truncate text-sm text-slate-600 md:block">{user?.name}</span>
          <button type="button" onClick={signOut} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-900">Sign out</button>
        </div>
      </div>
    </header>
    {children}
    <nav aria-label="Workspace navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-4 pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden" style={{ paddingBottom: "max(0.65rem, env(safe-area-inset-bottom))" }}>
      <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
        {navigation.map((item) => <Link key={item.href} href={item.href} aria-current={item.active ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold transition-colors ${item.active ? "bg-teal-800 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">{item.icon === "tasks" ? <><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 .8.8L6 5m-2.5 7 .8.8L6 11m-2.5 7 .8.8L6 17"/></> : <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>}</svg>
          <span>{item.label}</span>
        </Link>)}
      </div>
    </nav>
  </div>;
}
