import type { Metadata } from "next";
import Link from "next/link";
import { DesignCtaModal } from "@/app/DesignCtaModal";
import { EnquiryForm } from "@/components/EnquiryForm";
import { GoogleReviews } from "@/components/GoogleReviews";
import { JsonLd } from "@/components/JsonLd";
import PublicSiteHeader from "@/components/PublicSiteHeader";
import { SiteUsps } from "@/components/SiteUsps";
import { buildAbsoluteUrl, buildMetadata, buildSchemaGraph, buildWebPageSchema } from "@/lib/seo";
import { getManagedSitePage } from "@/lib/sitePages";

const PAGE_PATH = "/custom-orders";
const DEFAULT_PAGE_TITLE = "Custom Candy Orders";
const DEFAULT_PAGE_DESCRIPTION =
  "Have an idea for personalised rock candy? Tell Roc Candy about your event, colours, packaging or timing and we will help shape the right custom order.";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getManagedSitePage("custom-orders");

  const metadata = buildMetadata({
    title: page.seoTitle || "Custom Candy Orders Australia | Personalised Rock Candy Help | Roc Candy",
    description: page.metaDescription || DEFAULT_PAGE_DESCRIPTION,
    path: PAGE_PATH,
    imagePath: page.ogImageUrl || "/landing/home-feature-poster.jpg",
    imageAlt: page.title || "Custom candy orders from Roc Candy",
  });

  if (page.canonicalUrl) {
    return {
      ...metadata,
      alternates: {
        canonical: /^https?:\/\//i.test(page.canonicalUrl) ? page.canonicalUrl : buildAbsoluteUrl(page.canonicalUrl),
      },
    };
  }

  return metadata;
}

export default async function CustomOrdersPage() {
  const [page, enquiriesEmail] = await Promise.all([
    getManagedSitePage("custom-orders"),
    Promise.resolve(process.env.ENQUIRIES_EMAIL?.trim() || "enquiries@roccandy.com.au"),
  ]);
  const title = page.title || DEFAULT_PAGE_TITLE;
  const description = page.metaDescription || DEFAULT_PAGE_DESCRIPTION;

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <JsonLd
        data={buildSchemaGraph([
          buildWebPageSchema({ path: PAGE_PATH, name: title, description }),
          {
            "@type": "Service",
            name: title,
            description,
            areaServed: { "@type": "Country", name: "Australia" },
            provider: { "@id": "https://roccandy.com.au/#organization" },
            url: "https://roccandy.com.au/custom-orders",
          },
        ])}
      />
      <PublicSiteHeader enquiriesHref={`mailto:${enquiriesEmail}`} />
      <div className="site-watercolour-top-bg -mt-8 pt-8">
        <div className="site-page-frame mx-auto max-w-5xl space-y-12 pb-16">
          <section className="mx-auto max-w-4xl text-center">
            <h1 className="site-page-title text-[rgb(114,112,111)]">{title}</h1>
            {page.heroSubheading ? (
              <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-zinc-600">{page.heroSubheading}</p>
            ) : null}
            {page.heroSupportingLine ? (
              <p className="mx-auto mt-3 max-w-3xl text-base leading-7 text-zinc-600">{page.heroSupportingLine}</p>
            ) : null}
            <SiteUsps className="mt-7" />
            <GoogleReviews showBorders={false} transparent className="mt-2" />
          </section>

          <section className="grid gap-5 md:grid-cols-2">
            <div className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e85f8c]">Ready to create?</p>
              <h2 className="site-subsection-title mt-2 text-[rgb(114,112,111)]">Design your candy online</h2>
              <p className="mt-3 leading-7 text-zinc-600">If you know the style you would like, use our designer to choose your candy type, colours, flavours and packaging.</p>
              <div className="mt-6">
                <DesignCtaModal />
              </div>
            </div>
            <div className="rounded-3xl border border-[#f3d4df] bg-[#fff8fa] p-7 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e85f8c]">Need a hand?</p>
              <div
                className="prose mt-3 max-w-none text-zinc-600 prose-p:my-0 prose-p:leading-7 prose-ul:my-3 prose-ul:space-y-2 prose-li:leading-6 prose-li::marker:text-[#ff6f95]"
                dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
              />
              <a href="#enquiry-form" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-[#ff6f95] bg-white px-5 text-sm font-semibold text-[#c74e78] transition hover:bg-[#fff2f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6f95] focus-visible:ring-offset-2">
                Ask About a Custom Order
              </a>
            </div>
          </section>

          <section className="rounded-3xl bg-[#f6f5f2] p-7 md:p-9">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">How it works</p>
            <ol className="mt-5 grid gap-6 md:grid-cols-3">
              {[
                ["1", "Tell us about your idea", "Include your event date, approx quantities and any relevant artwork. The more detail, the better we can guide you."],
                ["2", "We help shape the right option", "We will review the details and help you choose a suitable candy direction."],
                ["3", "Order with confidence", "Once the direction is clear, you can complete your order knowing it fits your needs."],
              ].map(([number, heading, copy]) => <li key={number} className="flex gap-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ff6f95] text-sm font-bold text-white">{number}</span><div><h2 className="font-semibold text-zinc-800">{heading}</h2><p className="mt-1 text-sm leading-6 text-zinc-600">{copy}</p></div></li>)}
            </ol>
          </section>

          <section>
            <EnquiryForm productContext="Custom candy order" sourcePage={PAGE_PATH} />
          </section>

          <section className="text-center"><h2 className="site-subsection-title text-[rgb(114,112,111)]">Prefer to start with a specific style?</h2><div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-3 text-sm font-semibold text-[#c74e78] underline decoration-[#e9a4bb] underline-offset-4"><Link href="/design/wedding-candy">Wedding Candy</Link><Link href="/design/branded-logo-candy">Branded Candy</Link><Link href="/design/custom-text-candy">Custom Text Candy</Link><Link href="/pre-made-candy">Pre-Made Candy</Link></div></section>
        </div>
      </div>
    </main>
  );
}
