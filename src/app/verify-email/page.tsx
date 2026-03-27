"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Registration failed" }));
      setError(data.error ?? "Registration failed");
      setBusy(false);
      return;
    }

    router.push("/sign-in");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f0f12] p-6 text-[#f2f2f2]">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#17171c] p-6">
        <h1 className="mb-1 text-2xl font-semibold">Create account</h1>
        <p className="mb-6 text-sm text-white/60">Get started with free credits</p>

        <label className="mb-2 block text-sm">Full name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="mb-4 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 outline-none" required />

        <label className="mb-2 block text-sm">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mb-4 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 outline-none" required />

        <label className="mb-2 block text-sm">Password</label>
        <input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mb-4 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 outline-none" required />

        {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

        <button type="submit" disabled={busy} className="w-full rounded-lg bg-[#4a3dff] px-4 py-2 font-medium text-white disabled:opacity-50">
          {busy ? "Creating..." : "Create account"}
        </button>
      </form>
    </main>
  );
}
