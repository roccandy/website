import {
  getCategories,
  getColorPalette,
  getFlavors,
  getOrders,
  getOrderSlots,
  getProductionBlocks,
  getProductionSlots,
  getQuoteBlocks,
} from "@/lib/data";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminActivityFeed } from "@/app/admin/AdminActivityFeed";
import { OrdersTable } from "./OrdersTable";
import { FrontEndCalendarButton } from "./FrontEndCalendarButton";
import { buildCustomPricingInput, buildPricingContext, calculatePricingWithContext } from "@/lib/pricing";
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

  const [orders, slots, assignments, blocks, pricingContext, flavors, palette, categories, quoteBlocks, activityLog] =
    await Promise.all([
      getOrders(),
      getProductionSlots(),
      getOrderSlots(),
      getProductionBlocks(),
      buildPricingContext(),
      getFlavors(),
      getColorPalette(),
      getCategories(),
      getQuoteBlocks(),
      listRecentAdminActivity(200),
    ]);
  const productionActivity = activityLog.filter(isProductionActivity).slice(0, 20);
  const pricingByOrderId: Record<string, ReturnType<typeof calculatePricingWithContext> | null> = {};
  orders.forEach((order) => {
    if (order.design_type === "premade") {
      pricingByOrderId[order.id] = null;
      return;
    }
    const pricingInput = buildCustomPricingInput({
      categoryId: order.category_id,
      packagingOptionId: order.packaging_option_id,
      quantity: order.quantity,
      labelsCount: order.labels_count ?? undefined,
      ingredientLabelsCount: order.ingredient_labels_count ?? undefined,
      notes: order.notes,
      dueDate: order.due_date ?? undefined,
      jacket: order.jacket,
    });
    if (!pricingInput) {
      pricingByOrderId[order.id] = null;
      return;
    }
    try {
      pricingByOrderId[order.id] = calculatePricingWithContext(pricingInput, pricingContext);
    } catch {
      pricingByOrderId[order.id] = null;
    }
  });
  return (
    <section className="space-y-6">
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
          <FrontEndCalendarButton blocks={quoteBlocks} />
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
        blocks={blocks}
        settings={pricingContext.settings}
        packagingOptions={pricingContext.packagingOptions}
        categories={categories}
        pricingBreakdowns={pricingByOrderId}
        flavors={flavors}
        palette={palette}
        initialSelectedId={selectedOrderId}
      />

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Production log</p>
            <h3 className="admin-card-title text-zinc-900">Recent production changes</h3>
          </div>
        </div>
        <div className="mt-4">
          <AdminActivityFeed entries={productionActivity} compact />
        </div>
      </section>
    </section>
  );
}
