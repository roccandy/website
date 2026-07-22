import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageFaqSection } from "@/components/PageFaqSection";
import { JsonLd } from "@/components/JsonLd";
import PublicSiteHeader from "@/components/PublicSiteHeader";
import { LANDING_CTA_ARROW_CLASS, LANDING_CTA_BUTTON_BASE_CLASS } from "@/components/landingCtaClasses";
import { StickyLandingCta } from "@/components/StickyLandingCta";
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
import { EnquiryForm } from "@/components/EnquiryForm";
import { ContextualEnquiryCta } from "@/components/ContextualEnquiryCta";
import { GoogleReviews } from "@/components/GoogleReviews";
import {
  buildEnquiryHref,
  ENQUIRY_INTERESTS,
  type EnquiryInterest,
} from "@/lib/enquiry";

type LandingPageConfig = {
  intro: string;
  detail: string;
  defaultGalleryImageUrls?: string[];
  primaryCta?: { label: string; href: string } | null;
  enquiryCta?: {
    interest: EnquiryInterest;
    productContext: string;
    linkLabel: string;
    heading: string;
    description: string;
  };
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
    enquiryCta: {
      interest: "wedding",
      productContext: "Personalised wedding candy",
      linkLabel: "Ask about wedding candy",
      heading: "Need help planning your wedding candy?",
      description:
        "Tell us your date, guest numbers, colours, and packaging ideas. We can help with quantities, timing, and the best way to get started.",
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
    enquiryCta: {
      interest: "branded",
      productContext: "Branded or logo candy",
      linkLabel: "Ask about branded candy",
      heading: "Want to check your logo or campaign requirements?",
      description:
        "Send us your logo, required date, approximate quantity, and event details. We can review the artwork and help you choose the right format.",
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
    enquiryCta: {
      interest: "custom-text",
      productContext: "Personalised custom text candy",
      linkLabel: "Ask about custom text candy",
      heading: "Not sure what text, quantity, or packaging will work?",
      description:
        "Tell us the wording, occasion, timing, and approximate quantity. We can help shape the idea before you begin your design.",
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
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
};

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeEnquirySource(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  try {
    const parsed = new URL(value, "https://roccandy.com.au");
    if (parsed.hostname !== "roccandy.com.au" && parsed.hostname !== "www.roccandy.com.au") {
      return fallback;
    }
    return parsed.pathname.slice(0, 300) || fallback;
  } catch {
    return fallback;
  }
}

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

export default async function ManagedContentPage({ params, searchParams }: ManagedPageProps) {
  const page = await loadManagedPage(params);
  if (!page) notFound();

  const resolvedSearchParams = await searchParams;
  const requestedInterest = firstSearchValue(resolvedSearchParams?.interest)?.trim().toLowerCase();
  const initialInterest = ENQUIRY_INTERESTS.includes(requestedInterest as EnquiryInterest)
    ? (requestedInterest as EnquiryInterest)
    : "general";
  const productContext =
    firstSearchValue(resolvedSearchParams?.product)?.trim().slice(0, 200) ||
    firstSearchValue(resolvedSearchParams?.context)?.trim().slice(0, 200) ||
    null;
  const pageHref = buildManagedSitePageHref(page.slug);
  const enquirySourcePage = normalizeEnquirySource(
    firstSearchValue(resolvedSearchParams?.source)?.trim(),
    pageHref,
  );
  const enquiriesEmail = process.env.ENQUIRIES_EMAIL?.trim() || "enquiries@roccandy.com.au";
  const enquiriesHref = `mailto:${enquiriesEmail}`;
  const pageDescription =
    page.metaDescription ||
    truncateText(stripHtml(page.bodyHtml), 160) ||
    page.title;
  const faqSection = await getManagedSitePageFaqSection(page);
  const landingConfig = LANDING_PAGE_CONFIG[page.slug] ?? null;
  const landingEnquiryHref =
    landingConfig?.enquiryCta
      ? buildEnquiryHref({
          interest: landingConfig.enquiryCta.interest,
          productContext: landingConfig.enquiryCta.productContext,
          sourcePage: pageHref,
        })
      : null;
  const landingHeroSubheading = landingConfig
    ? page.heroSubheading || landingConfig.intro
    : null;
  const landingHeroSupportingLine = landingConfig
    ? page.heroSupportingLine || landingConfig.detail
    : null;
  const showLandingBackdrop = landingConfig !== null && page.slug !== "contact";
  const showWatercolourTopBackdrop = page.slug === "contact";
  const isContactPage = page.slug === "contact";
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

        <div
          className={
            showLandingBackdrop
              ? "landing-bg landing-bg-faded site-watercolour-hero-mobile-offset site-about-mobile-bg -mt-8 pt-8"
              : showWatercolourTopBackdrop
                ? "site-watercolour-top-bg -mt-8 pt-8"
              : "-mt-8 pt-8"
          }
        >
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
                  {!isContactPage ? (
                    <>
                      <h2 className="site-landing-hero-subtitle text-[rgb(130,130,140)]">
                        {landingHeroSubheading}
                      </h2>
                      <p className="site-landing-hero-supporting-line text-[rgb(130,130,140)]">
                        {landingHeroSupportingLine}
                      </p>
                    </>
                  ) : null}
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
                    {landingConfig.enquiryCta && landingEnquiryHref ? (
                      <Link
                        href={landingEnquiryHref}
                        className="mt-1 inline-flex min-h-11 items-center justify-center px-3 text-sm font-semibold text-[#c74e78] underline decoration-[#e9a4bb] underline-offset-4 transition hover:text-[#a83b61] focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6f95]"
                      >
                        Prefer some help first? {landingConfig.enquiryCta.linkLabel}
                      </Link>
                    ) : null}
                  </div>
                ) : null}
                {page.slug === "design/branded-logo-candy" ? <GoogleReviews className="w-full" /> : null}
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
            page.bodyHtml && !isContactPage ? (
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
          {landingConfig?.enquiryCta ? (
            <ContextualEnquiryCta
              interest={landingConfig.enquiryCta.interest}
              productContext={landingConfig.enquiryCta.productContext}
              sourcePage={pageHref}
              heading={landingConfig.enquiryCta.heading}
              description={landingConfig.enquiryCta.description}
              buttonLabel={landingConfig.enquiryCta.linkLabel}
            />
          ) : null}
          {page.slug === "contact" ? (
            <EnquiryForm
              initialInterest={initialInterest}
              productContext={productContext}
              sourcePage={enquirySourcePage}
            />
          ) : null}
          {faqSection ? (
            <div className={landingConfig ? "site-landing-faq-splash" : ""}>
              <PageFaqSection heading={faqSection.heading} items={faqSection.items} />
            </div>
          ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
