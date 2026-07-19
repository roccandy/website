import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { AddPremadeToCartButton } from "@/components/AddPremadeToCartButton";
import { ContextualEnquiryCta } from "@/components/ContextualEnquiryCta";
import { JsonLd } from "@/components/JsonLd";
import { PremadeItemAnalytics } from "@/components/PremadeItemAnalytics";
import PublicSiteHeader from "@/components/PublicSiteHeader";
import { getPremadeCandies, getPremadeCandyById, getPremadeCandyBySlug } from "@/lib/data";
import {
  buildPremadeImageUrl,
  buildPremadeItemPath,
  extractPremadeLegacyIdFromParam,
  formatPremadeFlavors,
  formatPremadeMoney,
  formatPremadeWeight,
  hasPremadeSale,
  isPremadeLegacyParam,
  normalizePremadeSlugInput,
  resolvePremadePrice,
} from "@/lib/premadeCatalog";
import {
  buildAbsoluteUrl,
  buildMetadata,
  buildSchemaGraph,
  buildWebPageSchema,
  mapAvailabilityToSchema,
  toOpenGraphImage,
} from "@/lib/seo";

export const revalidate = 300;

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
  if (isPremadeLegacyParam(itemParam)) {
    const id = extractPremadeLegacyIdFromParam(itemParam);
    if (!id) return null;
    const item = await getPremadeCandyById(id);
    if (!item || !item.is_active) return null;
    return {
      item,
      canonicalPath: buildPremadeItemPath(item),
      shouldRedirect: true,
    };
  }

  const normalizedSlug = normalizePremadeSlugInput(itemParam);
  const item = await getPremadeCandyBySlug(normalizedSlug);
  if (!item || !item.is_active) return null;
  const canonicalPath = buildPremadeItemPath(item);
  return {
    item,
    canonicalPath,
    shouldRedirect: canonicalPath !== `/pre-made-candy/${itemParam}`,
  };
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
  const resolvedItem = itemParam ? await loadItemFromParams(itemParam) : null;
  const item = resolvedItem?.item ?? null;
  if (!item) {
    return buildMetadata({
      title: "Pre-Made Rock Candy | Roc Candy",
      description: "Browse Roc Candy pre-made rock candy products.",
      path: "/pre-made-candy",
    });
  }
  const weightLabel = formatPremadeWeight(Number(item.weight_g));
  const titlePrefix = weightLabel ? `${weightLabel} ${item.name}` : item.name;
  const seoTitle = item.seo_title?.trim() || `${titlePrefix} | Pre-Made Rock Candy | Roc Candy`;
  const description =
    item.meta_description?.trim() ||
    item.short_description?.trim() ||
    item.description?.trim() ||
    `Buy ${item.name} pre-made rock candy from Roc Candy.`;
  const image = item.og_image_url?.trim() || buildPremadeImageUrl(item.image_path);
  const path = buildPremadeItemPath(item);
  const metadata = buildMetadata({
    title: seoTitle,
    description,
    path,
    imagePath: image || "/quote/subtypes/premade.jpg",
    imageAlt: item.name,
  });

  if (item.canonical_url?.trim()) {
    return {
      ...metadata,
      alternates: {
        canonical: /^https?:\/\//i.test(item.canonical_url)
          ? item.canonical_url
          : buildAbsoluteUrl(item.canonical_url),
      },
      openGraph: {
        ...metadata.openGraph,
        images: image ? [toOpenGraphImage(image, item.name)] : metadata.openGraph?.images,
      },
    };
  }

  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      images: image ? [toOpenGraphImage(image, item.name)] : metadata.openGraph?.images,
    },
  };
}

export default async function PremadeItemPage({ params }: PageProps) {
  const itemParam = await resolveItemParam(params);
  const resolvedItem = itemParam ? await loadItemFromParams(itemParam) : null;
  const item = resolvedItem?.item ?? null;
  if (!item || !resolvedItem) notFound();
  if (resolvedItem.shouldRedirect) {
    permanentRedirect(resolvedItem.canonicalPath);
  }

  const enquiriesEmail = process.env.ENQUIRIES_EMAIL?.trim() || "enquiries@roccandy.com.au";
  const enquiriesHref = `mailto:${enquiriesEmail}`;
  const imageUrl = buildPremadeImageUrl(item.image_path);
  const weightLabel = formatPremadeWeight(Number(item.weight_g));
  const flavorLabel = formatPremadeFlavors(item.flavors ?? null);
  const related = (await getPremadeCandies())
    .filter((candidate) => candidate.is_active && candidate.id !== item.id)
    .slice(0, 4);
  const productUrl = buildAbsoluteUrl(buildPremadeItemPath(item));
  const effectivePrice = resolvePremadePrice(item);
  const showSalePrice = hasPremadeSale(item);
  const productDescription =
    item.meta_description?.trim() ||
    item.short_description?.trim() ||
    item.description?.trim() ||
    item.name;

  return (
    <main className="landing-bg min-h-screen text-zinc-900">
      <JsonLd
        data={buildSchemaGraph([
          buildWebPageSchema({
            path: buildPremadeItemPath(item),
            name: item.name,
            description: productDescription,
          }),
          {
            "@type": "Product",
            "@id": `${productUrl}#product`,
            name: item.name,
            description: productDescription,
            image: imageUrl ? [imageUrl] : undefined,
            sku: item.sku ?? undefined,
            brand: {
              "@type": "Brand",
              name: item.brand?.trim() || "Roc Candy",
            },
            itemCondition: "https://schema.org/NewCondition",
            category: item.google_product_category ?? undefined,
            offers: {
              "@type": "Offer",
              priceCurrency: "AUD",
              price: effectivePrice.toFixed(2),
              availability: mapAvailabilityToSchema(item.availability),
              url: productUrl,
            },
          },
        ])}
      />
      <PremadeItemAnalytics
        itemId={item.id}
        itemName={item.name}
        itemVariant={flavorLabel || undefined}
        price={effectivePrice}
      />
      <div className="relative">
        <PublicSiteHeader
          enquiriesHref={enquiriesHref}
          logoPriority
          className="sticky top-0 z-40 w-full border-b border-white/60 bg-white/90 backdrop-blur shadow-[0_8px_18px_rgba(113,113,122,0.28)]"
        />

        <div className="site-page-frame site-page-stack-large relative mx-auto max-w-6xl">
          <Link
            href="/pre-made-candy"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/95 px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:text-zinc-900 hover:shadow-md"
          >
            <span aria-hidden="true">←</span>
            <span>Back to all pre-made candy</span>
          </Link>

          <section className="site-product-feature-grid grid rounded-3xl border border-zinc-200 bg-white/90 p-5 shadow-sm md:grid-cols-2 md:p-8">
            <div className="relative overflow-hidden rounded-2xl bg-zinc-100">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={item.name}
                  width={1200}
                  height={900}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="h-full w-full object-cover"
                  priority
                />
              ) : null}
              {item.great_value ? (
                <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-[#ff6f95] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                  Discounted
                </span>
              ) : null}
            </div>

            <div className="site-product-detail-stack">
              <p className="site-eyebrow text-zinc-500">Pre-made candy</p>
              <h1 className="site-page-title text-[#ff6f95]">{item.name}</h1>
              <div className="site-faq-heading-stack">
                {showSalePrice ? (
                  <p className="text-sm text-zinc-400 line-through">{formatPremadeMoney(Number(item.price))}</p>
                ) : null}
                <p className="text-2xl font-semibold text-zinc-900">{formatPremadeMoney(effectivePrice)}</p>
              </div>
              {weightLabel ? <p className="text-sm text-zinc-600">Pack size: {weightLabel}</p> : null}
              {flavorLabel ? <p className="text-sm text-zinc-600">Flavours: {flavorLabel}</p> : null}
              {item.approx_pcs ? <p className="text-sm text-zinc-600">Approx {item.approx_pcs} pcs</p> : null}
              {item.description ? <p className="text-base text-zinc-700">{item.description}</p> : null}
              <p className="text-sm font-semibold text-zinc-600">Free Shipping Australia Wide</p>
              <AddPremadeToCartButton
                className="w-full sm:w-auto"
                variant="labelled"
                item={{
                  premadeId: item.id,
                  name: item.name,
                  flavor: flavorLabel || undefined,
                  price: effectivePrice,
                  weight_g: Number(item.weight_g),
                  imageUrl,
                }}
              />
              <ContextualEnquiryCta
                compact
                interest="pre-made"
                productContext={item.name}
                sourcePage={buildPremadeItemPath(item)}
                heading="Need a larger quantity or help with timing?"
                description="Send us the quantity and date you need, and we’ll confirm the best option."
                buttonLabel={`Ask about ${item.short_name?.trim() || item.name}`}
              />
            </div>
          </section>

          {related.length > 0 ? (
            <section className="site-related-section">
              <h2 className="site-small-title text-zinc-900">Related pre-made items</h2>
              <div className="site-product-grid grid sm:grid-cols-2 md:grid-cols-4">
                {related.map((relatedItem) => {
                  const relatedImage = buildPremadeImageUrl(relatedItem.image_path);
                  const relatedPrice = resolvePremadePrice(relatedItem);
                  return (
                    <Link
                      key={relatedItem.id}
                      href={buildPremadeItemPath(relatedItem)}
                      className="overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="aspect-[4/3] bg-zinc-100">
                        {relatedImage ? (
                          <Image
                            src={relatedImage}
                            alt={relatedItem.name}
                            width={960}
                            height={720}
                            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 25vw"
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="site-faq-heading-stack px-3 py-3">
                        <p className="text-sm font-semibold text-[#ff6f95]">{relatedItem.name}</p>
                        <p className="text-sm text-zinc-600">{formatPremadeMoney(relatedPrice)}</p>
                      </div>
                    </Link>
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
