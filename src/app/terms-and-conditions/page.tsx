import { JsonLd } from "@/components/JsonLd";
import PublicSiteHeader from "@/components/PublicSiteHeader";
import TermsTree from "@/components/TermsTree";
import { getManagedSitePage } from "@/lib/sitePages";
import { buildAbsoluteUrl, buildMetadata, buildSchemaGraph, buildWebPageSchema } from "@/lib/seo";
import { getManagedTermsTree } from "@/lib/terms";
import type { Metadata } from "next";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const termsPage = await getManagedSitePage("terms-and-conditions");
  const metadata = buildMetadata({
    title: termsPage.seoTitle || "Terms and Conditions | Roc Candy",
    description:
      termsPage.metaDescription ||
      "Read Roc Candy's terms and conditions covering orders, production, delivery, payments, refunds, and website use.",
    path: "/terms-and-conditions",
    imagePath: termsPage.ogImageUrl || undefined,
    imageAlt: termsPage.title || "Terms and Conditions",
  });

  if (termsPage.canonicalUrl) {
    return {
      ...metadata,
      alternates: {
        canonical: /^https?:\/\//i.test(termsPage.canonicalUrl) ? termsPage.canonicalUrl : buildAbsoluteUrl(termsPage.canonicalUrl),
      },
    };
  }

  return metadata;
}

export default async function TermsPage() {
  const enquiriesEmail = process.env.ENQUIRIES_EMAIL?.trim() || "enquiries@roccandy.com.au";
  const enquiriesHref = `mailto:${enquiriesEmail}`;
  const termsItems = await getManagedTermsTree();
  const termsPage = await getManagedSitePage("terms-and-conditions");

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <JsonLd
        data={buildSchemaGraph([
          buildWebPageSchema({
            path: "/terms-and-conditions",
            name: termsPage.title || "Terms and Conditions",
            description:
              termsPage.metaDescription ||
              "Roc Candy terms and conditions covering orders, production, delivery, payments, refunds, and website use.",
          }),
        ])}
      />
      <div className="relative">
        <PublicSiteHeader enquiriesHref={enquiriesHref} />

        <div className="mx-auto max-w-4xl space-y-8 px-6 py-10 md:py-14">
          <section className="space-y-2">
            <h1
              className="site-page-title text-[rgb(114,112,111)]"
            >
              {termsPage.title || "Terms & Conditions"}
            </h1>
          </section>
          <TermsTree items={termsItems} />
        </div>
      </div>
    </main>
  );
}
