"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { getCurrentUser } from "@/lib/api";
import { homeForRole } from "@/lib/auth";

export default function CitizenLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((user) => {
        if (!active) return;
        if (user.role !== "citizen") {
          router.replace(homeForRole(user.role));
          return;
        }
        setAuthorized(true);
      })
      .catch(() => {
        if (!active) return;
        window.localStorage.removeItem("access_token");
        router.replace("/login");
      });

    return () => {
      active = false;
    };
  }, [router]);

  if (!authorized) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
        Checking authentication…
      </main>
    );
  }

  return children;
}
