"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginForm() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    const data = new FormData(e.currentTarget);
    const email = data.get("email");
    const password = data.get("password");
    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl: "/admin",
    });
    setLoading(false);
    if (!res || res.error) {
      setFormError("Incorrect email or password.");
      return;
    }
    if (res.url) {
      window.location.href = res.url;
    }
  };

  const hasError = formError || errorParam;

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <div className="mx-auto max-w-md px-6 py-16 space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin</p>
          <h1 className="admin-page-title">Sign in</h1>
          <p className="text-sm text-zinc-600">
            Enter the admin email and password to access pricing, packaging, labels, and settings.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <label className="block text-sm font-medium text-zinc-700">
            Email
            <input
              type="email"
              name="email"
              className="mt-2 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              placeholder="admin@example.com"
              required
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700">
            Password
            <input
              type="password"
              name="password"
              className="mt-2 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              placeholder="Admin password"
              required
            />
          </label>
          {hasError && (
            <p className="text-sm text-red-600">{formError ?? "Incorrect email or password."}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
