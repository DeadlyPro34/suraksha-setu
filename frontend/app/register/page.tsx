"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { homeForRole } from "@/lib/auth";
import { saveAccessToken, signupUser } from "@/lib/api";
import { User } from "@/lib/types";


export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<User["role"]>("citizen");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await signupUser({
        name: name.trim(),
        phone: phone.trim(),
        password,
        role,
        ...(role === "citizen" ? {} : { invite_code: inviteCode }),
      });
      saveAccessToken(result.access_token);
      router.replace(homeForRole(result.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg border border-slate-200">
        <div className="text-center mb-7">
          <div className="text-4xl mb-2">🛡️</div>
          <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
          <p className="mt-2 text-sm text-slate-500">Register for Suraksha Setu</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input id="name" required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl" autoComplete="name" />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <input id="phone" type="tel" required minLength={3} maxLength={32} value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl" autoComplete="tel" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input id="password" type="password" required minLength={8} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl" autoComplete="new-password" />
            <p className="mt-1 text-xs text-slate-500">Use at least 8 characters.</p>
          </div>
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-slate-700 mb-1">Account role</label>
            <select id="role" value={role} onChange={(event) => setRole(event.target.value as User["role"])} className="w-full px-4 py-3 border border-slate-200 rounded-xl">
              <option value="citizen">Citizen</option>
              <option value="volunteer">Volunteer</option>
              <option value="field_officer">Field officer</option>
              <option value="official">Official</option>
            </select>
          </div>
          {role !== "citizen" && (
            <div>
              <label htmlFor="invite" className="block text-sm font-medium text-slate-700 mb-1">Role invite code</label>
              <input id="invite" type="password" required value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl" autoComplete="off" />
              <p className="mt-1 text-xs text-slate-500">Privileged roles require the private signup code configured by the administrator.</p>
            </div>
          )}

          {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-3 gradient-primary text-white font-semibold rounded-xl disabled:opacity-50">
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          Already registered? <Link className="text-blue-600 font-medium hover:underline" href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
