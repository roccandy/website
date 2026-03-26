import type { Metadata } from "next";
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
import { PageFaqSection } from "@/components/PageFaqSection";
import PublicSiteHeader from "@/components/PublicSiteHeader";
import { JsonLd } from "@/components/JsonLd";
import { QuoteBuilder } from "@/app/quote/QuoteBuilder";
import { buildFaqSchemaItems } from "@/lib/faqs";
import { buildAbsoluteUrl, buildMetadata, buildSchemaGraph, buildWebPageSchema, stripHtml, truncateText } from "@/lib/seo";
import { buildDesignerPath, getDesignerCanonicalTarget, isLegacyDesignerQuery, resolveDesignerState } from "@/lib/designUrls";
import { getManagedSitePage, getManagedSitePageFaqSection } from "@/lib/sitePages";
import { redirect } from "next/navigation";

export const revalidate = 300;

type QuotePageProps = {
  searchParams?:
    | { type?: string; variant?: string; subtype?: string }
    | Promise<{ type?: string; variant?: string; subtype?: string }>;
};

const DESIGN_VARIANTS = {
  branded: {
    title: "Branded Rock Candy Australia | Custom Logo Candy | Roc Candy",
    description:
      "Design branded rock candy with your logo or artwork for events, promotions, gifts, and corporate campaigns across Australia.",
    path: "/design/branded-logo-candy",
    name: "Branded Rock Candy Designer",
  },
  weddings: {
    title: "Wedding Rock Candy Australia | Personalised Wedding Candy | Roc Candy",
    description:
      "Create personalised wedding rock candy with names, initials, colours, and custom styling for favours, bomboniere, and wedding tables.",
    path: "/design/wedding-candy",
    name: "Wedding Rock Candy Designer",
  },
  text: {
    title: "Custom Text Rock Candy Australia | Personalised Letter Candy | Roc Candy",
    description:
      "Create personalised text rock candy with names, words, initials, and custom colours for gifts, parties, weddings, and events.",
    path: "/design/custom-text-candy",
    name: "Custom Text Rock Candy Designer",
  },
  default: {
    title: "Design Personalised Rock Candy | Wedding, Branded & Text Candy | Roc Candy",
    description:
      "Design personalised rock candy for weddings, branded events, gifts, and custom text orders. Choose colours, flavours, packaging, and styling online.",
    path: "/design",
    name: "Personalised Rock Candy Designer",
  },
} as const;

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

export async function generateMetadata({ searchParams }: QuotePageProps): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const designerState = resolveDesignerState({
    type: resolvedSearchParams?.type,
    variant: resolvedSearchParams?.variant,
    subtype: resolvedSearchParams?.subtype,
  });
  const isVariant = Boolean(designerState);
  const variant = designerState ? DESIGN_VARIANTS[designerState.orderType] : DESIGN_VARIANTS.default;
  const canonicalTarget = getDesignerCanonicalTarget({
    type: resolvedSearchParams?.type,
    variant: resolvedSearchParams?.variant,
    subtype: resolvedSearchParams?.subtype,
  });

  if (!isVariant) {
    const page = await getManagedSitePage("design");
    const description =
      page.metaDescription ||
      truncateText(stripHtml(page.bodyHtml), 160) ||
      DESIGN_VARIANTS.default.description;

    const metadata = buildMetadata({
      title: page.seoTitle || variant.title,
      description,
      path: variant.path,
      imagePath: page.ogImageUrl || "/landing/design-top.webp",
      imageAlt: page.title || variant.name,
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

  const metadata = buildMetadata({
    title: variant.title,
    description: variant.description,
    path: canonicalTarget,
    imagePath: "/landing/design-top.webp",
    imageAlt: variant.name,
    noIndex: true,
  });

  return {
    ...metadata,
    alternates: {
      canonical: canonicalTarget,
    },
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function QuotePage({ searchParams }: QuotePageProps) {
  const resolvedSearchParams = await searchParams;
  const designerState = resolveDesignerState({
    type: resolvedSearchParams?.type,
    variant: resolvedSearchParams?.variant,
    subtype: resolvedSearchParams?.subtype,
  });
  const normalizedTarget = designerState
    ? buildDesignerPath({
        orderType: designerState.orderType,
        categoryId: designerState.categoryId,
        extraParams: resolvedSearchParams ?? {},
      })
    : (() => {
        const extraQuery = new URLSearchParams();
        Object.entries(resolvedSearchParams ?? {}).forEach(([key, value]) => {
          if (key !== "type" && key !== "variant" && key !== "subtype" && value) {
            extraQuery.set(key, value);
          }
        });
        const query = extraQuery.toString();
        return query ? `/design?${query}` : "/design";
      })();
  const currentQuery = resolvedSearchParams
    ? new URLSearchParams(
        Object.entries(resolvedSearchParams).flatMap(([key, value]) => (value ? [[key, value]] : [])),
      ).toString()
    : "";
  const currentPath = currentQuery ? `/design?${currentQuery}` : "/design";

  if (isLegacyDesignerQuery(resolvedSearchParams ?? {}) || currentPath !== normalizedTarget) {
    redirect(normalizedTarget);
  }

  const designPage = await getManagedSitePage("design");
  const initialOrderType = designerState?.orderType;
  const faqSection = !initialOrderType ? await getManagedSitePageFaqSection(designPage) : null;
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
  const seoVariant =
    initialOrderType && initialOrderType in DESIGN_VARIANTS
      ? DESIGN_VARIANTS[initialOrderType]
      : DESIGN_VARIANTS.default;
  const defaultDescription =
    designPage.metaDescription ||
    truncateText(stripHtml(designPage.bodyHtml), 160) ||
    DESIGN_VARIANTS.default.description;

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <JsonLd
        data={buildSchemaGraph([
          buildWebPageSchema({
            path: seoVariant.path,
            name: !initialOrderType ? designPage.title || seoVariant.name : seoVariant.name,
            description: !initialOrderType ? defaultDescription : seoVariant.description,
          }),
          {
            "@type": "Service",
            name: !initialOrderType ? designPage.title || seoVariant.name : seoVariant.name,
            description: !initialOrderType ? defaultDescription : seoVariant.description,
            areaServed: {
              "@type": "Country",
              name: "Australia",
            },
            provider: {
              "@id": `${buildAbsoluteUrl()}/#organization`,
            },
            url: buildAbsoluteUrl(seoVariant.path),
          },
          ...(faqSection
            ? [
                {
                  "@type": "FAQPage",
                  "@id": `${buildAbsoluteUrl("/design")}#faq`,
                  mainEntity: buildFaqSchemaItems(faqSection.items),
                },
              ]
            : []),
        ])}
      />
      <div className="relative">
        <PublicSiteHeader
          enquiriesHref={enquiriesHref}
          className="sticky top-0 z-40 w-full border-b border-white/60 bg-white/90 backdrop-blur shadow-[0_8px_18px_rgba(113,113,122,0.28)]"
          dataQuoteHeader
        />

        <div className="relative pb-16">
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 z-0 h-[300px] w-[1400px] max-w-full -translate-x-1/2 bg-top bg-no-repeat bg-contain opacity-95 [mask-image:linear-gradient(to_bottom,black_75%,transparent)]" style={{ backgroundImage: "url('/landing/design-top.webp')" }} />
          <div className="relative z-10 mx-auto max-w-7xl px-6">
            {!initialOrderType ? (
              <section className="mx-auto mb-8 max-w-4xl space-y-3 rounded-3xl border border-zinc-200 bg-white/90 p-6 text-center shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Designer</p>
                <h1 className="normal-case text-4xl font-semibold tracking-tight text-[rgb(114,112,111)]">
                  {designPage.title || "Design Your Candy"}
                </h1>
                {designPage.bodyHtml ? (
                  <article
                    className="mx-auto max-w-3xl text-base leading-relaxed text-zinc-600 [&_a]:font-semibold [&_a]:text-[#ff6f95] hover:[&_a]:text-[#ff4f80]"
                    dangerouslySetInnerHTML={{ __html: designPage.bodyHtml }}
                  />
                ) : null}
              </section>
            ) : null}
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
              titleHeadingLevel={initialOrderType ? "h1" : "h2"}
            />
            {faqSection ? (
              <div className="mx-auto mt-10 max-w-4xl">
                <PageFaqSection heading={faqSection.heading} items={faqSection.items} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
