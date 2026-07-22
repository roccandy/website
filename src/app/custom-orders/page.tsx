import type { Metadata } from "next";
import Link from "next/link";
import { EnquiryForm } from "@/components/EnquiryForm";
import { JsonLd } from "@/components/JsonLd";
import PublicSiteHeader from "@/components/PublicSiteHeader";
import { SiteUsps } from "@/components/SiteUsps";
import { GoogleReviews } from "@/components/GoogleReviews";
import { buildMetadata, buildSchemaGraph, buildWebPageSchema } from "@/lib/seo";

const PAGE_PATH = "/custom-orders";
const PAGE_TITLE = "Custom Candy Orders";
const PAGE_DESCRIPTION =
  "Have an idea for personalised rock candy? Tell Roc Candy about your event, colours, packaging or timing and we will help shape the right custom order.";

export const metadata: Metadata = buildMetadata({
  title: "Custom Candy Orders Australia | Personalised Rock Candy Help | Roc Candy",
  description: PAGE_DESCRIPTION,
  path: PAGE_PATH,
  imagePath: "/landing/home-feature-poster.jpg",
  imageAlt: "Custom candy orders from Roc Candy",
});

const helpItems = [
  "Candy for a celebration, event, campaign or gift",
  "Colours and styling to suit your theme",
  "Branded candy and logo artwork questions",
  "Names, initials or custom text",
  "Packaging and quantity guidance",
  "Delivery timing and urgent-order advice",
];

export default function CustomOrdersPage() {
  const enquiriesEmail = process.env.ENQUIRIES_EMAIL?.trim() || "enquiries@roccandy.com.au";

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <JsonLd
        data={buildSchemaGraph([
          buildWebPageSchema({ path: PAGE_PATH, name: PAGE_TITLE, description: PAGE_DESCRIPTION }),
          {
            "@type": "Service",
            name: PAGE_TITLE,
            description: PAGE_DESCRIPTION,
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
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Roc Candy</p>
            <h1 className="site-page-title mt-3 text-[rgb(114,112,111)]">Custom Candy Orders</h1>
            <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-zinc-600">Have an idea? We&apos;ll help bring it to life.</p>
            <p className="mx-auto mt-3 max-w-3xl text-base leading-7 text-zinc-600">
              Not every custom candy order starts with a finished design. If you have an event coming up, a colour theme to match, a branding idea, a packaging question, or simply need help deciding what will work, tell us what you have in mind.
            </p>
            <SiteUsps className="mt-7" />
          </section>

          <GoogleReviews />

          <section className="grid gap-5 md:grid-cols-2">
            <div className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e85f8c]">Ready to create?</p>
              <h2 className="site-subsection-title mt-2 text-[rgb(114,112,111)]">Design your candy online</h2>
              <p className="mt-3 leading-7 text-zinc-600">If you know the style you would like, use our designer to choose your candy type, colours, flavours and packaging.</p>
              <Link href="/design" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[#ff6f95] px-5 text-sm font-semibold text-white transition hover:bg-[#ff4f80] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6f95] focus-visible:ring-offset-2">
                Design Your Candy
              </Link>
            </div>
            <div className="rounded-3xl border border-[#f3d4df] bg-[#fff8fa] p-7 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e85f8c]">Need a hand?</p>
              <h2 className="site-subsection-title mt-2 text-[rgb(114,112,111)]">Talk through a custom order</h2>
              <p className="mt-3 leading-7 text-zinc-600">If you are exploring an idea, working to a deadline, or need advice before you begin, send us an enquiry below. We&apos;ll help you find the right direction.</p>
              <a href="#enquiry-form" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-[#ff6f95] bg-white px-5 text-sm font-semibold text-[#c74e78] transition hover:bg-[#fff2f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6f95] focus-visible:ring-offset-2">
                Ask About a Custom Order
              </a>
            </div>
          </section>

          <section className="grid gap-8 rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm md:grid-cols-[1fr_1.1fr] md:p-9">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">How we can help</p>
              <h2 className="site-subsection-title mt-2 text-[rgb(114,112,111)]">A helpful starting point for your idea</h2>
              <p className="mt-3 leading-7 text-zinc-600">This page is for orders that need a little more guidance. If you already know exactly what you need, the design pages remain the quickest way to get started.</p>
            </div>
            <ul className="grid gap-3 text-sm leading-6 text-zinc-700 sm:grid-cols-2">
              {helpItems.map((item) => <li key={item} className="flex gap-2"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#ff6f95]" aria-hidden="true" />{item}</li>)}
            </ul>
          </section>

          <section className="rounded-3xl bg-[#f6f5f2] p-7 md:p-9">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">How it works</p>
            <ol className="mt-5 grid gap-6 md:grid-cols-3">
              {[
                ["1", "Tell us about your idea", "Include your event date, approximate quantity and anything you already know."],
                ["2", "We help shape the right option", "We will review the details and help you choose a suitable candy direction."],
                ["3", "Order with confidence", "Once the direction is clear, you can complete your order knowing it fits your needs."],
              ].map(([number, heading, copy]) => <li key={number} className="flex gap-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ff6f95] text-sm font-bold text-white">{number}</span><div><h2 className="font-semibold text-zinc-800">{heading}</h2><p className="mt-1 text-sm leading-6 text-zinc-600">{copy}</p></div></li>)}
            </ol>
          </section>

          <section>
            <div className="mb-6 max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e85f8c]">Custom order enquiry</p><h2 className="site-subsection-title mt-2 text-[rgb(114,112,111)]">Tell us what you have in mind</h2><p className="mt-3 leading-7 text-zinc-600">Reference images, logos and artwork can be attached. The more detail you can share, the better we can guide you.</p></div>
            <EnquiryForm productContext="Custom candy order" sourcePage={PAGE_PATH} />
          </section>

          <section className="text-center"><h2 className="site-subsection-title text-[rgb(114,112,111)]">Prefer to start with a specific style?</h2><div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-3 text-sm font-semibold text-[#c74e78] underline decoration-[#e9a4bb] underline-offset-4"><Link href="/design/wedding-candy">Wedding Candy</Link><Link href="/design/branded-logo-candy">Branded Candy</Link><Link href="/design/custom-text-candy">Custom Text Candy</Link><Link href="/pre-made-candy">Pre-Made Candy</Link></div></section>
        </div>
      </div>
    </main>
  );
}
