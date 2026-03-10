import HeaderNav from "@/components/HeaderNav";
import HeaderMenu from "@/components/HeaderMenu";
import LandingTopLinksBar from "@/components/LandingTopLinksBar";
import FaqAccordion from "@/components/FaqAccordion";
import { JsonLd } from "@/components/JsonLd";
import { getFaqContentItems } from "@/lib/faqs";
import { buildAbsoluteUrl, buildMetadata, buildSchemaGraph, buildWebPageSchema, stripHtml, truncateText } from "@/lib/seo";
import { getManagedSitePage } from "@/lib/sitePages";
import { Montserrat } from "next/font/google";
import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const montserratLight = Montserrat({
  subsets: ["latin"],
  weight: ["300"],
});

export async function generateMetadata(): Promise<Metadata> {
  const faqPage = await getManagedSitePage("faq");
  const description =
    faqPage.metaDescription ||
    truncateText(stripHtml(faqPage.bodyHtml), 160) ||
    "Answers to common questions about Roc Candy personalised rock candy.";

  const metadata = buildMetadata({
    title: faqPage.seoTitle || "FAQ | Personalised Rock Candy Questions | Roc Candy",
    description,
    path: "/faq",
    imagePath: faqPage.ogImageUrl || undefined,
    imageAlt: faqPage.title || "Frequently Asked Questions",
  });

  if (faqPage.canonicalUrl) {
    return {
      ...metadata,
      alternates: {
        canonical: /^https?:\/\//i.test(faqPage.canonicalUrl) ? faqPage.canonicalUrl : buildAbsoluteUrl(faqPage.canonicalUrl),
      },
    };
  }

  return metadata;
}

export default async function FaqPage() {
  const faqPage = await getManagedSitePage("faq");
  const enquiriesEmail = process.env.ENQUIRIES_EMAIL?.trim() || "enquiries@roccandy.com.au";
  const enquiriesHref = `mailto:${enquiriesEmail}`;
  const faqItems = await getFaqContentItems();
  const description =
    faqPage.metaDescription ||
    truncateText(stripHtml(faqPage.bodyHtml), 160) ||
    "Answers to common questions about ordering, delivery, ingredients, lead times, and custom rock candy designs.";
  const faqSchemaItems = faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: truncateText(stripHtml(item.answerHtml), 5000),
    },
  }));

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <JsonLd
        data={buildSchemaGraph([
          buildWebPageSchema({
            path: "/faq",
            name: faqPage.title || "Frequently Asked Questions",
            description,
          }),
          {
            "@type": "FAQPage",
            "@id": `${buildAbsoluteUrl("/faq")}#faq`,
            mainEntity: faqSchemaItems,
          },
        ])}
      />
      <div className="relative">
        <div className="sticky top-0 z-40 w-full border-b border-white/60 bg-white/90 backdrop-blur shadow-[0_4px_10px_rgba(63,63,70,0.36)]">
          <LandingTopLinksBar />
          <div className="mx-auto w-full max-w-6xl px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Link href="/" className="shrink-0">
                <img src="/branding/logo-gold.svg" alt="Roc Candy" className="h-20 md:h-24" data-header-logo />
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
          <section className="space-y-2">
            <h1
              className={`${montserratLight.className} normal-case text-4xl font-light leading-tight tracking-tight text-[rgb(114,112,111)] md:text-5xl`}
            >
              {faqPage.title || "Frequently Asked Questions"}
            </h1>
          </section>
          {faqPage.bodyHtml ? (
            <article
              className="max-w-none text-base leading-relaxed text-zinc-700 [&_a]:font-semibold [&_a]:text-[#ff6f95] hover:[&_a]:text-[#ff4f80]"
              dangerouslySetInnerHTML={{ __html: faqPage.bodyHtml }}
            />
          ) : null}
          <FaqAccordion items={faqItems} />
        </div>
      </div>
    </main>
  );
}
