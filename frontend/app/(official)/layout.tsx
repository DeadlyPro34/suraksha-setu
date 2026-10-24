"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BrandMark } from "@/components/Brand";
import { checkHealth, getCurrentUser } from "@/lib/api";
import { homeForRole } from "@/lib/auth";
import { User } from "@/lib/types";

const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: "home" },
  { label: "Incidents", href: "/incidents", icon: "alert" },
  { label: "Approvals", href: "/approvals", icon: "check" },
  { label: "Field officers", href: "/field-officers", icon: "officer" },
  { label: "Volunteers", href: "/volunteers", icon: "volunteer" },
  { label: "Stock reports", href: "/resource-reports", icon: "stock" },
  { label: "Supply deliveries", href: "/supply-requests", icon: "delivery" },
  { label: "Shelters", href: "/official/shelters", icon: "shelter" },
  { label: "Map", href: "/map", icon: "map" },
];

const mobileNavigation = navigation.slice(0, 3);
const moreNavigation = navigation.slice(3);

function NavIcon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const paths: Record<string, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    alert: <><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v5m0 3h.01" /></>,
    check: <><path d="m5 12 4 4L19 6" /><circle cx="12" cy="12" r="9" /></>,
    officer: <><circle cx="12" cy="7" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2M8 12l4 3 4-3" /></>,
    volunteer: <><path d="M12 21s-8-4.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.5-8 11-8 11Z" /><path d="M12 9v6m-3-3h6" /></>,
    stock: <><path d="M4 5h16M4 12h16M4 19h16" /><path d="M7 5v.01M7 12v.01M7 19v.01" /></>,
    delivery: <><path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z" /><circle cx="7.5" cy="19" r="1.5" /><circle cx="17.5" cy="19" r="1.5" /></>,
    shelter: <><path d="m3 11 9-8 9 8v9H3z" /><path d="M9 20v-6h6v6" /></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15m6-12v15" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    logout: <><path d="M10 17l5-5-5-5m5 5H3" /><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
  };
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.more}</svg>;
}

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Command Center", subtitle: "Disaster response overview" },
  "/incidents": { title: "Incident reports", subtitle: "Review reports and start an analysis" },
  "/approvals": { title: "Plan approvals", subtitle: "Review response plans and assign field work" },
  "/field-officers": { title: "Field officer assignments", subtitle: "Assign response dispatches to field officers" },
  "/volunteers": { title: "Volunteer coordination", subtitle: "Create volunteer tasks and manage staffing" },
  "/resource-reports": { title: "Stock reports", subtitle: "Review field counts before updating shared inventory" },
  "/supply-requests": { title: "Supply delivery tracking", subtitle: "Approve field requests and confirm delivery" },
  "/official/shelters": { title: "Shelter directory", subtitle: "Check capacity and available support" },
  "/map": { title: "Response map", subtitle: "Live view of alerts and shelter locations" },
};

export default function OfficialLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [backend, setBackend] = useState<"checking" | "connected" | "offline">("checking");
  const [moreOpen, setMoreOpen] = useState(false);

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

  useEffect(() => {
    if (!moreOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [moreOpen]);

  const signOut = () => {
    window.localStorage.removeItem("access_token");
    router.replace("/login");
  };

  if (!authorized) {
    return <main className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">Checking authentication…</main>;
  }

  const currentPage = pageTitles[pathname] || pageTitles["/dashboard"];
  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-ink text-white md:flex">
        <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-5 py-5">
          <BrandMark />
          <div><p className="font-bold">Suraksha Setu</p><p className="text-xs text-blue-200">Official workspace</p></div>
        </div>
        <nav aria-label="Official navigation" className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-3">
          {navigation.map((item) => {
            const active = pathname === item.href;
            return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors ${active ? "bg-white/15 font-semibold text-white" : "text-blue-100 hover:bg-white/10 hover:text-white"}`}>
              <NavIcon name={item.icon} className="h-5 w-5" />{item.label}
            </Link>;
          })}
        </nav>
        <div className="shrink-0 border-t border-white/10 px-5 py-4 text-sm text-blue-100">
          <span className={`mr-2 inline-block h-2 w-2 rounded-full ${backend === "connected" ? "bg-emerald-400" : backend === "offline" ? "bg-red-400" : "bg-amber-400"}`} />
          Backend: {backend === "connected" ? "connected" : backend === "offline" ? "offline" : "checking"}
        </div>
      </aside>

      <div className="flex h-dvh min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-30 shrink-0 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex min-w-0 items-center gap-3">
              <BrandMark className="h-10 w-10 shrink-0 md:hidden" />
              <div className="min-w-0"><h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">{currentPage.title}</h1><p className="mt-0.5 truncate text-xs text-slate-500 sm:text-sm">{currentPage.subtitle}</p></div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="hidden text-sm text-slate-600 sm:inline">{user?.name || "Official"}</span>
              <button type="button" onClick={signOut} aria-label="Sign out" title="Sign out" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:px-3 sm:py-2">
                <NavIcon name="logout" className="h-5 w-5 sm:hidden" /><span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        </header>
        <main className="min-h-0 w-full flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">{children}</main>
        <nav aria-label="Official navigation" className="z-40 shrink-0 border-t border-slate-200 bg-white/95 px-2 pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur md:hidden" style={{ paddingBottom: "max(0.65rem, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto flex max-w-lg items-stretch justify-around">
            {mobileNavigation.map((item) => {
              const active = pathname === item.href;
              return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
                className={`flex min-w-[4.25rem] flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-medium transition-colors ${active ? "text-ink" : "text-slate-500 hover:text-slate-800"}`}>
                <span className={`grid h-8 w-12 place-items-center rounded-2xl transition-colors ${active ? "bg-[#e8f1f4]" : "bg-transparent"}`}><NavIcon name={item.icon} className="h-5 w-5" /></span>
                <span>{item.label === "Dashboard" ? "Home" : item.label}</span>
              </Link>;
            })}
            <button type="button" aria-haspopup="dialog" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)}
              className={`flex min-w-[4.25rem] flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-medium transition-colors ${moreNavigation.some((item) => pathname === item.href) ? "text-ink" : "text-slate-500 hover:text-slate-800"}`}>
              <span className={`grid h-8 w-12 place-items-center rounded-2xl ${moreNavigation.some((item) => pathname === item.href) ? "bg-[#e8f1f4]" : "bg-transparent"}`}><NavIcon name="more" className="h-5 w-5" /></span>
              <span>More</span>
            </button>
          </div>
        </nav>
      </div>

      {moreOpen && <div className="fixed inset-0 z-50 md:hidden">
        <button type="button" aria-label="Close more menu" onClick={() => setMoreOpen(false)} className="absolute inset-0 h-full w-full bg-slate-950/40 backdrop-blur-[2px]" />
        <section role="dialog" aria-modal="true" aria-labelledby="more-menu-title" className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-slate-200 bg-white px-5 pt-3 shadow-2xl" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200" />
          <div className="mb-4 flex items-center justify-between"><div><h2 id="more-menu-title" className="text-lg font-bold text-slate-900">More tools</h2><p className="mt-0.5 text-sm text-slate-500">Other response workspace sections</p></div><button type="button" autoFocus onClick={() => setMoreOpen(false)} aria-label="Close menu" className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><NavIcon name="close" /></button></div>
          <div className="grid grid-cols-2 gap-2">
            {moreNavigation.map((item) => {
              const active = pathname === item.href;
              return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} onClick={() => setMoreOpen(false)}
                className={`flex min-h-16 items-center gap-3 rounded-2xl border p-3 transition-colors ${active ? "border-[#bfd3db] bg-[#f0f6f8] text-ink" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-ink"><NavIcon name={item.icon} /></span><span className="text-sm font-semibold leading-tight">{item.label}</span>
              </Link>;
            })}
          </div>
        </section>
      </div>}
    </div>
  );
}
