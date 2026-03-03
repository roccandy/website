import HeaderNav from "@/components/HeaderNav";
import HeaderMenu from "@/components/HeaderMenu";
import LandingTopLinksBar from "@/components/LandingTopLinksBar";
import {
  getColorPalette,
  getLabelTypes,
  getPackagingOptions,
  getPremadeCandies,
  getQuoteBlocks,
  getSettings,
} from "@/lib/data";
import { CheckoutClient } from "./CheckoutClient";

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
  const [premade, palette, quoteBlocks, settings, labelTypes, packagingOptions] = await Promise.all([
    getPremadeCandies(),
    getColorPalette(),
    getQuoteBlocks(),
    getSettings(),
    getLabelTypes(),
    getPackagingOptions(),
  ]);
  const suggestions = premade
    .filter((item) => item.is_active)
    .map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: Number(item.price),
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
        <div className="sticky top-0 z-40 w-full border-b border-white/60 bg-white/90 backdrop-blur shadow-[0_8px_18px_rgba(113,113,122,0.28)]">
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
          />
        </div>
      </div>
    </main>
  );
}
