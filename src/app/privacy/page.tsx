import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { PageFaqSection } from "@/components/PageFaqSection";
import PublicSiteHeader from "@/components/PublicSiteHeader";
import { buildFaqSchemaItems } from "@/lib/faqs";
import { getManagedSitePage, getManagedSitePageFaqSection } from "@/lib/sitePages";
import { buildAbsoluteUrl, buildMetadata, buildSchemaGraph, buildWebPageSchema, stripHtml, truncateText } from "@/lib/seo";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const privacyPage = await getManagedSitePage("privacy");
  const description =
    privacyPage.metaDescription ||
    truncateText(stripHtml(privacyPage.bodyHtml), 160) ||
    "Read Roc Candy's privacy policy covering personal information, enquiries, orders, and website use.";

  const metadata = buildMetadata({
    title: privacyPage.seoTitle || `${privacyPage.title || "Privacy Policy"} | Roc Candy`,
    description,
    path: "/privacy",
    imagePath: privacyPage.ogImageUrl || undefined,
    imageAlt: privacyPage.title || "Privacy Policy",
  });

  if (privacyPage.canonicalUrl) {
    return {
      ...metadata,
      alternates: {
        canonical: /^https?:\/\//i.test(privacyPage.canonicalUrl) ? privacyPage.canonicalUrl : buildAbsoluteUrl(privacyPage.canonicalUrl),
      },
    };
  }

  return metadata;
}

export default async function PrivacyPage() {
  const privacyPage = await getManagedSitePage("privacy");
  const faqSection = await getManagedSitePageFaqSection(privacyPage);
  const enquiriesEmail = process.env.ENQUIRIES_EMAIL?.trim() || "enquiries@roccandy.com.au";
  const enquiriesHref = `mailto:${enquiriesEmail}`;
  const description =
    truncateText(stripHtml(privacyPage.bodyHtml), 160) ||
    "Read Roc Candy's privacy policy covering personal information, enquiries, orders, and website use.";

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <JsonLd
        data={buildSchemaGraph([
          buildWebPageSchema({
            path: "/privacy",
            name: privacyPage.title || "Privacy Policy",
            description,
          }),
          ...(faqSection
            ? [
                {
                  "@type": "FAQPage",
                  "@id": `${buildAbsoluteUrl("/privacy")}#faq`,
                  mainEntity: buildFaqSchemaItems(faqSection.items),
                },
              ]
            : []),
        ])}
      />
      <div className="relative">
        <PublicSiteHeader enquiriesHref={enquiriesHref} />

        <div className="mx-auto max-w-4xl space-y-6 px-6 py-10 md:py-14">
          <h1
            className="site-page-title text-[rgb(114,112,111)]"
          >
            {privacyPage.title || "Privacy Policy"}
          </h1>
          <article
            className="site-rich-content text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: privacyPage.bodyHtml || "<p>Add privacy policy content in admin.</p>" }}
          />
          {faqSection ? <PageFaqSection heading={faqSection.heading} items={faqSection.items} /> : null}
        </div>
      </div>
    </main>
  );
}
