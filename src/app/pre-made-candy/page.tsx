import { AddPremadeToCartButton } from "@/components/AddPremadeToCartButton";
import { PageFaqSection } from "@/components/PageFaqSection";
import PublicSiteHeader from "@/components/PublicSiteHeader";
import { JsonLd } from "@/components/JsonLd";
import { SiteUsps } from "@/components/SiteUsps";
import Image from "next/image";
import { getPremadeCandies } from "@/lib/data";
import { buildFaqSchemaItems } from "@/lib/faqs";
import {
  buildPremadeImageUrl,
  buildPremadeItemPath,
  formatPremadeFlavors,
  formatPremadeMoney,
  formatPremadeWeight,
  hasPremadeSale,
  resolvePremadePrice,
} from "@/lib/premadeCatalog";
import { buildAbsoluteUrl, buildMetadata, buildSchemaGraph, buildWebPageSchema, stripHtml, truncateText } from "@/lib/seo";
import { getManagedSitePage, getManagedSitePageFaqSection } from "@/lib/sitePages";
import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getManagedSitePage("pre-made-candy");
  const description =
    page.metaDescription ||
    truncateText(stripHtml(page.bodyHtml), 160) ||
    "Browse Roc Candy's pre-made rock candy collection with ready-to-order flavours, pack sizes, and Australia-wide delivery.";

  const metadata = buildMetadata({
    title: page.seoTitle || "Pre-Made Rock Candy Australia | Ready To Order Candy | Roc Candy",
    description,
    path: "/pre-made-candy",
    imagePath: page.ogImageUrl || "/quote/subtypes/premade.jpg",
    imageAlt: page.title || "Roc Candy pre-made rock candy collection",
  });

  if (page.canonicalUrl) {
    return {
      ...metadata,
      alternates: {
        canonical: /^https?:\/\//i.test(page.canonicalUrl) ? page.canonicalUrl : buildAbsoluteUrl(page.canonicalUrl),
      },
    };
  }

  return metadata;
}

export default async function PremadePage() {
  const page = await getManagedSitePage("pre-made-candy");
  const faqSection = await getManagedSitePageFaqSection(page);
  const candies = await getPremadeCandies();
  const visible = candies.filter((item) => item.is_active);
  const enquiriesEmail = process.env.ENQUIRIES_EMAIL?.trim() || "enquiries@roccandy.com.au";
  const enquiriesHref = `mailto:${enquiriesEmail}`;
  const description =
    page.metaDescription ||
    truncateText(stripHtml(page.bodyHtml), 160) ||
    "Ready-to-order pre-made rock candy with multiple pack sizes, flavours, and Australia-wide delivery.";
  const itemList = visible.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: buildAbsoluteUrl(buildPremadeItemPath(item)),
    name: item.name,
  }));

  return (
    <main className="landing-bg min-h-screen text-zinc-900">
      <JsonLd
        data={buildSchemaGraph([
          buildWebPageSchema({
            path: "/pre-made-candy",
            name: page.title || "Pre-Made Rock Candy",
            description,
          }),
          {
            "@type": "CollectionPage",
            "@id": `${buildAbsoluteUrl("/pre-made-candy")}#collection`,
            name: page.title || "Pre-Made Rock Candy",
            description,
            hasPart: {
              "@type": "ItemList",
              itemListElement: itemList,
            },
          },
          ...(faqSection
            ? [
                {
                  "@type": "FAQPage",
                  "@id": `${buildAbsoluteUrl("/pre-made-candy")}#faq`,
                  mainEntity: buildFaqSchemaItems(faqSection.items),
                },
              ]
            : []),
        ])}
      />
      <div className="relative">
        <PublicSiteHeader
          enquiriesHref={enquiriesHref}
          logoPriority
          className="sticky top-0 z-40 w-full border-b border-white/60 bg-white/90 backdrop-blur shadow-[0_8px_18px_rgba(113,113,122,0.28)]"
        />

        <div className="site-page-frame site-page-stack-large relative mx-auto max-w-6xl">
          <section className="site-page-header text-center">
            <p className="site-eyebrow text-zinc-500">Shop</p>
            <h1 className="site-page-title text-[rgb(146,146,177)]">{page.title || "Pre-made candy"}</h1>
            <SiteUsps />
            {page.bodyHtml ? (
              <article
                className="site-rich-content mx-auto max-w-3xl text-base leading-relaxed"
                dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
              />
            ) : null}
          </section>

          {visible.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white/90 p-6 text-center text-sm text-zinc-600 shadow-sm">
              Pre-made items are being stocked. Check back soon.
            </div>
          ) : (
            <section className="site-product-grid grid sm:grid-cols-2 md:grid-cols-4">
              {visible.map((item) => {
                const imageUrl = buildPremadeImageUrl(item.image_path);
                const weightLabel = formatPremadeWeight(Number(item.weight_g));
                const titleLine = weightLabel ? `${weightLabel} ${item.name}` : item.name;
                const shortLinkLabel = item.short_name?.trim() || item.name;
                const viewLabel = `View ${shortLinkLabel}`;
                const flavorLabel = formatPremadeFlavors(item.flavors ?? null);
                const itemHref = buildPremadeItemPath(item);
                const effectivePrice = resolvePremadePrice(item);
                const showSalePrice = hasPremadeSale(item);
                return (
                  <article
                    key={item.id}
                    className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 shadow-sm"
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100">
                      {item.great_value ? (
                        <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-[#ff6f95] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Discounted
                        </span>
                      ) : null}
                      {imageUrl ? (
                        <Link href={itemHref} aria-label={viewLabel}>
                          <Image
                            src={imageUrl}
                            alt={item.name}
                            width={960}
                            height={720}
                            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 25vw"
                            className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
                          />
                        </Link>
                      ) : null}
                      <AddPremadeToCartButton
                        className="absolute right-2 top-2"
                        item={{
                          premadeId: item.id,
                          name: item.name,
                          flavor: flavorLabel || undefined,
                          price: effectivePrice,
                          weight_g: Number(item.weight_g),
                          imageUrl,
                        }}
                      />
                    </div>
                    <div className="site-product-card-stack flex flex-1 flex-col px-4 py-3 text-center">
                      <Link href={itemHref} className="text-sm font-bold text-[#ff6f95] hover:text-[#ff4f80] hover:underline">
                        {titleLine}
                      </Link>
                      <div className="site-product-card-meta">
                        {showSalePrice ? (
                          <p className="text-sm text-zinc-400 line-through">{formatPremadeMoney(Number(item.price))}</p>
                        ) : null}
                        <p className="text-xl font-semibold text-zinc-900">{formatPremadeMoney(effectivePrice)}</p>
                      </div>
                      {flavorLabel ? <p className="text-sm text-zinc-500">{flavorLabel}</p> : null}
                      {item.description ? <p className="text-sm text-zinc-500">{item.description}</p> : null}
                      {item.approx_pcs ? (
                        <p className="text-sm text-zinc-500">Approx {item.approx_pcs} pcs</p>
                      ) : null}
                      <p className="text-sm font-semibold text-zinc-500">Free Shipping Australia Wide</p>
                      <Link
                        href={itemHref}
                        className="mt-1 inline-block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 hover:text-zinc-800"
                      >
                        {viewLabel}
                      </Link>
                    </div>
                  </article>
                );
              })}
            </section>
          )}

          {faqSection ? <PageFaqSection heading={faqSection.heading} items={faqSection.items} /> : null}
        </div>
      </div>
    </main>
  );
}
