import { JsonLd } from "@/components/JsonLd";
import { PageFaqSection } from "@/components/PageFaqSection";
import PublicSiteHeader from "@/components/PublicSiteHeader";
import { SiteUsps } from "@/components/SiteUsps";
import { buildFaqSchemaItems } from "@/lib/faqs";
import { buildAbsoluteUrl, buildMetadata, buildSchemaGraph, buildWebPageSchema, stripHtml, truncateText } from "@/lib/seo";
import { getManagedSitePage, getManagedSitePageFaqSection } from "@/lib/sitePages";
import { Montserrat } from "next/font/google";
import type { Metadata } from "next";

export const revalidate = 300;

const montserratLight = Montserrat({
  subsets: ["latin"],
  weight: ["300"],
});

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

        <div className="mx-auto max-w-4xl space-y-6 px-6 py-10 md:py-14">
          <section className="space-y-2">
            <h1
              className={`${montserratLight.className} normal-case text-4xl font-light leading-tight tracking-tight text-[rgb(114,112,111)] md:text-5xl`}
            >
              {blogPage.title || "Roc Candy Blog"}
            </h1>
            {(blogPage.heroSubheading || blogPage.heroSupportingLine) ? (
              <p className="text-base text-zinc-600 md:text-lg">
                {[blogPage.heroSubheading, blogPage.heroSupportingLine].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            <SiteUsps className="pt-2" />
          </section>

          <article
            className="
              max-w-none space-y-5 text-base leading-relaxed text-zinc-700
              [&_p]:my-0
              [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:normal-case [&_h2]:tracking-tight [&_h2]:text-[rgb(114,112,111)]
              [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:normal-case [&_h3]:tracking-tight [&_h3]:text-[rgb(114,112,111)]
              [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6
              [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6
              [&_li]:my-1
              [&_strong]:font-semibold [&_strong]:text-zinc-900
              [&_a]:font-semibold [&_a]:text-[#ff6f95] hover:[&_a]:text-[#ff4f80]
            "
            dangerouslySetInnerHTML={{ __html: blogPage.bodyHtml }}
          />
          {faqSection ? <PageFaqSection heading={faqSection.heading} items={faqSection.items} /> : null}
        </div>
      </div>
    </main>
  );
}
