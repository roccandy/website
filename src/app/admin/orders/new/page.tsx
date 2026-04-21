import {
  getCategories,
  getColorPalette,
  getFlavors,
  getOrderSlots,
  getPackagingOptions,
  getPremadeCandies,
  getProductionBlocks,
  getProductionSlots,
  getSettings,
  getOrders,
} from "@/lib/data";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { NewOrderForm } from "./NewOrderForm";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function NewOrderPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");

  const [categories, packagingOptions, flavors, palette, premadeCandies, settings, orders, slots, assignments, blocks] = await Promise.all([
    getCategories(),
    getPackagingOptions(),
    getFlavors(),
    getColorPalette(),
    getPremadeCandies(),
    getSettings(),
    getOrders(),
    getProductionSlots(),
    getOrderSlots(),
    getProductionBlocks(),
  ]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Production</p>
          <h2 className="admin-page-title">Create order</h2>
          <p className="text-sm text-zinc-600">Add an order manually for email or phone requests.</p>
        </div>
        <Link
          href="/admin/orders"
          className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
        >
          Back to schedule
        </Link>
      </div>

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
        blocks={blocks}
      />
    </section>
  );
}
