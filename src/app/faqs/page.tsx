import FaqAccordion from "@/components/FaqAccordion";
import { JsonLd } from "@/components/JsonLd";
import PublicSiteHeader from "@/components/PublicSiteHeader";
import { SiteUsps } from "@/components/SiteUsps";
import { getFaqContentItems } from "@/lib/faqs";
import { buildAbsoluteUrl, buildMetadata, buildSchemaGraph, buildWebPageSchema, stripHtml, truncateText } from "@/lib/seo";
import { getManagedSitePage } from "@/lib/sitePages";
import type { Metadata } from "next";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const faqPage = await getManagedSitePage("faq");
  const description =
    faqPage.metaDescription ||
    truncateText(stripHtml(faqPage.bodyHtml), 160) ||
    "Answers to common questions about Roc Candy personalised rock candy.";

  const metadata = buildMetadata({
    title: faqPage.seoTitle || "FAQ | Personalised Rock Candy Questions | Roc Candy",
    description,
    path: "/faqs",
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

export default async function FaqsPage() {
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
            path: "/faqs",
            name: faqPage.title || "Frequently Asked Questions",
            description,
          }),
          {
            "@type": "FAQPage",
            "@id": `${buildAbsoluteUrl("/faqs")}#faq`,
            mainEntity: faqSchemaItems,
          },
        ])}
      />
      <div className="relative">
        <PublicSiteHeader enquiriesHref={enquiriesHref} />

        <div className="site-page-frame site-page-stack mx-auto max-w-4xl">
          <section className="site-page-header-tight">
            <h1
              className="site-page-title text-[rgb(114,112,111)]"
            >
              {faqPage.title || "Frequently Asked Questions"}
            </h1>
            <SiteUsps className="site-usp-offset" />
          </section>
          {faqPage.bodyHtml ? (
            <article
              className="site-rich-content text-base leading-relaxed"
              dangerouslySetInnerHTML={{ __html: faqPage.bodyHtml }}
            />
          ) : null}
          <section className="site-faq-stack">
            <h2 className="site-section-title text-[rgb(114,112,111)]">Common Questions</h2>
            <FaqAccordion items={faqItems} />
          </section>
        </div>
      </div>
    </main>
  );
}
