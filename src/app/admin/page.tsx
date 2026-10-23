import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { AdminLink } from "./AdminNavigationFeedback";
import { AdminActivityFeed } from "./AdminActivityFeed";
import { buildAdminNavSections, isSeoFocusedUser } from "./adminNavigation";
import { requireAdminSession } from "@/lib/adminAuth";
import { listRecentAdminActivity } from "@/lib/adminActivity";
import { getTodayHub } from "./today/todayData";
import { TodayHub } from "./today/TodayHub";

export const metadata: Metadata = { title: "Today | Roc Candy Admin" };
export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const session = await requireAdminSession();
  if (session.user.role === "production") redirect("/admin/production");
  if (isSeoFocusedUser(session.user)) {
    const content = buildAdminNavSections(session.user).find(
      (section) => section.key === "content-seo",
    );
    return (
      <section className="space-y-6">
        <header>
          <p className="text-xs font-medium text-emerald-700">
            Roc Candy · website workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Make the website shine.
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Your content and publishing tools, all in one place.
          </p>
        </header>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {content?.items.map((item) => (
            <AdminLink
              key={item.href}
              href={item.href}
              className="flex min-w-0 items-start justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-6 hover:border-emerald-400"
            >
              <span>
                <span className="block text-base font-semibold text-zinc-900">
                  {item.label}
                </span>
                <span className="mt-2 block text-sm leading-6 text-zinc-500">
                  {item.description}
                </span>
              </span>
              <ArrowUpRight size={18} className="shrink-0 text-emerald-700" />
            </AdminLink>
          ))}
        </div>
      </section>
    );
  }

  const [data, activity] = await Promise.all([
    getTodayHub(),
    session.user.role === "admin"
      ? listRecentAdminActivity(12)
          .then((entries) => ({ entries, unavailable: false }))
          .catch(() => ({ entries: [], unavailable: true }))
      : Promise.resolve(null),
  ]);
  const name = session.user.name?.trim().split(/\s+/)[0] || "";
  return (
    <div className="space-y-6">
      <TodayHub data={data} name={name} canWrite={session.user.canWrite} />
      {activity && (
        <details className="rounded-2xl border border-zinc-200 bg-white">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-zinc-700">
            Recent team activity{" "}
            <span className="ml-2 text-xs font-normal text-zinc-400">
              Who changed what, and when
            </span>
          </summary>
          <div className="border-t border-zinc-100 p-5">
            {activity.unavailable ? (
              <p className="text-sm text-zinc-500">
                The activity feed is temporarily unavailable. Your work queue is
                still available above.
              </p>
            ) : (
              <AdminActivityFeed entries={activity.entries} compact />
            )}
            <AdminLink
              href="/admin/activity"
              className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-emerald-800"
            >
              Open full activity log <ArrowUpRight size={13} />
            </AdminLink>
          </div>
        </details>
      )}
    </div>
  );
}
