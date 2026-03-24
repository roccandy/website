import { getCategories, getWeightTiers, getSettings } from "@/lib/data";
import { PricingTable } from "./PricingTable";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function PricingPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/admin/login");
  }

  const [categories, tiers, settings] = await Promise.all([getCategories(), getWeightTiers(), getSettings()]);
  const pricingTableKey = JSON.stringify(
    tiers.map((tier) => [tier.id, tier.category_id, tier.min_kg, tier.max_kg, tier.price, tier.per_kg, tier.notes ?? ""])
  );

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Pricing</p>
        <h2 className="text-3xl font-semibold">Weight-based pricing</h2>
        <p className="text-sm text-zinc-600">
          Edit tiers by category. For Per kg rows, the price is added on top of the prior flat tier
          for each kg above that tier min (e.g., $295 base + 2 x $50 for 5 kg).
        </p>
        <p className="text-xs text-zinc-500">
          Tip: enter min/max kg ranges that do not overlap; keep one flat base row first, then any
          per-kg rows.
        </p>
      </div>

      <PricingTable
        key={pricingTableKey}
        categories={categories}
        tiers={tiers}
        maxTotalKg={settings.max_total_kg}
      />
    </section>
  );
}
