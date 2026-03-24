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
          <h1 className="text-4xl font-semibold tracking-tight">Project wiring checklist</h1>
          <p className="text-sm text-zinc-600">
            Add your environment keys, prepare Supabase tables, and scaffold admin auth before
            building features.
          </p>
        </div>
        <ol className="space-y-3 text-sm text-zinc-700">
          <li>1) Duplicate `.env.local.example` to `.env.local` and fill Supabase URL/keys.</li>
          <li>2) In Supabase, create tables: products, pricing_rules, orders, production_slots, and user_roles.</li>
          <li>3) Enable Row Level Security; allow public read on products/pricing_rules, lock writes to admins.</li>
          <li>4) Add an auth provider (Clerk or NextAuth magic links) and restrict `/admin` routes to admins.</li>
          <li>5) Build the pricing editor, orders list, and production schedule views on top of Supabase.</li>
          <li>6) Deploy to Vercel, add env vars, and point your domain.</li>
        </ol>
      </div>
    </main>
  );
}
