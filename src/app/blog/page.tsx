import { JsonLd } from "@/components/JsonLd";
import { PageFaqSection } from "@/components/PageFaqSection";
import PublicSiteHeader from "@/components/PublicSiteHeader";
import { SiteUsps } from "@/components/SiteUsps";
import { buildFaqSchemaItems } from "@/lib/faqs";
import { buildAbsoluteUrl, buildMetadata, buildSchemaGraph, buildWebPageSchema, stripHtml, truncateText } from "@/lib/seo";
import { getManagedSitePage, getManagedSitePageFaqSection } from "@/lib/sitePages";
import type { Metadata } from "next";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const blogPage = await getManagedSitePage("blog");
  const description =
    blogPage.metaDescription ||
    truncateText(stripHtml(blogPage.bodyHtml), 160) ||
    "Read the Roc Candy blog for personalised rock candy ideas, event inspiration, and product updates.";

  const metadata = buildMetadata({
    title: blogPage.seoTitle || "Roc Candy Blog | Personalised Rock Candy Ideas, Events & News",
    description,
    path: "/blog",
    imagePath: blogPage.ogImageUrl || "/landing/home-feature-poster.jpg",
    imageAlt: blogPage.title || "Roc Candy blog",
  });

  if (blogPage.canonicalUrl) {
    return {
      ...metadata,
      alternates: {
        canonical: /^https?:\/\//i.test(blogPage.canonicalUrl) ? blogPage.canonicalUrl : buildAbsoluteUrl(blogPage.canonicalUrl),
      },
    };
  }

  return metadata;
}

export default async function BlogPage() {
  const blogPage = await getManagedSitePage("blog");
  const faqSection = await getManagedSitePageFaqSection(blogPage);
  const enquiriesEmail = process.env.ENQUIRIES_EMAIL?.trim() || "enquiries@roccandy.com.au";
  const enquiriesHref = `mailto:${enquiriesEmail}`;
  const description =
    blogPage.metaDescription ||
    truncateText(stripHtml(blogPage.bodyHtml), 160) ||
    "Read the Roc Candy blog for personalised rock candy ideas, event inspiration, and product updates.";

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <JsonLd
        data={buildSchemaGraph([
          buildWebPageSchema({
            path: "/blog",
            name: blogPage.title || "Roc Candy Blog",
            description,
          }),
          ...(faqSection
            ? [
                {
                  "@type": "FAQPage",
                  "@id": `${buildAbsoluteUrl("/blog")}#faq`,
                  mainEntity: buildFaqSchemaItems(faqSection.items),
                },
              ]
            : []),
        ])}
      />
      <div className="relative">
        <PublicSiteHeader enquiriesHref={enquiriesHref} />

        <div className="site-page-frame site-page-stack mx-auto max-w-4xl">
          <section className="site-page-header-tight">
            <h1
              className="site-page-title text-[rgb(114,112,111)]"
            >
              {blogPage.title || "Roc Candy Blog"}
            </h1>
            {(blogPage.heroSubheading || blogPage.heroSupportingLine) ? (
              <p className="text-base text-zinc-600 md:text-lg">
                {[blogPage.heroSubheading, blogPage.heroSupportingLine].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            <SiteUsps className="site-usp-offset" />
          </section>

          <article
            className="site-rich-content text-base leading-relaxed"
            dangerouslySetInnerHTML={{ __html: blogPage.bodyHtml }}
          />
          {faqSection ? <PageFaqSection heading={faqSection.heading} items={faqSection.items} /> : null}
        </div>
      </div>
    </main>
  );
}
