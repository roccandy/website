import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Montserrat } from "next/font/google";
import { notFound } from "next/navigation";
import { PageFaqSection } from "@/components/PageFaqSection";
import { JsonLd } from "@/components/JsonLd";
import PublicSiteHeader from "@/components/PublicSiteHeader";
import { SiteUsps } from "@/components/SiteUsps";
import { buildFaqSchemaItems } from "@/lib/faqs";
import {
  buildAbsoluteUrl,
  buildMetadata,
  buildSchemaGraph,
  buildWebPageSchema,
  stripHtml,
  truncateText,
} from "@/lib/seo";
import {
  buildManagedSitePageHref,
  CATCH_ALL_SITE_PAGE_SLUGS,
  getManagedSitePage,
  getManagedSitePageFaqSection,
} from "@/lib/sitePages";
import { buildDesignerPath } from "@/lib/designUrls";

type LandingPageConfig = {
  intro: string;
  detail: string;
  defaultGalleryImageUrls: string[];
  primaryCta: { label: string; href: string };
};

const montserratLight = Montserrat({
  subsets: ["latin"],
  weight: ["300"],
});

const LANDING_PAGE_CONFIG: Record<string, LandingPageConfig> = {
  "design/wedding-candy": {
    intro: "Create wedding rock candy",
    detail: "customise colours and packaging",
    defaultGalleryImageUrls: [
      "/quote/subtypes/weddings-both-names.jpg",
      "/quote/subtypes/weddings-initials.jpg",
      "/quote/subtypes/weddings-both-names.jpg",
      "/quote/subtypes/weddings-initials.jpg",
      "/quote/subtypes/weddings-both-names.jpg",
      "/quote/subtypes/weddings-initials.jpg",
    ],
    primaryCta: {
      label: "Design & Pricing",
      href: buildDesignerPath({ orderType: "weddings" }),
    },
  },
  "design/branded-logo-candy": {
    intro: "Create branded rock candy",
    detail: "customise colours and packaging",
    defaultGalleryImageUrls: [
      "/quote/subtypes/branded.jpg",
      "/quote/subtypes/branded.jpg",
      "/quote/subtypes/branded.jpg",
      "/quote/subtypes/branded.jpg",
      "/quote/subtypes/branded.jpg",
      "/quote/subtypes/branded.jpg",
    ],
    primaryCta: {
      label: "Design & Pricing",
      href: buildDesignerPath({ orderType: "branded", categoryId: "branded" }),
    },
  },
  "design/custom-text-candy": {
    intro: "Create text rock candy",
    detail: "customise colours and packaging",
    defaultGalleryImageUrls: [
      "/quote/subtypes/custom-1-6.jpg",
      "/quote/subtypes/custom-7-14.jpeg",
      "/quote/subtypes/custom-1-6.jpg",
      "/quote/subtypes/custom-7-14.jpeg",
      "/quote/subtypes/custom-1-6.jpg",
      "/quote/subtypes/custom-7-14.jpeg",
    ],
    primaryCta: {
      label: "Design & Pricing",
      href: buildDesignerPath({ orderType: "text" }),
    },
  },
};

function resolveGalleryImages(primary: string[], fallback: string[]) {
  const base = primary.length > 0 ? primary : fallback;
  if (base.length === 0) return [];

  const resolved = [...base];
  while (resolved.length < 4) {
    resolved.push(base[resolved.length % base.length]);
  }

  return resolved;
}

function buildGalleryRows(images: string[]) {
  if (images.length === 0) return [];

  const firstRow = images.filter((_, index) => index % 2 === 0);
  const secondRow = images.filter((_, index) => index % 2 === 1);

  if (secondRow.length === 0) {
    return [firstRow];
  }

  return [firstRow, secondRow];
}

export const revalidate = 300;

type ManagedPageProps = {
  params:
    | Promise<{
        slug?: string[];
      }>
    | {
        slug?: string[];
      };
};

async function loadManagedPage(params: ManagedPageProps["params"]) {
  const resolved = await params;
  const path = Array.isArray(resolved?.slug) ? resolved.slug.join("/") : "";
  if (!path) return null;
  if (!CATCH_ALL_SITE_PAGE_SLUGS.includes(path as (typeof CATCH_ALL_SITE_PAGE_SLUGS)[number])) {
    return null;
  }
  return getManagedSitePage(path);
}

export async function generateMetadata({ params }: ManagedPageProps): Promise<Metadata> {
  const page = await loadManagedPage(params);
  if (!page) {
    return buildMetadata({
      title: "Page Not Found | Roc Candy",
      description: "The page you were looking for could not be found.",
      noIndex: true,
    });
  }

  const description =
    page.metaDescription ||
    truncateText(stripHtml(page.bodyHtml), 160) ||
    "Read more on Roc Candy.";
  const metadata = buildMetadata({
    title: page.seoTitle || `${page.title} | Roc Candy`,
    description,
    path: buildManagedSitePageHref(page.slug),
    imagePath: page.ogImageUrl || "/landing/home-feature-poster.jpg",
    imageAlt: page.title,
  });

  if (page.canonicalUrl) {
    return {
      ...metadata,
      alternates: {
        canonical: /^https?:\/\//i.test(page.canonicalUrl)
          ? page.canonicalUrl
          : buildAbsoluteUrl(page.canonicalUrl),
      },
    };
  }

  return metadata;
}

export default async function ManagedContentPage({ params }: ManagedPageProps) {
  const page = await loadManagedPage(params);
  if (!page) notFound();

  const enquiriesEmail = process.env.ENQUIRIES_EMAIL?.trim() || "enquiries@roccandy.com.au";
  const enquiriesHref = `mailto:${enquiriesEmail}`;
  const pageHref = buildManagedSitePageHref(page.slug);
  const pageDescription =
    page.metaDescription ||
    truncateText(stripHtml(page.bodyHtml), 160) ||
    page.title;
  const faqSection = await getManagedSitePageFaqSection(page);
  const landingConfig = LANDING_PAGE_CONFIG[page.slug] ?? null;
  const landingHeroSubheading = landingConfig
    ? page.heroSubheading || landingConfig.intro
    : null;
  const landingHeroSupportingLine = landingConfig
    ? page.heroSupportingLine || landingConfig.detail
    : null;
  const landingGalleryImages = landingConfig
    ? resolveGalleryImages(page.galleryImageUrls, landingConfig.defaultGalleryImageUrls)
    : [];
  const landingGalleryRows = buildGalleryRows(landingGalleryImages);

  return (
    <main className="landing-bg min-h-screen bg-white text-zinc-900">
      <JsonLd
        data={buildSchemaGraph([
          buildWebPageSchema({
            path: pageHref,
            name: page.title,
            description: pageDescription,
          }),
          ...(faqSection
            ? [
                {
                  "@type": "FAQPage",
                  "@id": `${buildAbsoluteUrl(pageHref)}#faq`,
                  mainEntity: buildFaqSchemaItems(faqSection.items),
                },
              ]
            : []),
        ])}
      />
      <div className="relative">
        <PublicSiteHeader enquiriesHref={enquiriesHref} />

        <div className="mx-auto max-w-5xl space-y-6 px-6 py-10 md:py-14">
          {landingConfig ? (
            <section className="space-y-10 text-center">
              <div className="space-y-6">
                <div className="space-y-1 text-center">
                  <h1
                    className={`${montserratLight.className} mb-4 normal-case text-[64px] font-light leading-tight tracking-tight text-[rgb(114,112,111)]`}
                  >
                    {page.title}
                  </h1>
                  <h2 className="normal-case text-[28px] font-medium leading-tight text-[rgb(130,130,140)]">
                    {landingHeroSubheading}
                  </h2>
                  <p className="text-xl font-medium text-[rgb(130,130,140)]">{landingHeroSupportingLine}</p>
                </div>

                <SiteUsps />

                <div>
                  <Link
                    href={landingConfig.primaryCta.href}
                    className="inline-flex rounded-full bg-[#ff6f95] px-7 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(255,111,149,0.28)] transition hover:bg-[#ff4f80]"
                  >
                    {landingConfig.primaryCta.label}
                  </Link>
                </div>
              </div>

              <div className="space-y-6 overflow-hidden px-1">
                {landingGalleryRows.map((row, rowIndex) => (
                  <div key={`gallery-row-${rowIndex}`} className="overflow-hidden py-2">
                    <div
                      className={`flex w-max gap-6 ${rowIndex === 0 ? "animate-marquee" : "animate-marquee"}`}
                      style={{
                        animationDuration: rowIndex === 0 ? "34s" : "38s",
                        animationDirection: rowIndex === 0 ? "normal" : "reverse",
                      }}
                    >
                      {[...row, ...row].map((imageUrl, imageIndex) => (
                        <Link
                          key={`${imageUrl}-${rowIndex}-${imageIndex}`}
                          href={landingConfig.primaryCta.href}
                          aria-label={`${landingConfig.primaryCta.label}: ${page.title} gallery image ${imageIndex + 1}`}
                          className={`block shrink-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 shadow-sm transition hover:-translate-y-1 hover:border-zinc-300 hover:shadow-md ${
                            rowIndex === 0 ? "md:w-[300px]" : "md:w-[330px]"
                          } w-[240px]`}
                        >
                          <div className="aspect-[4/3] overflow-hidden bg-white p-4">
                            <Image
                              src={imageUrl}
                              alt={`${page.title} gallery image ${imageIndex + 1}`}
                              width={660}
                              height={520}
                              className="h-full w-full object-contain object-center"
                              priority={rowIndex === 0 && imageIndex < row.length}
                            />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Roc Candy</p>
              <h1 className="normal-case text-4xl font-semibold tracking-tight text-[rgb(114,112,111)] md:text-5xl">
                {page.title}
              </h1>
              {pageDescription ? <p className="max-w-3xl text-base text-zinc-600">{pageDescription}</p> : null}
              <SiteUsps className="pt-3" />
            </section>
          )}
          {landingConfig ? (
            page.bodyHtml ? (
              <article
                className="sr-only"
                dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
              />
            ) : null
          ) : (
            <article
              className="
                max-w-none space-y-4 text-base leading-relaxed text-zinc-700
                [&_p]:my-0
                [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:normal-case [&_h2]:tracking-tight [&_h2]:text-[rgb(114,112,111)]
                [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:normal-case [&_h3]:tracking-tight [&_h3]:text-[rgb(114,112,111)]
                [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6
                [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6
                [&_li]:my-1
                [&_strong]:font-semibold [&_strong]:text-zinc-900
                [&_a]:text-pink-500 [&_a]:underline-offset-2 hover:[&_a]:underline
              "
              dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
            />
          )}
          {faqSection ? <PageFaqSection heading={faqSection.heading} items={faqSection.items} /> : null}
        </div>
      </div>
    </main>
  );
}
