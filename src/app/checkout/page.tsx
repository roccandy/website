import PublicSiteHeader from "@/components/PublicSiteHeader";
import { formatPremadeFlavors } from "@/lib/premadeCatalog";
import {
  getColorPalette,
  getLabelTypes,
  getPackagingOptions,
  getPremadeCandies,
  getQuoteBlocks,
  getSettings,
} from "@/lib/data";
import { getActiveProductionBlockoutMessage } from "@/lib/productionBlockout";
import { CheckoutClient } from "./CheckoutClient";
import { resolvePremadePrice } from "@/lib/premadeCatalog";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const PREMADE_IMAGE_BUCKET = "premade-images";

function buildPremadeImageUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !path) return "";
  const encoded = encodeURIComponent(path);
  return `${base}/storage/v1/object/public/${PREMADE_IMAGE_BUCKET}/${encoded}`;
}

function formatWeight(weight_g: number) {
  if (!Number.isFinite(weight_g)) return "";
  if (weight_g >= 1000) {
    const kg = weight_g / 1000;
    return `${kg % 1 === 0 ? kg.toFixed(0) : kg.toFixed(1)}kg`;
  }
  return `${weight_g}g`;
}

export default async function CheckoutPage() {
  const [premade, palette, quoteBlocks, settings, labelTypes, packagingOptions, productionBlockoutMessage] = await Promise.all([
    getPremadeCandies(),
    getColorPalette(),
    getQuoteBlocks(),
    getSettings(),
    getLabelTypes(),
    getPackagingOptions(),
    getActiveProductionBlockoutMessage(),
  ]);
  const suggestions = premade
    .filter((item) => item.is_active)
    .map((item) => ({
      id: item.id,
      name: item.name,
      flavorLabel: formatPremadeFlavors(item.flavors ?? null),
      description: item.description,
      price: resolvePremadePrice(item),
      weight_g: Number(item.weight_g),
      weightLabel: formatWeight(Number(item.weight_g)),
      imageUrl: buildPremadeImageUrl(item.image_path),
      approx_pcs: item.approx_pcs,
    }));
  const enquiriesEmail = process.env.ENQUIRIES_EMAIL?.trim() || "enquiries@roccandy.com.au";
  const enquiriesHref = `mailto:${enquiriesEmail}`;

  return (
    <main className="landing-bg min-h-screen text-zinc-900">
      <div className="relative">
        <PublicSiteHeader
          enquiriesHref={enquiriesHref}
          logoPriority
          className="sticky top-0 z-40 w-full border-b border-white/60 bg-white/90 backdrop-blur shadow-[0_8px_18px_rgba(113,113,122,0.28)]"
        />

        <div className="relative mx-auto max-w-6xl space-y-10 px-6 py-10 md:py-14">
          <section className="space-y-3 text-center">
            <p className="text-xs font-semibold normal-case tracking-[0.08em] text-zinc-500">Checkout</p>
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">Review your cart</h1>
            <p className="text-base text-zinc-600">Confirm your selections and add any last-minute extras.</p>
          </section>

          <CheckoutClient
            suggestions={suggestions}
            palette={palette}
            quoteBlocks={quoteBlocks}
            labelTypes={labelTypes}
            packagingOptions={packagingOptions}
            urgencyFeePercent={Number(settings?.urgency_fee ?? 0)}
            urgencyPeriodDays={Number(settings?.lead_time_days ?? 0)}
            transactionFeePercent={Number(settings?.transaction_fee_percent ?? 0)}
            productionBlockoutMessage={productionBlockoutMessage}
          />
        </div>
      </div>
    </main>
  );
}
