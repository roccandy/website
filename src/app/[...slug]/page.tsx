import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageFaqSection } from "@/components/PageFaqSection";
import { JsonLd } from "@/components/JsonLd";
import PublicSiteHeader from "@/components/PublicSiteHeader";
import { LANDING_CTA_ARROW_CLASS, LANDING_CTA_BUTTON_BASE_CLASS, StickyLandingCta } from "@/components/StickyLandingCta";
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
import { buildLandingGalleryRows } from "@/lib/landingGallery";

type LandingPageConfig = {
  intro: string;
  detail: string;
  defaultGalleryImageUrls?: string[];
  primaryCta?: { label: string; href: string } | null;
};

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
      label: "Design Your Candy",
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
      label: "Design Your Candy",
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
      label: "Design Your Candy",
      href: buildDesignerPath({ orderType: "text" }),
    },
  },
  contact: {
    intro: "Talk to our team",
    detail: "email, call, or get help with your order",
    primaryCta: null,
  },
};

const BODY_HTML_CLASS = `
  site-rich-content
  text-base leading-relaxed
`;

function resolveGalleryImages(primary: string[], fallback: string[] = []) {
  const base = primary.length > 0 ? primary : fallback;
  if (base.length === 0) return [];

  const resolved = [...base];
  while (resolved.length < 4) {
    resolved.push(base[resolved.length % base.length]);
  }

  return resolved;
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
    ? resolveGalleryImages(page.galleryImageUrls, landingConfig.defaultGalleryImageUrls ?? [])
    : [];
  const landingGalleryRows = landingConfig ? buildLandingGalleryRows(page.slug, landingGalleryImages) : [];

  return (
    <main className={`${!landingConfig ? "landing-bg" : ""} min-h-screen bg-white text-zinc-900`}>
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

        <div className={landingConfig ? "landing-bg landing-bg-faded -mt-8 pt-8" : ""}>
        <div className="site-page-frame site-page-stack mx-auto max-w-5xl">
          {landingConfig ? (
            <section className="site-landing-hero-section text-center">
              <div className="site-landing-hero-stack">
                {/* Landing-page heading block. Edit the matching `landingHero*` values in spacing.ts. */}
                <div className="site-landing-hero-heading site-landing-hero-copy site-hero-copy text-center">
                  <h1
                    className="site-hero-title site-landing-hero-title text-[rgb(114,112,111)]"
                  >
                    {page.title}
                  </h1>
                  <h2 className="site-landing-hero-subtitle text-[rgb(130,130,140)]">
                    {landingHeroSubheading}
                  </h2>
                  <p className="site-landing-hero-supporting-line text-[rgb(130,130,140)]">
                    {landingHeroSupportingLine}
                  </p>
                </div>

                <div className="site-landing-usp-wrap">
                  <SiteUsps />
                </div>

                {landingConfig.primaryCta ? (
                  <div className="site-landing-cta-wrap">
                    <StickyLandingCta>
                      <Link
                        href={landingConfig.primaryCta.href}
                        className={`${LANDING_CTA_BUTTON_BASE_CLASS} bg-[#ff6f95] shadow-[0_10px_20px_rgba(255,111,149,0.28)] transition hover:bg-[#ff4f80]`}
                      >
                        <span className="site-primary-cta-label">{landingConfig.primaryCta.label}</span>
                        <span className="site-primary-cta-arrow" aria-hidden="true">
                          <svg viewBox="0 0 12 12" className={LANDING_CTA_ARROW_CLASS} fill="none">
                            <path d="M3 2.25 7.5 6 3 9.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </Link>
                    </StickyLandingCta>
                  </div>
                ) : null}
              </div>

              {/* Landing-page scrolling gallery. Edit `landingGallery*` values in spacing.ts. */}
              {landingConfig.primaryCta && landingGalleryRows.length > 0 ? (
                <div className="site-landing-gallery-shell overflow-hidden">
                  <div className="site-landing-gallery">
                  {landingGalleryRows.map((row, rowIndex) => (
                    <div key={`gallery-row-${rowIndex}`} className="site-landing-gallery-row overflow-hidden">
                      <div
                        className={`site-landing-gallery-track flex w-max ${rowIndex === 0 ? "animate-marquee" : "animate-marquee"}`}
                        style={{
                          animationDuration: rowIndex === 0 ? "34s" : "38s",
                          animationDirection: rowIndex === 0 ? "normal" : "reverse",
                        }}
                      >
                        {[0, 1].map((cloneIndex) => (
                          <div
                            key={`gallery-clone-${rowIndex}-${cloneIndex}`}
                            className="site-landing-gallery-clone flex shrink-0"
                            aria-hidden={cloneIndex === 1}
                          >
                            {row.map((imageUrl, imageIndex) => (
                              <Link
                                key={`${imageUrl}-${rowIndex}-${cloneIndex}-${imageIndex}`}
                                href={landingConfig.primaryCta!.href}
                                aria-label={`${landingConfig.primaryCta!.label}: ${page.title} gallery image ${imageIndex + 1}`}
                                className={`block shrink-0 overflow-hidden rounded-2xl bg-white/90 shadow-sm ring-1 ring-zinc-200/80 transition hover:-translate-y-1 hover:ring-zinc-300 hover:shadow-md ${
                                  rowIndex === 0 ? "md:w-[300px]" : "md:w-[330px]"
                                } w-[240px]`}
                                tabIndex={cloneIndex === 1 ? -1 : undefined}
                              >
                                <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
                                  <Image
                                    src={imageUrl}
                                    alt={`${page.title} gallery image ${imageIndex + 1}`}
                                    fill
                                    sizes={rowIndex === 0 ? "(min-width: 768px) 300px, 240px" : "(min-width: 768px) 330px, 240px"}
                                    className="object-cover object-center"
                                    priority={rowIndex === 0 && cloneIndex === 0 && imageIndex < row.length}
                                  />
                                </div>
                              </Link>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : (
            <section className="site-page-header">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Roc Candy</p>
              <h1 className="site-page-title text-[rgb(114,112,111)]">
                {page.title}
              </h1>
              {pageDescription ? <p className="max-w-3xl text-base text-zinc-600">{pageDescription}</p> : null}
              <SiteUsps className="site-usp-offset" />
            </section>
          )}
          {landingConfig ? (
            page.bodyHtml ? (
              <>
                {/* Landing-page body content between gallery and FAQs. Full-width, no card treatment. */}
                <section className="site-landing-body-content text-left">
                  <article className={BODY_HTML_CLASS} dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />
                </section>
              </>
            ) : null
          ) : (
            <article
              className={BODY_HTML_CLASS}
              dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
            />
          )}
          {page.slug === "contact" ? (
            <section className="grid gap-4 md:grid-cols-2">
              <a
                href={enquiriesHref}
                className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Email</p>
                <h2 className="site-subsection-title mt-2 text-[rgb(114,112,111)]">Send an enquiry</h2>
                <p className="mt-2 text-sm text-zinc-600">{enquiriesEmail}</p>
              </a>
              <a
                href="tel:0414519211"
                className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Phone</p>
                <h2 className="site-subsection-title mt-2 text-[rgb(114,112,111)]">Call Roc Candy</h2>
                <p className="mt-2 text-sm text-zinc-600">0414 519 211</p>
              </a>
              <Link
                href="/design"
                className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Design</p>
                <h2 className="site-subsection-title mt-2 text-[rgb(114,112,111)]">Start your candy design</h2>
                <p className="mt-2 text-sm text-zinc-600">Choose wedding, text, or branded candy and submit your order online.</p>
              </Link>
              <Link
                href="/faqs"
                className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">FAQs</p>
                <h2 className="site-subsection-title mt-2 text-[rgb(114,112,111)]">Common questions</h2>
                <p className="mt-2 text-sm text-zinc-600">Lead times, delivery, ingredients, and ordering answers in one place.</p>
              </Link>
            </section>
          ) : null}
          {faqSection ? <PageFaqSection heading={faqSection.heading} items={faqSection.items} /> : null}
        </div>
        </div>
      </div>
    </main>
  );
}
