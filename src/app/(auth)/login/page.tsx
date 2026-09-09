"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("That email and password don't match an account.");
      return;
    }
    router.push(params.get("callbackUrl") || "/dashboard");
    router.refresh();
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-navy">Welcome back</h2>
      <p className="mt-1 text-sm text-navy/60">Sign in to continue preparing.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-navy/80">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-surface-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-blue/40"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-navy/80">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-surface-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-blue/40"
            placeholder="••••••••"
          />
        </div>
        {error && <p className="text-sm text-brand-danger">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-blue py-2.5 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Continue with Email"}
        </button>
      </form>

      <div className="mt-6 flex items-center gap-3 text-xs text-navy/40">
        <div className="h-px flex-1 bg-surface-border" />
        or
        <div className="h-px flex-1 bg-surface-border" />
      </div>

      <button
        disabled
        title="Configure a Google OAuth provider to enable this"
        className="mt-6 w-full rounded-lg border border-surface-border py-2.5 text-sm font-medium text-navy/50 cursor-not-allowed"
      >
        Continue with Google
      </button>

      <p className="mt-8 text-center text-sm text-navy/60">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-brand-blue hover:underline">
          Create Account
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-navy/40">
        <Link href="#" className="hover:underline">
          Forgot Password
        </Link>{" "}
        &middot;{" "}
        <Link href="#" className="hover:underline">
          Privacy Policy
        </Link>{" "}
        &middot; <Link href="#" className="hover:underline">Terms</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
