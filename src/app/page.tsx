import Image from "next/image";
import Link from "next/link";
import AutoplayOnViewVideo from "@/components/AutoplayOnViewVideo";
import { PageFaqSection } from "@/components/PageFaqSection";
import { JsonLd } from "@/components/JsonLd";
import PublicSiteHeader from "@/components/PublicSiteHeader";
import { SiteUsps } from "@/components/SiteUsps";
import { buildAbsoluteUrl, buildMetadata, buildSchemaGraph, buildWebPageSchema, stripHtml, truncateText } from "@/lib/seo";
import { buildDesignerPath } from "@/lib/designUrls";
import { buildFaqSchemaItems } from "@/lib/faqs";
import { DesignCtaModal } from "./DesignCtaModal";
import { Montserrat } from "next/font/google";
import { getManagedSitePage, getManagedSitePageFaqSection } from "@/lib/sitePages";
import type { Metadata } from "next";

const LEGACY_HOME_META_DESCRIPTION =
  "Personalised handmade rock candy for weddings, branded events, custom text gifts, and celebrations across Australia. Vegan, gluten free, dairy free, and delivered Australia wide.";
const DEFAULT_HOME_META_DESCRIPTION =
  "Personalised handmade rock candy for weddings, branded events and custom gifts. Vegan, gluten free and dairy free, delivered Australia-wide.";

function resolveHomeDescription(metaDescription: string | null, bodyHtml: string) {
  const normalizedMetaDescription = metaDescription?.trim() || null;
  if (normalizedMetaDescription && normalizedMetaDescription !== LEGACY_HOME_META_DESCRIPTION) {
    return normalizedMetaDescription;
  }
  return truncateText(stripHtml(bodyHtml), 155) || DEFAULT_HOME_META_DESCRIPTION;
}

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const homePage = await getManagedSitePage("home");
  const description = resolveHomeDescription(homePage.metaDescription, homePage.bodyHtml);

  const metadata = buildMetadata({
    title: homePage.seoTitle || "Personalised Rock Candy Australia | Wedding, Branded & Custom Candy",
    description,
    path: "/",
    imagePath: homePage.ogImageUrl || "/landing/home-feature-poster.jpg",
    imageAlt: homePage.title || "Roc Candy personalised rock candy",
  });

  if (homePage.canonicalUrl) {
    return {
      ...metadata,
      alternates: {
        canonical: /^https?:\/\//i.test(homePage.canonicalUrl) ? homePage.canonicalUrl : buildAbsoluteUrl(homePage.canonicalUrl),
      },
    };
  }

  return metadata;
}

const montserratLight = Montserrat({
  subsets: ["latin"],
});

const CANDY_OPTIONS = [
  { label: "Branded", href: buildDesignerPath({ orderType: "branded", categoryId: "branded" }), image: "/quote/subtypes/branded.jpg" },
  { label: "Both Names", href: buildDesignerPath({ orderType: "weddings", categoryId: "weddings-both-names" }), image: "/quote/subtypes/weddings-both-names.jpg" },
  { label: "Initials", href: buildDesignerPath({ orderType: "weddings", categoryId: "weddings-initials" }), image: "/quote/subtypes/weddings-initials.jpg" },
  { label: "Custom Text 1-6 Letters", href: buildDesignerPath({ orderType: "text", categoryId: "custom-1-6" }), image: "/quote/subtypes/custom-1-6.jpg" },
  { label: "Custom Text 7-14 Letters", href: buildDesignerPath({ orderType: "text", categoryId: "custom-7-14" }), image: "/quote/subtypes/custom-7-14.jpeg" },
  { label: "Pre-made candy", href: "/pre-made-candy", image: "/quote/subtypes/premade.jpg" },
];

export default async function Home() {
  const homePage = await getManagedSitePage("home");
  const faqSection = await getManagedSitePageFaqSection(homePage);
  const enquiriesEmail = process.env.ENQUIRIES_EMAIL?.trim() || "enquiries@roccandy.com.au";
  const enquiriesHref = `mailto:${enquiriesEmail}`;
  const homeDescription = resolveHomeDescription(homePage.metaDescription, homePage.bodyHtml);
  return (
    <main className="min-h-screen text-zinc-900">
      <JsonLd
        data={buildSchemaGraph([
          buildWebPageSchema({
            path: "/",
            name: homePage.title || "Personalised Rock Candy Australia",
            description: homeDescription,
          }),
          ...(faqSection
            ? [
                {
                  "@type": "FAQPage",
                  "@id": `${buildAbsoluteUrl("/")}#faq`,
                  mainEntity: buildFaqSchemaItems(faqSection.items),
                },
              ]
            : []),
        ])}
      />
      <div className="relative">
        <PublicSiteHeader enquiriesHref={enquiriesHref} logoPriority />

        <div className="landing-bg landing-bg-home -mt-8 pt-8">
          <div className="relative mx-auto max-w-6xl space-y-20 px-6 py-10 md:py-14">

          <section className="grid items-center gap-20 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="space-y-6">
              <div className="space-y-1 text-center">
                <h1
                  className={`${montserratLight.className} mb-4 normal-case text-[60px] font-normal leading-tight tracking-tight text-[rgb(114,112,111)]`}
                  style={{ fontWeight: 450 }}
                >
                  {homePage.title || "Personalised Rock Candy"}
                </h1>
                {homePage.bodyHtml ? (
                  <article
                    className="mx-auto max-w-3xl space-y-1 text-center text-[rgb(130,130,140)] [&_h2]:normal-case [&_h2]:text-[26px] [&_h2]:font-medium [&_h2]:leading-[1.05] [&_p]:text-xl [&_p]:font-medium [&_p]:leading-[1.2]"
                    dangerouslySetInnerHTML={{ __html: homePage.bodyHtml }}
                  />
                ) : null}
              </div>

              <SiteUsps />

              <div id="design" className="pt-6">
                <DesignCtaModal />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {CANDY_OPTIONS.map((option) => (
                <Link
                  key={option.label}
                  href={option.href}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-300"
                >
                  <div className="relative aspect-[3/2] w-full overflow-hidden bg-zinc-100">
                    <Image
                      src={option.image}
                      alt={option.label}
                      fill
                      sizes="(max-width: 768px) 50vw, 20vw"
                      className="object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-white/90" />
                  </div>
                  <div className="px-2 py-2 text-xs font-semibold text-[rgb(114,112,111)]">{option.label}</div>
                </Link>
              ))}
            </div>
          </section>

          <section className="grid gap-5 md:grid-cols-2">
            <div className="aspect-square overflow-hidden">
              <AutoplayOnViewVideo
                src="/landing/home-feature-web.mp4"
                poster="/landing/home-feature-poster.jpg"
                className="h-full w-full object-cover"
                eager
              />
            </div>

            <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm md:p-8">
              <h2 className="normal-case text-3xl font-semibold tracking-tight text-[rgb(114,112,111)]">
                Custom Rock Candy
              </h2>
              <p className="mt-4 normal-case text-[13px] leading-relaxed text-zinc-600 md:text-[14px]">
                At Roc Candy, we believe every sweet moment deserves a personalised touch. Whether you&apos;re planning a
                wedding, launching a product, or simply want to treat someone special, our handcrafted rock candy is
                made to impress. From{" "}
                <Link href="/design/wedding-candy" className="text-[#ff6f95] underline-offset-2 hover:text-[#ff4f80] hover:underline">
                  wedding candy
                </Link>{" "}
                tailored to your big day, to{" "}
                <Link href="/design/custom-text-candy" className="text-[#ff6f95] underline-offset-2 hover:text-[#ff4f80] hover:underline">
                  custom text candy
                </Link>{" "}
                that celebrates life&apos;s milestones, we turn your words and designs into delicious works of art -
                all made with premium ingredients right here in Australia. Explore our full range, including{" "}
                <Link href="/design/branded-logo-candy" className="text-[#ff6f95] underline-offset-2 hover:text-[#ff4f80] hover:underline">
                  branded candy
                </Link>{" "}
                that showcases your logo in every bite, and our colourful selection of{" "}
                <Link href="/pre-made-candy" className="text-[#ff6f95] underline-offset-2 hover:text-[#ff4f80] hover:underline">
                  pre-made candy
                </Link>{" "}
                ready to enjoy anytime. Whether it&apos;s for a party, corporate gift, or just because, Roc Candy
                makes every occasion a little sweeter.
              </p>
            </article>

            <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm md:p-8">
              <h2 className="normal-case text-3xl font-semibold tracking-tight text-[rgb(114,112,111)]">
                A little about us
              </h2>
              <p className="mt-4 normal-case text-[13px] leading-relaxed text-zinc-600 md:text-[14px]">
                We are very happy Australian artisan confectioners specialising in personalised and custom handmade
                rock candies for all types of occasions. Established in 1999, our rock candy treats are vegan,
                gluten-free and dairy-free. Each piece of candy is meticulously handcrafted with the finest
                ingredients, sourced from trusted suppliers, 98% of which are Australian. We offer Free Delivery
                Australia-wide, delivering our delicious rock candy to all major cities, including Sydney, Melbourne,
                Brisbane, Perth, Adelaide, Canberra and Hobart.
              </p>
            </article>

            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <Image
                src="/about-carousel/about-1.jpg"
                alt="Handmade Roc Candy pieces"
                width={1200}
                height={1200}
                className="h-full min-h-[300px] w-full object-cover"
              />
            </div>
          </section>

          <section id="contact" className="rounded-3xl border border-zinc-200 bg-zinc-900 p-8 text-white">
            <div className="grid gap-6 md:grid-cols-[1.1fr,0.9fr] md:items-center">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">Contact</p>
                <h2 className="text-2xl font-semibold">Tell us about your event or brand</h2>
                <p className="text-sm text-white/80">
                  We will help with timeline, color selection, and delivery planning. Email us or call to lock in a
                  production slot.
                </p>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-white/60">Email</p>
                  <a href={enquiriesHref} className="font-semibold">
                    {enquiriesEmail}
                  </a>
                </div>
                <div>
                  <p className="text-white/60">Phone</p>
                  <p className="font-semibold">0414 519 211</p>
                </div>
                <div>
                  <p className="text-white/60">Location</p>
                  <p className="font-semibold">Australia wide delivery</p>
                </div>
              </div>
            </div>
          </section>

          {faqSection ? (
            <PageFaqSection
              heading={faqSection.heading}
              items={faqSection.items}
              className="mx-auto max-w-4xl"
            />
          ) : null}

          </div>
        </div>
      </div>
    </main>
  );
}
