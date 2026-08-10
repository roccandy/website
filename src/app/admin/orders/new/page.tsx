import {
  getCategories,
  getColorPalette,
  getFlavors,
  getOrderSlots,
  getPackagingOptions,
  getPremadeCandies,
  getProductionSlots,
  getSettings,
  getOrders,
} from "@/lib/data";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { resolveAdminOrderRemakeSource } from "@/lib/adminOrderRemake";
import { NewOrderForm } from "./NewOrderForm";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type SearchParams = {
  toast?: string;
  message?: string;
  remake?: string | string[];
};

export default async function NewOrderPage({ searchParams }: { searchParams?: SearchParams | Promise<SearchParams> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");
  const resolvedSearchParams = await Promise.resolve(searchParams);

  const [categories, packagingOptions, flavors, palette, premadeCandies, settings, orders, slots, assignments] = await Promise.all([
    getCategories(),
    getPackagingOptions(),
    getFlavors(),
    getColorPalette(),
    getPremadeCandies(),
    getSettings(),
    getOrders(),
    getProductionSlots(),
    getOrderSlots(),
  ]);
  const remakeRequested = Boolean(
    (Array.isArray(resolvedSearchParams?.remake) ? resolvedSearchParams?.remake[0] : resolvedSearchParams?.remake)?.trim(),
  );
  const remakeOrder = resolveAdminOrderRemakeSource(orders, resolvedSearchParams?.remake);
  if (remakeRequested && !remakeOrder) notFound();
  const toastTone = resolvedSearchParams?.toast === "error" ? "error" : resolvedSearchParams?.toast === "success" ? "success" : null;
  const toastMessage = resolvedSearchParams?.message ?? null;
  const remakeOrderLabel = remakeOrder?.order_number ? `#${remakeOrder.order_number}` : remakeOrder ? `#${remakeOrder.id.slice(0, 8)}` : null;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Production</p>
          <h2 className="admin-page-title">{remakeOrder ? "Re-make order" : "Create order"}</h2>
        </div>
        <Link
          href="/admin/orders"
          className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
        >
          Back to schedule
        </Link>
      </div>

      {remakeOrder ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <p className="font-semibold">Prefilled from order {remakeOrderLabel}</p>
          <p className="mt-1">
            Edit anything needed below. Sending the invoice will create a new order and leave the original unchanged.
          </p>
        </div>
      ) : null}

      {toastTone && toastMessage ? (
        <p
          className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
            toastTone === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {toastMessage}
        </p>
      ) : null}

      <NewOrderForm
        categories={categories}
        packagingOptions={packagingOptions}
        flavors={flavors}
        palette={palette}
        premadeCandies={premadeCandies}
        settings={settings}
        orders={orders}
        slots={slots}
        assignments={assignments}
        mode="create"
        initialOrder={remakeOrder}
        cancelHref={remakeOrder ? `/admin/orders/${encodeURIComponent(remakeOrder.id)}` : "/admin/orders"}
      />
    </section>
  );
}
