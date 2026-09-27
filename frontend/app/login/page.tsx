"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { homeForRole } from "@/lib/auth";
import { loginUser, saveAccessToken } from "@/lib/api";


export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await loginUser(phone.trim(), password);
      saveAccessToken(result.access_token);
      router.replace(homeForRole(result.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex">
      <section className="hidden lg:flex lg:w-1/2 gradient-primary flex-col justify-center items-center text-white p-12">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🛡️</div>
          <h1 className="text-4xl font-extrabold mb-4 tracking-tight">Suraksha Setu</h1>
          <p className="text-lg text-blue-100">AI-Powered Disaster Response System</p>
          <p className="mt-4 text-sm text-blue-200/80">
            Real-time flood analysis • Shelter management • Emergency coordination
          </p>
        </div>
      </section>

      <section className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="text-4xl mb-2">🛡️</div>
            <h1 className="text-2xl font-bold text-slate-900">Suraksha Setu</h1>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome back</h2>
          <p className="text-slate-500 mb-8">Sign in to continue</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Enter phone number"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 gradient-primary text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don&apos;t have an account? <Link className="text-blue-600 font-medium hover:underline" href="/register">Register</Link>
          </p>
          <div className="mt-8 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs text-amber-700 text-center">🔒 JWT authentication • Role-based access</p>
          </div>
        </div>
      </section>
    </main>
  );
}
