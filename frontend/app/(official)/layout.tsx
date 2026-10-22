"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BrandMark } from "@/components/Brand";
import { checkHealth, getCurrentUser } from "@/lib/api";
import { homeForRole } from "@/lib/auth";
import { User } from "@/lib/types";

const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: "▦" },
  { label: "Incidents", href: "/incidents", icon: "△" },
  { label: "Approvals", href: "/approvals", icon: "✓" },
  { label: "Shelters", href: "/official/shelters", icon: "⌂" },
];

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Command Center", subtitle: "Disaster response overview" },
  "/incidents": { title: "Incident reports", subtitle: "Review reports and start an analysis" },
  "/approvals": { title: "Plan approvals", subtitle: "Review response plans and assign field work" },
  "/official/shelters": { title: "Shelter directory", subtitle: "Check capacity and available support" },
};

export default function OfficialLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [backend, setBackend] = useState<"checking" | "connected" | "offline">("checking");

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((currentUser) => {
        if (!active) return;
        if (currentUser.role !== "official") {
          router.replace(homeForRole(currentUser.role));
          return;
        }
        setUser(currentUser);
        setAuthorized(true);
      })
      .catch(() => {
        if (!active) return;
        window.localStorage.removeItem("access_token");
        router.replace("/login");
      });
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    let active = true;
    checkHealth().then(() => {
      if (active) setBackend("connected");
    }).catch(() => {
      if (active) setBackend("offline");
    });
    return () => { active = false; };
  }, []);

  const signOut = () => {
    window.localStorage.removeItem("access_token");
    router.replace("/login");
  };

  if (!authorized) {
    return <main className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">Checking authentication…</main>;
  }

  const currentPage = pageTitles[pathname] || pageTitles["/dashboard"];
  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-ink text-white">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <BrandMark />
          <div><p className="font-bold">Suraksha Setu</p><p className="text-xs text-blue-200">Official workspace</p></div>
        </div>
        <nav aria-label="Official navigation" className="flex-1 space-y-1 p-3">
          {navigation.map((item) => {
            const active = pathname === item.href;
            return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors ${active ? "bg-white/15 font-semibold text-white" : "text-blue-100 hover:bg-white/10 hover:text-white"}`}>
              <span aria-hidden="true" className="w-5 text-center text-lg">{item.icon}</span>{item.label}
            </Link>;
          })}
        </nav>
        <div className="border-t border-white/10 px-5 py-4 text-sm text-blue-100">
          <span className={`mr-2 inline-block h-2 w-2 rounded-full ${backend === "connected" ? "bg-emerald-400" : backend === "offline" ? "bg-red-400" : "bg-amber-400"}`} />
          Backend: {backend === "connected" ? "connected" : backend === "offline" ? "offline" : "checking"}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div><h1 className="text-xl font-bold text-slate-900">{currentPage.title}</h1><p className="mt-0.5 text-sm text-slate-500">{currentPage.subtitle}</p></div>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-slate-600 sm:inline">{user?.name || "Official"}</span>
              <button type="button" onClick={signOut} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Sign out</button>
            </div>
          </div>
          <nav aria-label="Official navigation" className="flex gap-1 overflow-x-auto px-3 pb-3 md:hidden">
            {navigation.map((item) => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-sm ${pathname === item.href ? "bg-ink font-semibold text-white" : "bg-slate-100 text-slate-700"}`}>{item.label}</Link>)}
          </nav>
        </header>
        <main className="w-full flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
