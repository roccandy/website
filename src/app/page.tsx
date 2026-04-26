import Image from "next/image";
import Link from "next/link";
import AutoplayOnViewVideo from "@/components/AutoplayOnViewVideo";
import { AnimatedHeading } from "@/components/AnimatedHeading";
import { PageFaqSection } from "@/components/PageFaqSection";
import { JsonLd } from "@/components/JsonLd";
import PublicSiteHeader from "@/components/PublicSiteHeader";
import { ScrollReveal } from "@/components/ScrollReveal";
import { SiteUsps } from "@/components/SiteUsps";
import { buildAbsoluteUrl, buildMetadata, buildSchemaGraph, buildWebPageSchema, stripHtml, truncateText } from "@/lib/seo";
import { buildFaqSchemaItems } from "@/lib/faqs";
import { DesignCtaModal } from "./DesignCtaModal";
import { getManagedSitePage, getManagedSitePageFaqSection, parseHomeCandyOptions } from "@/lib/sitePages";
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

export default async function Home() {
  const homePage = await getManagedSitePage("home");
  const faqSection = await getManagedSitePageFaqSection(homePage);
  const candyOptions = parseHomeCandyOptions(homePage.galleryImageUrls);
  const enquiriesEmail = process.env.ENQUIRIES_EMAIL?.trim() || "enquiries@roccandy.com.au";
  const enquiriesHref = `mailto:${enquiriesEmail}`;
  const homeDescription = resolveHomeDescription(homePage.metaDescription, homePage.bodyHtml);
  return (
    <main className="min-h-screen bg-white text-zinc-900">
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
        <PublicSiteHeader enquiriesHref={enquiriesHref} logoPriority dataQuoteHeader />

        <div className="landing-bg landing-bg-home site-watercolour-hero-mobile-offset -mt-8 pt-8">
          <div className="site-page-frame relative mx-auto max-w-6xl">

          <section className="site-home-hero-section site-home-hero-grid grid items-center lg:grid-cols-[1.2fr,0.8fr]">
            <div className="site-home-hero-column">
              <div className="site-home-hero-heading text-center">
                <AnimatedHeading
                  as="h1"
                  className="site-hero-title site-home-hero-title site-heading-motion-manual text-[rgb(114,112,111)]"
                >
                  {homePage.title || "Personalised Rock Candy"}
                </AnimatedHeading>
                {homePage.bodyHtml ? (
                  <article
                    className="site-hero-copy site-home-hero-copy mx-auto max-w-3xl text-center text-[rgb(130,130,140)]"
                    dangerouslySetInnerHTML={{ __html: homePage.bodyHtml }}
                  />
                ) : null}
              </div>

              <div className="site-home-usp-wrap">
                <SiteUsps />
              </div>

              <div id="design" className="site-home-cta-wrap">
                <DesignCtaModal />
              </div>
            </div>

            <div className="site-home-option-grid grid grid-cols-2 md:grid-cols-3">
              {candyOptions.map((option) => (
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

          <div className="site-home-below-hero-stack site-page-stack-large">
          <ScrollReveal delayMs={40}>
          <section className="site-home-secondary-grid grid md:grid-cols-2">
            <div className="site-home-media-card aspect-square overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <AutoplayOnViewVideo
                src="/landing/home-feature-web.mp4"
                poster="/landing/home-feature-poster.jpg"
                className="h-full w-full object-cover"
                eager
              />
            </div>

            <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm md:p-8">
              <h2 className="site-section-title text-[rgb(114,112,111)]">
                Custom Rock Candy
              </h2>
              <p className="site-home-card-copy normal-case text-[13px] leading-relaxed text-zinc-600 md:text-[14px]">
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
              <h2 className="site-section-title text-[rgb(114,112,111)]">
                A little about us
              </h2>
              <p className="site-home-card-copy normal-case text-[13px] leading-relaxed text-zinc-600 md:text-[14px]">
                We are very happy Australian artisan confectioners specialising in personalised and custom handmade
                rock candies for all types of occasions. Established in 1999, our rock candy treats are vegan,
                gluten-free and dairy-free. Each piece of candy is meticulously handcrafted with the finest
                ingredients, sourced from trusted suppliers, 98% of which are Australian. We offer Free Delivery
                Australia-wide, delivering our delicious rock candy to all major cities, including Sydney, Melbourne,
                Brisbane, Perth, Adelaide, Canberra and Hobart.
              </p>
            </article>

            <div className="site-home-media-card overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <Image
                src="/about-carousel/about-1.jpg"
                alt="Handmade Roc Candy pieces"
                width={1200}
                height={1200}
                className="h-full min-h-[300px] w-full object-cover"
              />
            </div>
          </section>
          </ScrollReveal>

          <div className="site-home-bottom-splash">
            <ScrollReveal delayMs={120}>
            <section id="contact" className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
              <div className="site-home-contact-grid grid md:grid-cols-[1.1fr,0.9fr] md:items-center">
                <div className="site-home-contact-stack">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Contact</p>
                  <h2 className="site-subsection-title text-zinc-900">Tell us about your event or brand</h2>
                  <p className="text-sm text-zinc-600">
                    We will help with timeline, color selection, and delivery planning. Email us or call to lock in a
                    production slot.
                  </p>
                  <div>
                    <Link
                      href="/contact"
                      className="site-primary-cta site-landing-cta-button inline-flex rounded-full bg-[#ff6f95] text-sm font-semibold text-white shadow-[0_10px_20px_rgba(255,111,149,0.28)] transition hover:bg-[#ff4f80]"
                    >
                      <span className="site-primary-cta-label">Contact Us</span>
                      <span className="site-primary-cta-arrow" aria-hidden="true">
                        <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" fill="none">
                          <path d="M3 2.25 7.5 6 3 9.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </Link>
                  </div>
                </div>
                <div className="site-home-contact-stack text-sm">
                  <div>
                    <p className="text-zinc-500">Email</p>
                    <a href={enquiriesHref} className="font-semibold text-zinc-900">
                      {enquiriesEmail}
                    </a>
                  </div>
                  <div>
                    <p className="text-zinc-500">Phone</p>
                    <p className="font-semibold text-zinc-900">0414 519 211</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Location</p>
                    <p className="font-semibold text-zinc-900">Australia wide delivery</p>
                  </div>
                </div>
              </div>
            </section>
            </ScrollReveal>

            {faqSection ? (
              <ScrollReveal delayMs={180}>
                <div className="site-home-faq-divider">
                  <PageFaqSection
                    heading={faqSection.heading}
                    items={faqSection.items}
                  />
                </div>
              </ScrollReveal>
            ) : null}
          </div>
          </div>

          </div>
        </div>
      </div>
    </main>
  );
}
