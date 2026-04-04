import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Setup Guide | Roc Candy Docs",
};

export default function SetupGuide() {
  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <div className="mx-auto max-w-3xl px-6 py-16 space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Setup</p>
          <h1 className="admin-page-title">Project setup checklist</h1>
          <p className="text-sm text-zinc-600">
            The current Roc Candy stack uses Next.js, Supabase, custom admin auth, and connected
            payment providers. Use this as the high-level setup reference rather than the older
            starter-app notes.
          </p>
        </div>
        <ol className="space-y-3 text-sm text-zinc-700">
          <li>1) Populate `.env.local` / production env vars for Supabase, NextAuth, payments, email, analytics, and Woo.</li>
          <li>2) Keep the live Supabase schema aligned with the SQL files in `docs/sql/` and verify it with the schema health check.</li>
          <li>3) Use the custom admin login backed by `admin_users`; do not assume Supabase Auth is the active website admin flow.</li>
          <li>4) Treat <code>docs/launch-checklist.md</code> as the real launch document and <code>docs/seo-recommendations-checklist.md</code> as the SEO gap tracker.</li>
          <li>5) Validate payments, Woo order mirroring, emails, redirects, and GA4/Ads/Search Console before cutover.</li>
          <li>6) Launch only after the real domain, production env vars, and redirect map are all ready.</li>
        </ol>
      </div>
    </main>
  );
}
