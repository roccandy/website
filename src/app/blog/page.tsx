import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { PageFaqSection } from "@/components/PageFaqSection";
import PublicSiteHeader from "@/components/PublicSiteHeader";
import { SiteUsps } from "@/components/SiteUsps";
import { listPublishedBlogPosts } from "@/lib/blog";
import { buildFaqSchemaItems } from "@/lib/faqs";
import { buildAbsoluteUrl, buildMetadata, buildSchemaGraph, buildWebPageSchema, stripHtml, truncateText } from "@/lib/seo";
import { getManagedSitePage, getManagedSitePageFaqSection } from "@/lib/sitePages";

export const revalidate = 300;

function formatPublishDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

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
  const [blogPage, posts] = await Promise.all([getManagedSitePage("blog"), listPublishedBlogPosts()]);
  const faqSection = await getManagedSitePageFaqSection(blogPage);
  const enquiriesEmail = process.env.ENQUIRIES_EMAIL?.trim() || "enquiries@roccandy.com.au";
  const enquiriesHref = `mailto:${enquiriesEmail}`;
  const description =
    blogPage.metaDescription ||
    truncateText(stripHtml(blogPage.bodyHtml), 160) ||
    "Read the Roc Candy blog for personalised rock candy ideas, event inspiration, and product updates.";

  return (
    <main className="landing-bg min-h-screen bg-white text-zinc-900">
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

        <div className="site-page-frame site-page-stack mx-auto max-w-6xl">
          <section className="site-page-header-tight text-center">
            <h1 className="site-page-title text-[rgb(114,112,111)]">{blogPage.title || "Roc Candy Blog"}</h1>
            {(blogPage.heroSubheading || blogPage.heroSupportingLine) ? (
              <div className="site-hero-copy mx-auto max-w-3xl text-center text-[rgb(130,130,140)]">
                {blogPage.heroSubheading ? <h2>{blogPage.heroSubheading}</h2> : null}
                {blogPage.heroSupportingLine ? <p>{blogPage.heroSupportingLine}</p> : null}
              </div>
            ) : null}
            <SiteUsps className="site-usp-offset" />
          </section>

          {blogPage.bodyHtml ? (
            <article className="site-rich-content text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: blogPage.bodyHtml }} />
          ) : null}

          <section className="space-y-4">
            {posts.length === 0 ? (
              <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
                <h2 className="site-section-title text-[rgb(114,112,111)]">Articles coming soon</h2>
                <p className="mt-3 text-sm text-zinc-600">
                  The blog system is live, but no posts are published yet.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {posts.map((post) => (
                  <article
                    key={post.id}
                    className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {post.coverImageUrl ? (
                      <Link href={`/blog/${post.slug}`} className="block">
                        <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
                          <Image
                            src={post.coverImageUrl}
                            alt={post.coverImageAlt || post.title}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                            className="object-cover"
                          />
                        </div>
                      </Link>
                    ) : null}
                    <div className="space-y-3 p-5">
                      {formatPublishDate(post.publishedAt) ? (
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          {formatPublishDate(post.publishedAt)}
                        </p>
                      ) : null}
                      <h2 className="site-subsection-title text-[rgb(114,112,111)]">
                        <Link href={`/blog/${post.slug}`} className="hover:text-[#ff6f95]">
                          {post.title}
                        </Link>
                      </h2>
                      <p className="text-sm leading-relaxed text-zinc-600">{post.excerpt}</p>
                      <Link
                        href={`/blog/${post.slug}`}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-[#ff6f95] transition hover:text-[#ff4f80]"
                      >
                        Read article
                        <span aria-hidden="true">›</span>
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {faqSection ? <PageFaqSection heading={faqSection.heading} items={faqSection.items} /> : null}
        </div>
      </div>
    </main>
  );
}
