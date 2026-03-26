import Link from "next/link";
import {
  buildAdminNavSections,
  getAdminNavToneClasses,
  isSeoFocusedUser,
} from "@/app/admin/adminNavigation";
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

export default async function AdminHome() {
  const session = await requireAdminSession();
  const orders = await getOrders();
  const sections = buildAdminNavSections(session.user);
  const seoFocused = isSeoFocusedUser(session.user);
  const outstandingCounts: Record<string, number> = {
    "/admin/orders": orders.filter(isVisibleOnProductionSchedule).length,
    "/admin/orders/additional-items": orders.filter(isVisibleOnPremadeOrders).length,
  };
  const unassignedCustomOrders = sortOrdersForAdminHome(
    orders.filter((order) => isVisibleOnProductionSchedule(order) && order.status === "unassigned"),
  ).slice(0, 6);
  const pendingPremadeOrders = sortOrdersForAdminHome(orders.filter(isVisibleOnPremadeOrders)).slice(0, 6);

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Needs action</p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
              {seoFocused ? "Orders queue" : "Live order queue"}
            </h1>
          </div>
          {seoFocused ? (
            <Link
              href="/admin/settings/pages"
              className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-white"
            >
              Site Pages & SEO
            </Link>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-900">Custom unassigned</p>
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
                  <div
                    key={order.id}
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
                  </div>
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
                <p className="text-sm font-semibold text-zinc-900">Pre-made pending</p>
                <p className="text-2xl font-semibold tracking-tight text-zinc-900">{pendingPremadeOrders.length}</p>
              </div>
              <Link
                href="/admin/orders/additional-items"
                className="inline-flex rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300"
              >
                Open
              </Link>
            </div>
            <div className="mt-4 space-y-2">
              {pendingPremadeOrders.length ? (
                pendingPremadeOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-white px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900">
                        #{order.order_number ?? "?"} {getAdminOrderLabel(order)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-zinc-500">
                      {formatShortDate(order.due_date) ?? "No date"}
                    </span>
                  </div>
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
