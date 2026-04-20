import Link from "next/link";
import { AdminActivityFeed } from "@/app/admin/AdminActivityFeed";
import {
  buildAdminNavSections,
  getAdminNavToneClasses,
  isSeoFocusedUser,
} from "@/app/admin/adminNavigation";
import { isNonProductionActivity, listRecentAdminActivity } from "@/lib/adminActivity";
import { requireAdminSession } from "@/lib/adminAuth";
import { getOrders } from "@/lib/data";
import { isVisibleOnPremadeOrders, isVisibleOnProductionSchedule } from "./orders/scheduleVisibility";

function formatShortDate(value: string | null) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  } catch {
    return value;
  }
}

function sortOrdersForAdminHome<T extends { due_date: string | null; created_at: string }>(orders: T[]) {
  return [...orders].sort((a, b) => {
    const aKey = a.due_date ?? "9999-12-31";
    const bKey = b.due_date ?? "9999-12-31";
    if (aKey !== bKey) return aKey.localeCompare(bKey);
    return a.created_at.localeCompare(b.created_at);
  });
}

function getAdminOrderLabel(order: { order_number: string | null; title: string | null; customer_name: string | null }) {
  return order.title?.trim() || order.customer_name?.trim() || `Order ${order.order_number ?? ""}`.trim();
}

function makePremadeGroupKey(order: { order_number: string | null; id: string }) {
  return (order.order_number?.trim() || order.id).replace(/[^a-zA-Z0-9_-]/g, "-");
}

export default async function AdminHome() {
  const session = await requireAdminSession();
  const seoFocused = isSeoFocusedUser(session.user);
  const sections = buildAdminNavSections(session.user);
  const seoSection = sections.find((section) => section.key === "content-seo") ?? null;
  const secondarySections = seoFocused ? sections.filter((section) => section.key !== "content-seo") : sections;
  const orders = seoFocused ? [] : await getOrders();
  const recentActivity =
    session.user.role === "admin"
      ? (await listRecentAdminActivity(200)).filter(isNonProductionActivity).slice(0, 20)
      : [];
  const outstandingCounts: Record<string, number> = {
    "/admin/orders": orders.filter(isVisibleOnProductionSchedule).length,
    "/admin/orders/additional-items": orders.filter(isVisibleOnPremadeOrders).length,
  };
  const unassignedCustomOrders = sortOrdersForAdminHome(
    orders.filter((order) => isVisibleOnProductionSchedule(order) && order.status === "unassigned"),
  ).slice(0, 6);
  const pendingPremadeGroups = Array.from(
    sortOrdersForAdminHome(orders.filter(isVisibleOnPremadeOrders)).reduce(
      (map, order) => {
        const key = makePremadeGroupKey(order);
        if (!map.has(key)) {
          map.set(key, {
            key,
            order,
            count: 1,
          });
        } else {
          const current = map.get(key);
          if (current) current.count += 1;
        }
        return map;
      },
      new Map<string, { key: string; order: (typeof orders)[number]; count: number }>(),
    ).values(),
  ).slice(0, 6);

  return (
    <section className="space-y-6">
      {seoFocused ? (
        <div className="rounded-[2rem] border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-white p-6 shadow-sm lg:p-8">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-600">Editable</p>
            <h1 className="admin-page-title text-zinc-900">Content & SEO</h1>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {seoSection?.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between gap-3 rounded-3xl border border-rose-200 bg-white px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-md"
              >
                <span className="text-base font-semibold text-zinc-900">{item.label}</span>
                <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-700">
                  Edit
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm lg:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Needs action</p>
              <h1 className="admin-page-title text-zinc-900">Unassigned orders</h1>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-900">Custom</p>
                  <p className="text-2xl font-semibold tracking-tight text-zinc-900">{unassignedCustomOrders.length}</p>
                </div>
                <Link
                  href="/admin/orders"
                  className="inline-flex rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:border-amber-300"
                >
                  Open
                </Link>
              </div>
              <div className="mt-4 space-y-2">
                {unassignedCustomOrders.length ? (
                  unassignedCustomOrders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/admin/orders?selected=${encodeURIComponent(order.id)}#order-${order.id}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-amber-100 bg-white px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-900">
                          #{order.order_number ?? "?"} {getAdminOrderLabel(order)}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-zinc-500">
                        {formatShortDate(order.due_date) ?? "No date"}
                      </span>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-amber-200 bg-white px-3 py-4 text-sm text-zinc-500">
                    No custom orders waiting.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-900">Pre-made</p>
                  <p className="text-2xl font-semibold tracking-tight text-zinc-900">{pendingPremadeGroups.length}</p>
                </div>
                <Link
                  href="/admin/orders/additional-items"
                  className="inline-flex rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300"
                >
                  Open
                </Link>
              </div>
              <div className="mt-4 space-y-2">
                {pendingPremadeGroups.length ? (
                  pendingPremadeGroups.map(({ key, order, count }) => (
                    <Link
                      key={key}
                      href={`/admin/orders/additional-items?focus=${encodeURIComponent(key)}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-white px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-900">
                          #{order.order_number ?? "?"} {getAdminOrderLabel(order)}
                        </p>
                        {count > 1 ? <p className="text-xs text-zinc-500">{count} items</p> : null}
                      </div>
                      <span className="shrink-0 text-xs font-medium text-zinc-500">
                        {formatShortDate(order.due_date) ?? "No date"}
                      </span>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-rose-200 bg-white px-3 py-4 text-sm text-zinc-500">
                    No pre-made orders waiting.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {secondarySections.map((section) => {
          const toneClasses = getAdminNavToneClasses(section.tone);
          const isSecondarySeoView = seoFocused && section.key !== "content-seo";

          return (
            <div
              key={section.key}
              className={`rounded-[2rem] border p-5 shadow-sm lg:p-6 ${
                isSecondarySeoView ? "border-zinc-200 bg-zinc-50/80 opacity-75" : "border-zinc-200 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="admin-card-title text-zinc-900">{section.label}</h2>
                  {isSecondarySeoView ? (
                    <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      View only
                    </span>
                  ) : null}
                </div>
                {!seoFocused && section.key === "operations" ? (
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${toneClasses.badge}`}>
                    Daily
                  </span>
                ) : !seoFocused && section.key === "content-seo" ? (
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
                    className={`inline-flex min-h-12 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      isSecondarySeoView
                        ? "border-zinc-200 bg-white/80 text-zinc-600 hover:border-zinc-300 hover:bg-white"
                        : "border-zinc-200 bg-zinc-50 text-zinc-800 hover:border-zinc-300 hover:bg-white"
                    }`}
                  >
                    <span>{item.label}</span>
                    {!seoFocused && outstandingCounts[item.href] ? (
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

      {session.user.role === "admin" ? (
        <div className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm lg:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Subtle internal log</p>
              <h2 className="admin-card-title text-zinc-900">Recent changes</h2>
            </div>
            <Link
              href="/admin/activity"
              className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-white"
            >
              Full log
            </Link>
          </div>
          <details className="group mt-4 rounded-3xl border border-zinc-200 bg-zinc-50/70">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden">
              <div className="space-y-1">
                <p className="text-sm font-medium text-zinc-900">Show recent changes</p>
                <p className="text-xs text-zinc-500">Displays the latest 20 non-production backend edits with user and time.</p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-zinc-500 transition group-open:rotate-180">▾</span>
            </summary>
            <div className="border-t border-zinc-200 px-4 py-4">
              <AdminActivityFeed entries={recentActivity} compact />
            </div>
          </details>
        </div>
      ) : null}
    </section>
  );
}
