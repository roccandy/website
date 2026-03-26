import Link from "next/link";
import { AdminQuickSearch } from "@/app/admin/AdminQuickSearch";
import {
  buildAdminNavSections,
  getAdminNavToneClasses,
  isSeoFocusedUser,
} from "@/app/admin/adminNavigation";
import { requireAdminSession } from "@/lib/adminAuth";
import { getOrders } from "@/lib/data";
import { isVisibleOnPremadeOrders, isVisibleOnProductionSchedule } from "./orders/scheduleVisibility";

export default async function AdminHome() {
  const session = await requireAdminSession();
  const orders = await getOrders();
  const sections = buildAdminNavSections(session.user);
  const seoFocused = isSeoFocusedUser(session.user);
  const outstandingCounts: Record<string, number> = {
    "/admin/orders": orders.filter(isVisibleOnProductionSchedule).length,
    "/admin/orders/additional-items": orders.filter(isVisibleOnPremadeOrders).length,
  };

  return (
    <section className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm lg:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
              {seoFocused ? "SEO Workspace" : "Roc Candy Admin"}
            </h1>
            {seoFocused ? (
              <Link
                href="/admin/settings/pages"
                className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-white"
              >
                Site Pages & SEO
              </Link>
            ) : null}
          </div>
        </div>
        <AdminQuickSearch sections={sections} />
      </div>

      <div className="space-y-4">
        {sections.map((section) => {
          const toneClasses = getAdminNavToneClasses(section.tone);

          return (
            <div key={section.key} className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm lg:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-zinc-900">{section.label}</h2>
                  {seoFocused && section.key !== "content-seo" ? (
                    <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      View only
                    </span>
                  ) : null}
                </div>
                {section.key === "operations" ? (
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${toneClasses.badge}`}>
                    Daily
                  </span>
                ) : section.key === "content-seo" ? (
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${toneClasses.badge}`}>
                    SEO
                  </span>
                ) : (
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${toneClasses.badgeMuted}`}>
                      {section.label}
                    </span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {section.items.map((item) => (
                  <Link
                    key={`${section.key}-${item.href}`}
                    href={item.href}
                    className="inline-flex min-h-12 items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-300 hover:bg-white"
                  >
                    <span>{item.label}</span>
                    {outstandingCounts[item.href] ? (
                      <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold leading-none text-white">
                        {outstandingCounts[item.href]}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
