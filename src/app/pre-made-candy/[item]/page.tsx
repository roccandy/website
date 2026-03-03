import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HeaderNav from "@/components/HeaderNav";
import HeaderMenu from "@/components/HeaderMenu";
import LandingTopLinksBar from "@/components/LandingTopLinksBar";
import ProductionBlockoutBanner from "@/components/ProductionBlockoutBanner";
import { AddPremadeToCartButton } from "@/components/AddPremadeToCartButton";
import { getPremadeCandies, getPremadeCandyById } from "@/lib/data";
import {
  buildPremadeImageUrl,
  buildPremadeItemPath,
  extractPremadeIdFromParam,
  formatPremadeFlavors,
  formatPremadeMoney,
  formatPremadeWeight,
} from "@/lib/premadeCatalog";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type PageProps = {
  params:
    | Promise<{
        item?: string;
      }>
    | {
        item?: string;
      };
};

async function loadItemFromParams(itemParam: string) {
  const id = extractPremadeIdFromParam(itemParam);
  if (!id) return null;
  const item = await getPremadeCandyById(id);
  if (!item || !item.is_active) return null;
  return item;
}

async function resolveItemParam(params: PageProps["params"]) {
  const resolved = await params;
  const candidate = resolved?.item;
  if (Array.isArray(candidate)) {
    return typeof candidate[0] === "string" ? candidate[0] : undefined;
  }
  return typeof candidate === "string" ? candidate : undefined;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const itemParam = await resolveItemParam(params);
  const item = itemParam ? await loadItemFromParams(itemParam) : null;
  if (!item) {
    return {
      title: "Pre-made candy | Roc Candy",
      description: "Browse pre-made rock candy products.",
    };
  }
  const weightLabel = formatPremadeWeight(Number(item.weight_g));
  const titlePrefix = weightLabel ? `${weightLabel} ${item.name}` : item.name;
  const description =
    item.short_description?.trim() ||
    item.description?.trim() ||
    `Buy ${item.name} pre-made rock candy from Roc Candy.`;
  const image = buildPremadeImageUrl(item.image_path);
  return {
    title: `${titlePrefix} | Pre-made candy | Roc Candy`,
    description,
    openGraph: {
      title: `${titlePrefix} | Roc Candy`,
      description,
      images: image ? [{ url: image, alt: item.name }] : undefined,
      type: "website",
    },
  };
}

export default async function PremadeItemPage({ params }: PageProps) {
  const itemParam = await resolveItemParam(params);
  const item = itemParam ? await loadItemFromParams(itemParam) : null;
  if (!item) notFound();

  const enquiriesEmail = process.env.ENQUIRIES_EMAIL?.trim() || "enquiries@roccandy.com.au";
  const enquiriesHref = `mailto:${enquiriesEmail}`;
  const imageUrl = buildPremadeImageUrl(item.image_path);
  const weightLabel = formatPremadeWeight(Number(item.weight_g));
  const flavorLabel = formatPremadeFlavors(item.flavors ?? null);
  const related = (await getPremadeCandies())
    .filter((candidate) => candidate.is_active && candidate.id !== item.id)
    .slice(0, 4);

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
        <ProductionBlockoutBanner />

        <div className="relative mx-auto max-w-6xl space-y-8 px-6 py-10 md:py-14">
          <a href="/pre-made-candy" className="inline-block text-sm font-semibold text-zinc-500 hover:text-zinc-900">
            ← Back to all pre-made candy
          </a>

          <section className="grid gap-8 rounded-3xl border border-zinc-200 bg-white/90 p-5 shadow-sm md:grid-cols-2 md:p-8">
            <div className="relative overflow-hidden rounded-2xl bg-zinc-100">
              {imageUrl ? <img src={imageUrl} alt={item.name} className="h-full w-full object-cover" /> : null}
              {item.great_value ? (
                <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-[#ff6f95] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                  Discounted
                </span>
              ) : null}
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Pre-made candy</p>
              <h1 className="text-3xl font-semibold tracking-tight text-[#ff6f95]">{item.name}</h1>
              <p className="text-2xl font-semibold text-zinc-900">{formatPremadeMoney(Number(item.price))}</p>
              {weightLabel ? <p className="text-sm text-zinc-600">Pack size: {weightLabel}</p> : null}
              {flavorLabel ? <p className="text-sm text-zinc-600">Flavours: {flavorLabel}</p> : null}
              {item.approx_pcs ? <p className="text-sm text-zinc-600">Approx {item.approx_pcs} pcs</p> : null}
              {item.description ? <p className="text-base text-zinc-700">{item.description}</p> : null}
              <p className="text-sm font-semibold text-zinc-600">Free Shipping Australia Wide</p>
              <AddPremadeToCartButton
                className="inline-block"
                item={{
                  premadeId: item.id,
                  name: item.name,
                  flavor: flavorLabel || undefined,
                  price: Number(item.price),
                  weight_g: Number(item.weight_g),
                  imageUrl,
                }}
              />
            </div>
          </section>

          {related.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-zinc-900">Related pre-made items</h2>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                {related.map((relatedItem) => {
                  const relatedImage = buildPremadeImageUrl(relatedItem.image_path);
                  return (
                    <a
                      key={relatedItem.id}
                      href={buildPremadeItemPath(relatedItem)}
                      className="overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="aspect-[4/3] bg-zinc-100">
                        {relatedImage ? (
                          <img
                            src={relatedImage}
                            alt={relatedItem.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : null}
                      </div>
                      <div className="space-y-1 px-3 py-3">
                        <p className="text-sm font-semibold text-[#ff6f95]">{relatedItem.name}</p>
                        <p className="text-sm text-zinc-600">{formatPremadeMoney(Number(relatedItem.price))}</p>
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
