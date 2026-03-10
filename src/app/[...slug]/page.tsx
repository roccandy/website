import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import HeaderNav from "@/components/HeaderNav";
import HeaderMenu from "@/components/HeaderMenu";
import LandingTopLinksBar from "@/components/LandingTopLinksBar";
import { JsonLd } from "@/components/JsonLd";
import {
  buildAbsoluteUrl,
  buildMetadata,
  buildSchemaGraph,
  buildWebPageSchema,
  stripHtml,
  truncateText,
} from "@/lib/seo";
import { buildManagedPageHref, getManagedPageByPath } from "@/lib/managedPages";

type LandingPageConfig = {
  eyebrow: string;
  imageSrc: string;
  imageAlt: string;
  highlights: string[];
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  footerCtaText?: string;
};

const LANDING_PAGE_CONFIG: Record<string, LandingPageConfig> = {
  "design/wedding-candy": {
    eyebrow: "Wedding Landing Page",
    imageSrc: "/quote/subtypes/weddings-initials.jpg",
    imageAlt: "Wedding candy by Roc Candy",
    highlights: ["Personalised names or initials", "Colour-matched to your event", "Australia-wide delivery"],
    primaryCta: {
      label: "Start Wedding Candy Design",
      href: "/design?type=weddings&subtype=weddings-initials",
    },
    secondaryCta: {
      label: "Contact Roc Candy",
      href: "/contact",
    },
    footerCtaText: "Need both names instead? You can switch options once the designer opens.",
  },
  "design/branded-logo-candy": {
    eyebrow: "Branded Landing Page",
    imageSrc: "/quote/subtypes/branded.jpg",
    imageAlt: "Branded logo candy by Roc Candy",
    highlights: ["Great for launches and events", "Brand colour matching", "Designed for gifts and activations"],
    primaryCta: {
      label: "Start Branded Candy Design",
      href: "/design?type=branded",
    },
    secondaryCta: {
      label: "Contact Roc Candy",
      href: "/contact",
    },
    footerCtaText: "If you have artwork or branding requirements, contact us before ordering.",
  },
  "design/custom-text-candy": {
    eyebrow: "Custom Text Landing Page",
    imageSrc: "/quote/subtypes/custom-1-6.jpg",
    imageAlt: "Custom text candy by Roc Candy",
    highlights: ["Names, initials, and short words", "Ideal for gifts and parties", "Fast path into the designer"],
    primaryCta: {
      label: "Start Custom Text Candy Design",
      href: "/design?type=text&subtype=custom-1-6",
    },
    secondaryCta: {
      label: "Contact Roc Candy",
      href: "/contact",
    },
    footerCtaText: "Longer text options are available once you enter the designer.",
  },
};

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

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
  const page = await getManagedPageByPath(path);
  if (!page || !page.isPublished) return null;
  return page;
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
    path: buildManagedPageHref(page.slugPath),
    imagePath: page.ogImageUrl || "/landing/home-feature-poster.png",
    imageAlt: page.title,
    noIndex: !page.isIndexable,
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
  const pageHref = buildManagedPageHref(page.slugPath);
  const pageDescription =
    page.metaDescription ||
    truncateText(stripHtml(page.bodyHtml), 160) ||
    page.title;
  const landingConfig = LANDING_PAGE_CONFIG[page.slugPath] ?? null;

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <JsonLd
        data={buildSchemaGraph([
          buildWebPageSchema({
            path: pageHref,
            name: page.title,
            description: pageDescription,
          }),
        ])}
      />
      <div className="relative">
        <div className="sticky top-0 z-40 w-full border-b border-white/60 bg-white/90 backdrop-blur shadow-[0_4px_10px_rgba(63,63,70,0.36)]">
          <LandingTopLinksBar />
          <div className="mx-auto w-full max-w-6xl px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Link href="/" className="shrink-0">
                <Image
                  src="/branding/logo-gold.svg"
                  alt="Roc Candy"
                  width={240}
                  height={96}
                  className="h-20 w-auto md:h-24"
                  data-header-logo
                />
              </Link>
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

        <div className="mx-auto max-w-4xl space-y-6 px-6 py-10 md:py-14">
          {landingConfig ? (
            <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-[linear-gradient(180deg,rgba(255,248,251,0.98),rgba(255,255,255,1))] shadow-sm">
              <div className="grid gap-6 p-6 md:grid-cols-[1.1fr,0.9fr] md:p-8">
                <div className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">{landingConfig.eyebrow}</p>
                  <h1 className="normal-case text-4xl font-semibold tracking-tight text-[rgb(114,112,111)] md:text-5xl">
                    {page.title}
                  </h1>
                  {pageDescription ? <p className="max-w-2xl text-base text-zinc-600">{pageDescription}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    {landingConfig.highlights.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-[#ffd3df] bg-white px-3 py-1 text-xs font-semibold text-[#ff6f95]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <Link
                      href={landingConfig.primaryCta.href}
                      className="rounded-full bg-[#ff6f95] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#ff4f80]"
                    >
                      {landingConfig.primaryCta.label}
                    </Link>
                    {landingConfig.secondaryCta ? (
                      <Link
                        href={landingConfig.secondaryCta.href}
                        className="rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300"
                      >
                        {landingConfig.secondaryCta.label}
                      </Link>
                    ) : null}
                  </div>
                  {landingConfig.footerCtaText ? (
                    <p className="text-sm text-zinc-500">{landingConfig.footerCtaText}</p>
                  ) : null}
                </div>
                <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                  <Image
                    src={landingConfig.imageSrc}
                    alt={landingConfig.imageAlt}
                    width={900}
                    height={700}
                    className="h-full w-full object-cover"
                    priority
                  />
                </div>
              </div>
            </section>
          ) : (
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Roc Candy</p>
              <h1 className="normal-case text-4xl font-semibold tracking-tight text-[rgb(114,112,111)] md:text-5xl">
                {page.title}
              </h1>
              {pageDescription ? <p className="max-w-3xl text-base text-zinc-600">{pageDescription}</p> : null}
            </section>
          )}
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
          {landingConfig ? (
            <section className="rounded-3xl border border-zinc-200 bg-zinc-900 p-6 text-white shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">Ready to order?</p>
                  <h2 className="text-2xl font-semibold">Move from research to design</h2>
                  <p className="text-sm text-white/75">
                    Use the designer to choose colours, text, packaging, and pricing for this type of candy.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={landingConfig.primaryCta.href}
                    className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
                  >
                    {landingConfig.primaryCta.label}
                  </Link>
                  {landingConfig.secondaryCta ? (
                    <Link
                      href={landingConfig.secondaryCta.href}
                      className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      {landingConfig.secondaryCta.label}
                    </Link>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
