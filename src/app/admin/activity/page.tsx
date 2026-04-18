import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminActivityFeed } from "@/app/admin/AdminActivityFeed";
import { requireAdminSession } from "@/lib/adminAuth";
import { listRecentAdminActivity } from "@/lib/adminActivity";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function AdminActivityPage() {
  const session = await requireAdminSession();
  if (session.user.role !== "admin") {
    redirect("/admin");
  }

  const entries = await listRecentAdminActivity(100);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Activity</p>
          <h1 className="admin-page-title text-zinc-900">Change log</h1>
          <p className="text-sm text-zinc-600">Recent backend changes made by signed-in admin users.</p>
        </div>
        <Link
          href="/admin"
          className="inline-flex rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
        >
          Back to dashboard
        </Link>
      </div>

      <AdminActivityFeed entries={entries} />
    </section>
  );
}
