"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { homeForRole } from "@/lib/auth";
import { loginUser, saveAccessToken } from "@/lib/api";
import { BrandMark, Waves } from "@/components/Brand";

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

  const field = "w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none";

  return (
    <main className="min-h-screen flex flex-col lg:flex-row">
      <section className="gradient-primary text-white lg:w-[46%] flex flex-col justify-between">
        <div className="p-6 lg:p-12">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <BrandMark />
            <span className="font-display text-lg font-bold">Suraksha Setu</span>
          </Link>
          <h1 className="font-display text-3xl lg:text-5xl font-extrabold leading-[1.08] mt-8 lg:mt-24 max-w-md">
            Coordinate the response. Keep people safe.
          </h1>
          <p className="mt-4 text-blue-100 max-w-sm">
            For officials, field teams and volunteers managing floods, shelters and supplies.
          </p>
        </div>
        <Waves fill="#FFFFFF" className="hidden lg:block" />
      </section>

      <section className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white">
        <div className="w-full max-w-sm animate-fade-in">
          <h2 className="font-display text-2xl font-bold text-slate-900">Sign in</h2>
          <p className="text-slate-600 mt-1 mb-7">Use the phone number you registered with.</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="phone" className="block text-sm font-semibold text-slate-800 mb-1.5">Phone number</label>
              <input id="phone" type="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 98765 43210" className={field} />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-800 mb-1.5">Password</label>
              <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
            </div>

            {error && <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

            <button type="submit" disabled={loading} className="w-full py-3 bg-ink text-white font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-50">
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-600">
            New here? <Link className="text-blue-700 font-semibold hover:underline" href="/register">Create an account</Link>
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Just need help? <Link className="text-blue-700 font-semibold hover:underline" href="/">Go to the public page</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
