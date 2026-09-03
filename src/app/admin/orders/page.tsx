import {
  getCategories,
  getOrders,
  getOrderSlots,
  getProductionDayNotes,
  getProductionSlots,
} from "@/lib/data";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminActivityFeed } from "@/app/admin/AdminActivityFeed";
import { OrdersTable } from "./OrdersTable";
import { buildPricingContext } from "@/lib/pricing";
import { isProductionActivity, listRecentAdminActivity } from "@/lib/adminActivity";

export const metadata = {
  title: "Production Schedule | Roc Candy Admin",
};

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type SearchParams = { selected?: string };

export default async function OrdersPage({ searchParams }: { searchParams?: SearchParams | Promise<SearchParams> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const selectedOrderId = resolvedSearchParams?.selected?.trim() || null;

  const [orders, slots, assignments, dayNotes, pricingContext, categories, activityLog] = await Promise.all([
    getOrders(),
    getProductionSlots(),
    getOrderSlots(),
    getProductionDayNotes(),
    buildPricingContext({ includeInactivePackaging: true }),
    getCategories(),
    listRecentAdminActivity(200),
  ]);
  const productionActivity = activityLog.filter(isProductionActivity).slice(0, 20);
  return (
    <section className="admin-production-schedule space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Production</p>
          <h2 className="admin-page-title">Production Schedule</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/orders/new"
            className="rounded border border-zinc-900 bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
          >
            Create order
          </Link>
          <Link
            href="/admin/settings/production"
            className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
          >
            Production settings
          </Link>
        </div>
      </div>

      <OrdersTable
        orders={orders}
        slots={slots}
        assignments={assignments}
        settings={pricingContext.settings}
        packagingOptions={pricingContext.packagingOptions}
        categories={categories}
        dayNotes={dayNotes}
        initialSelectedId={selectedOrderId}
      />

      <details className="group rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 marker:hidden">
          <span className="space-y-1">
            <span className="block text-xs uppercase tracking-[0.2em] text-zinc-500">Production log</span>
            <span className="admin-card-title block text-zinc-900">Recent production changes</span>
          </span>
          <span className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 group-open:hidden">Show log</span>
          <span className="hidden rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 group-open:inline-flex">Hide log</span>
        </summary>
        <div className="border-t border-zinc-100 px-4 pb-4 pt-0">
          <AdminActivityFeed entries={productionActivity} compact />
        </div>
      </details>
    </section>
  );
}
