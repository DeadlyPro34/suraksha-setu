"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { homeForRole } from "@/lib/auth";
import { saveAccessToken, signupUser } from "@/lib/api";
import { User } from "@/lib/types";
import { BrandMark, Waves } from "@/components/Brand";

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
    if (name.trim().length < 2) {
      setError("Enter your name using at least 2 characters.");
      return;
    }
    if (!/^\d{10}$/.test(phone)) {
      setError("Enter a 10-digit Indian mobile number without +91.");
      return;
    }
    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }
    if (role !== "citizen" && !inviteCode.trim()) {
      setError("Enter the invite code for this account role.");
      return;
    }
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

      <section className="flex-1 flex items-center justify-center p-6 lg:p-12 py-10 bg-white">
        <div className="w-full max-w-sm animate-fade-in my-auto">
          <h2 className="font-display text-2xl font-bold text-slate-900">Create account</h2>
          <p className="text-slate-600 mt-1 mb-7">Join Suraksha Setu to coordinate or request assistance.</p>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-slate-800 mb-1.5">
                Full name
              </label>
              <input
                id="name"
                type="text"
                required
                minLength={2}
                maxLength={200}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Rahul Sharma"
                className={field}
                autoComplete="name"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-semibold text-slate-800 mb-1.5">
                Phone number
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                required
                minLength={10}
                maxLength={10}
                pattern="[0-9]{10}"
                title="Enter exactly 10 digits without +91."
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="e.g. 9876543210"
                className={field}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-800 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                className={field}
              />
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-semibold text-slate-800 mb-1.5">
                Account role
              </label>
              <select
                id="role"
                value={role}
                onChange={(event) => setRole(event.target.value as User["role"])}
                className={`${field} cursor-pointer`}
              >
                <option value="citizen">Citizen</option>
                <option value="volunteer">Volunteer</option>
                <option value="field_officer">Field officer</option>
                <option value="official">Official</option>
              </select>
            </div>

            {role !== "citizen" && (
              <div>
                <label htmlFor="invite" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Role invite code
                </label>
                <input
                  id="invite"
                  type="password"
                  required
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value)}
                  placeholder="Enter administrator invite code"
                  className={field}
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Volunteer, field officer, and official accounts require an invite code.
                </p>
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-ink text-white font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-600">
            Already have an account?{" "}
            <Link className="text-blue-700 font-semibold hover:underline" href="/login">
              Sign in
            </Link>
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Just need help?{" "}
            <Link className="text-blue-700 font-semibold hover:underline" href="/public">
              Go to the public page
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
