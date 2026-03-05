import {
  getCategories,
  getLabelRanges,
  getLabelTypes,
  getColorPalette,
  getFlavors,
  getPackagingOptionImages,
  getPackagingOptions,
  getSettings,
  getWeightTiers,
  type Category,
  type WeightTier,
} from "@/lib/data";
import HeaderNav from "@/components/HeaderNav";
import HeaderMenu from "@/components/HeaderMenu";
import LandingTopLinksBar from "@/components/LandingTopLinksBar";
import { QuoteBuilder } from "@/app/quote/QuoteBuilder";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type QuotePageProps = {
  searchParams?: { type?: string } | Promise<{ type?: string }>;
};

function buildMinBasePrices(categories: Category[], tiers: WeightTier[]) {
  const result: Record<string, number> = {};

  for (const category of categories) {
    const categoryTiers = tiers.filter((tier) => tier.category_id === category.id);
    if (categoryTiers.length === 0) continue;

    const sorted = [...categoryTiers].sort((a, b) => Number(a.min_kg) - Number(b.min_kg));
    let minPrice = Number.POSITIVE_INFINITY;

    for (const tier of sorted) {
      if (!tier.per_kg) {
        minPrice = Math.min(minPrice, Number(tier.price));
        continue;
      }

      const priorFlat = sorted
        .filter((candidate) => !candidate.per_kg && Number(candidate.max_kg) <= Number(tier.min_kg))
        .sort((a, b) => Number(b.max_kg) - Number(a.max_kg))[0];
      const candidatePrice = priorFlat ? Number(priorFlat.price) : 0;
      minPrice = Math.min(minPrice, candidatePrice);
    }

    if (Number.isFinite(minPrice)) {
      result[category.id] = minPrice;
    }
  }

  return result;
}

export default async function QuotePage({ searchParams }: QuotePageProps) {
  const [categories, packagingOptions, packagingImages, settings, flavors, palette, tiers, labelTypes, labelRanges] = await Promise.all([
    getCategories(),
    getPackagingOptions(),
    getPackagingOptionImages(),
    getSettings(),
    getFlavors(),
    getColorPalette(),
    getWeightTiers(),
    getLabelTypes(),
    getLabelRanges(),
  ]);
  const enquiriesEmail = process.env.ENQUIRIES_EMAIL?.trim() || "enquiries@roccandy.com.au";
  const enquiriesHref = `mailto:${enquiriesEmail}`;
  const minBasePrices = buildMinBasePrices(categories, tiers);
  const activeFlavors = flavors.filter((flavor) => flavor.is_active !== false);
  const resolvedSearchParams = await searchParams;
  const typeParam = resolvedSearchParams?.type;
  const initialOrderType =
    typeParam === "weddings" || typeParam === "text" || typeParam === "branded" ? typeParam : undefined;

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <div className="relative">
        <div className="sticky top-0 z-40 w-full border-b border-white/60 bg-white/90 backdrop-blur shadow-[0_8px_18px_rgba(113,113,122,0.28)]" data-quote-header>
          <LandingTopLinksBar />
          <div className="mx-auto w-full max-w-6xl px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <a href="/" className="shrink-0">
                <img src="/branding/logo-gold.svg" alt="Roc Candy" className="h-20 md:h-24" data-header-logo />
              </a>
              <HeaderNav />
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={enquiriesHref}
                  aria-label="Email Roc Candy"
                  className="inline-flex items-center justify-center text-[#ff6f95] transition-colors hover:text-[#ff4f80]"
                >
                  <svg viewBox="0 0 24 24" className="h-10 w-10" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M4 6.75A2.75 2.75 0 0 1 6.75 4h10.5A2.75 2.75 0 0 1 20 6.75v10.5A2.75 2.75 0 0 1 17.25 20H6.75A2.75 2.75 0 0 1 4 17.25V6.75Zm2.32-.25 5.21 3.55c.28.19.65.19.93 0l5.22-3.55a1.25 1.25 0 0 0-.43-.08H6.75c-.15 0-.3.03-.43.08Zm12.18 1.7-5.35 3.64a2.25 2.25 0 0 1-2.5 0L5.5 8.2v9.05c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25V8.2Z"
                    />
                  </svg>
                </a>
                <a
                  href="tel:0414519211"
                  aria-label="Call Roc Candy"
                  className="inline-flex items-center justify-center text-[#ff6f95] transition-colors hover:text-[#ff4f80]"
                >
                  <svg viewBox="0 0 24 24" className="h-10 w-10" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M7.1 3.5c.32 0 .62.15.82.41l2.12 2.75c.27.36.28.85.01 1.21l-1.4 1.86a12.5 12.5 0 0 0 5.72 5.72l1.86-1.4c.36-.27.85-.26 1.21.01l2.75 2.12c.26.2.41.5.41.82v1.33c0 .65-.46 1.2-1.09 1.31-1.2.21-2.4.32-3.6.32-6.5 0-11.78-5.28-11.78-11.78 0-1.2.11-2.4.32-3.6.11-.63.66-1.09 1.31-1.09H7.1Z"
                    />
                  </svg>
                </a>
                <HeaderMenu />
              </div>
            </div>
          </div>
        </div>

        <div className="relative pb-16">
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 z-0 h-[300px] w-[1400px] max-w-full -translate-x-1/2 bg-top bg-no-repeat bg-contain opacity-95 [mask-image:linear-gradient(to_bottom,black_75%,transparent)]" style={{ backgroundImage: "url('/landing/design-top.webp')" }} />
          <div className="relative z-10 mx-auto max-w-7xl px-6">
            <QuoteBuilder
              categories={categories}
              packagingOptions={packagingOptions}
              packagingImages={packagingImages}
              settings={settings}
              flavors={activeFlavors}
              palette={palette}
              labelTypes={labelTypes}
              labelRanges={labelRanges}
              minBasePrices={minBasePrices}
              initialOrderType={initialOrderType}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
