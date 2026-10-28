import { getProductionWorkspaceData } from "../adminWorkspaceData";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminActivityFeed } from "@/app/admin/AdminActivityFeed";
import { OrdersTable } from "./OrdersTable";
import { isProductionActivity } from "@/lib/adminActivity";

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

  const { orders, slots, assignments, dayNotes, pricingContext, categories, activityLog } = await getProductionWorkspaceData();
  const productionActivity = activityLog.filter(isProductionActivity).slice(0, 20);
  return (
    <section className="admin-production-schedule space-y-6">
      <OrdersTable
        orders={orders}
        slots={slots}
        assignments={assignments}
        settings={pricingContext.settings}
        packagingOptions={pricingContext.packagingOptions}
        categories={categories}
        dayNotes={dayNotes}
        initialSelectedId={selectedOrderId}
        canWrite={session.user.canWrite}
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
