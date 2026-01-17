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
import { OrdersTable } from "./OrdersTable";
import { FrontEndCalendarButton } from "./FrontEndCalendarButton";
import { buildPricingContext, calculatePricingWithContext } from "@/lib/pricing";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type SearchParams = { toast?: string; message?: string };
type ToastTone = "success" | "error";

export default async function OrdersPage({ searchParams }: { searchParams?: SearchParams | Promise<SearchParams> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const toastTone = resolvedSearchParams?.toast;
  const toastMessage = resolvedSearchParams?.message;
  const tone: ToastTone | null = toastTone === "success" || toastTone === "error" ? toastTone : null;
  const toast = tone && toastMessage ? { tone, message: toastMessage } : null;

  const [orders, slots, assignments, blocks, pricingContext, flavors, palette, categories, quoteBlocks] =
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
  ]);
  const pricingByOrderId: Record<string, ReturnType<typeof calculatePricingWithContext> | null> = {};
  const buildExtras = (jacket: string | null) => {
    if (!jacket) return [];
    if (jacket === "two_colour_pinstripe") return [{ jacket: "two_colour" as const }, { jacket: "pinstripe" as const }];
    if (jacket === "two_colour") return [{ jacket: "two_colour" as const }];
    if (jacket === "pinstripe") return [{ jacket: "pinstripe" as const }];
    if (jacket === "rainbow") return [{ jacket: "rainbow" as const }];
    return [];
  };
  orders.forEach((order) => {
    if (order.design_type === "premade") {
      pricingByOrderId[order.id] = null;
      return;
    }
    const quantity = Number(order.quantity);
    if (!order.category_id || !order.packaging_option_id || !Number.isFinite(quantity) || quantity <= 0) {
      pricingByOrderId[order.id] = null;
      return;
    }
    try {
      pricingByOrderId[order.id] = calculatePricingWithContext(
        {
          categoryId: order.category_id,
          packaging: [{ optionId: order.packaging_option_id, quantity }],
          labelsCount: order.labels_count ?? undefined,
          dueDate: order.due_date ?? undefined,
          extras: buildExtras(order.jacket),
        },
        pricingContext
      );
    } catch {
      pricingByOrderId[order.id] = null;
    }
  });
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Production</p>
          <h2 className="text-3xl font-semibold">Production schedule</h2>
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
        toast={toast}
      />
    </section>
  );
}
