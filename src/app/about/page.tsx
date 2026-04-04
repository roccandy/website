import AboutPhotoCarousel from "@/components/AboutPhotoCarousel";
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
  const aboutPage = await getManagedSitePage("about");
  const description =
    aboutPage.metaDescription ||
    truncateText(stripHtml(aboutPage.bodyHtml), 160) ||
    "Learn about Roc Candy, Australian artisan confectioners creating handmade personalised rock candy.";

  const metadata = buildMetadata({
    title: aboutPage.seoTitle || "About Roc Candy | Handmade Personalised Rock Candy Since 1999",
    description,
    path: "/about",
    imagePath: aboutPage.ogImageUrl || "/about-carousel/about-1.jpg",
    imageAlt: aboutPage.title || "About Roc Candy handmade personalised rock candy",
  });

  if (aboutPage.canonicalUrl) {
    return {
      ...metadata,
      alternates: {
        canonical: /^https?:\/\//i.test(aboutPage.canonicalUrl) ? aboutPage.canonicalUrl : buildAbsoluteUrl(aboutPage.canonicalUrl),
      },
    };
  }

  return metadata;
}

export default async function AboutPage() {
  const aboutPage = await getManagedSitePage("about");
  const faqSection = await getManagedSitePageFaqSection(aboutPage);
  const enquiriesEmail = process.env.ENQUIRIES_EMAIL?.trim() || "enquiries@roccandy.com.au";
  const enquiriesHref = `mailto:${enquiriesEmail}`;
  const description =
    aboutPage.metaDescription ||
    truncateText(stripHtml(aboutPage.bodyHtml), 160) ||
    "Learn about Roc Candy, Australian artisan confectioners creating handmade personalised rock candy.";

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <JsonLd
        data={buildSchemaGraph([
          buildWebPageSchema({
            path: "/about",
            name: aboutPage.title || "About Roc Candy",
            description,
          }),
          ...(faqSection
            ? [
                {
                  "@type": "FAQPage",
                  "@id": `${buildAbsoluteUrl("/about")}#faq`,
                  mainEntity: buildFaqSchemaItems(faqSection.items),
                },
              ]
            : []),
        ])}
      />
      <div className="relative">
        <PublicSiteHeader enquiriesHref={enquiriesHref} />

        <div className="about-bg">
          <div className="site-page-frame site-page-stack mx-auto max-w-4xl">
            <h1
              className="site-page-title text-[rgb(114,112,111)]"
            >
              {aboutPage.title || "A Little About Us"}
            </h1>
            <SiteUsps />

            <AboutPhotoCarousel />
            <article
              className="site-rich-content text-base leading-relaxed"
              dangerouslySetInnerHTML={{ __html: aboutPage.bodyHtml }}
            />
            {faqSection ? <PageFaqSection heading={faqSection.heading} items={faqSection.items} /> : null}
          </div>
        </div>
      </div>
    </main>
  );
}
