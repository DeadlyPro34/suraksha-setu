"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"citizen" | "official">("citizen");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulated login — no real auth yet
    setTimeout(() => {
      setLoading(false);
      if (role === "official") {
        router.push("/dashboard");
      } else {
        router.push("/");
      }
    }, 800);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary flex-col justify-center items-center text-white p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-white/5 rounded-full" />
        <div className="absolute top-1/3 right-12 w-48 h-48 bg-white/5 rounded-full" />

        <div className="relative z-10 text-center max-w-md">
          <div className="text-6xl mb-6">🛡️</div>
          <h1 className="text-4xl font-extrabold mb-4 tracking-tight">Suraksha Setu</h1>
          <p className="text-lg text-blue-100 leading-relaxed">
            AI-Powered Disaster Response System
          </p>
          <p className="mt-4 text-sm text-blue-200/80">
            Real-time flood analysis • Shelter management • Emergency coordination
          </p>

          <div className="mt-12 flex gap-8 justify-center text-center">
            <div>
              <div className="text-3xl font-bold">5</div>
              <div className="text-xs text-blue-200 mt-1">AI Agents</div>
            </div>
            <div>
              <div className="text-3xl font-bold">24/7</div>
              <div className="text-xs text-blue-200 mt-1">Monitoring</div>
            </div>
            <div>
              <div className="text-3xl font-bold">&lt;30s</div>
              <div className="text-xs text-blue-200 mt-1">Response</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile branding */}
          <div className="lg:hidden text-center mb-8">
            <div className="text-4xl mb-2">🛡️</div>
            <h1 className="text-2xl font-bold text-slate-900">Suraksha Setu</h1>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome back</h2>
          <p className="text-slate-500 mb-8">Sign in to your account to continue</p>

          {/* Role toggle */}
          <div className="flex bg-slate-100 rounded-xl p-1 mb-8">
            <button
              type="button"
              onClick={() => setRole("citizen")}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                role === "citizen"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              🏠 Citizen
            </button>
            <button
              type="button"
              onClick={() => setRole("official")}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                role === "official"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              🏛️ Official
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Phone / Email
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter phone number or email"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 gradient-primary text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-all duration-200 shadow-lg shadow-blue-500/25"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <span className="text-blue-600 font-medium cursor-pointer hover:underline">
              Register
            </span>
          </p>

          <div className="mt-8 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs text-amber-700 text-center">
              🔒 JWT-based Authentication • Role-Based Access Control
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
