import AboutPhotoCarousel from "@/components/AboutPhotoCarousel";
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
          <div className="mx-auto max-w-4xl space-y-6 px-6 py-10 md:py-14">
            <h1
              className={`${montserratLight.className} normal-case text-4xl font-light leading-tight tracking-tight text-[rgb(114,112,111)] md:text-5xl`}
            >
              {aboutPage.title || "A Little About Us"}
            </h1>
            <SiteUsps />

            <AboutPhotoCarousel />
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
              dangerouslySetInnerHTML={{ __html: aboutPage.bodyHtml }}
            />
            {faqSection ? <PageFaqSection heading={faqSection.heading} items={faqSection.items} /> : null}
          </div>
        </div>
      </div>
    </main>
  );
}
