import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import PublicSiteHeader from "@/components/PublicSiteHeader";
import { getPublishedBlogPostBySlug, listPublishedBlogPosts } from "@/lib/blog";
import { buildAbsoluteUrl, buildMetadata, buildSchemaGraph, buildWebPageSchema, truncateText } from "@/lib/seo";

export const revalidate = 300;

type PageProps = {
  params:
    | Promise<{
        slug?: string;
      }>
    | {
        slug?: string;
      };
};

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

async function resolveSlugParam(params: PageProps["params"]) {
  const resolved = await params;
  return typeof resolved?.slug === "string" ? resolved.slug : undefined;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const slug = await resolveSlugParam(params);
  const post = slug ? await getPublishedBlogPostBySlug(slug) : null;
  if (!post) {
    return buildMetadata({
      title: "Blog | Roc Candy",
      description: "Read the Roc Candy blog.",
      path: "/blog",
    });
  }

  const metadata = buildMetadata({
    title: post.seoTitle || `${post.title} | Roc Candy Blog`,
    description: post.metaDescription || truncateText(post.excerpt, 160) || post.title,
    path: `/blog/${post.slug}`,
    imagePath: post.coverImageUrl || "/landing/home-feature-poster.jpg",
    imageAlt: post.coverImageAlt || post.title,
  });

  if (post.canonicalUrl) {
    return {
      ...metadata,
      alternates: {
        canonical: /^https?:\/\//i.test(post.canonicalUrl) ? post.canonicalUrl : buildAbsoluteUrl(post.canonicalUrl),
      },
    };
  }

  return metadata;
}

export default async function BlogArticlePage({ params }: PageProps) {
  const slug = await resolveSlugParam(params);
  const post = slug ? await getPublishedBlogPostBySlug(slug) : null;
  if (!post) notFound();

  const enquiriesEmail = process.env.ENQUIRIES_EMAIL?.trim() || "enquiries@roccandy.com.au";
  const enquiriesHref = `mailto:${enquiriesEmail}`;
  const publishedLabel = formatPublishDate(post.publishedAt);
  const relatedPosts = (await listPublishedBlogPosts()).filter((candidate) => candidate.id !== post.id).slice(0, 3);

  return (
    <main className="landing-bg min-h-screen bg-white text-zinc-900">
      <JsonLd
        data={buildSchemaGraph([
          buildWebPageSchema({
            path: `/blog/${post.slug}`,
            name: post.title,
            description: post.metaDescription || post.excerpt || post.title,
          }),
          {
            "@type": "BlogPosting",
            "@id": `${buildAbsoluteUrl(`/blog/${post.slug}`)}#article`,
            headline: post.title,
            description: post.metaDescription || post.excerpt || post.title,
            datePublished: post.publishedAt || post.createdAt,
            dateModified: post.updatedAt,
            author: {
              "@type": "Organization",
              name: post.authorName || "Roc Candy",
            },
            image: post.coverImageUrl ? [post.coverImageUrl] : undefined,
            mainEntityOfPage: buildAbsoluteUrl(`/blog/${post.slug}`),
          },
        ])}
      />

      <div className="relative">
        <PublicSiteHeader enquiriesHref={enquiriesHref} />

        <div className="site-page-frame site-page-stack mx-auto max-w-4xl">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#ff6f95] transition hover:text-[#ff4f80]"
          >
            <span aria-hidden="true">←</span>
            Back to blog
          </Link>

          <section className="space-y-4 text-center">
            {publishedLabel ? (
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{publishedLabel}</p>
            ) : null}
            <h1 className="site-page-title text-[rgb(114,112,111)]">{post.title}</h1>
            {post.excerpt ? <p className="mx-auto max-w-3xl text-base text-zinc-600">{post.excerpt}</p> : null}
          </section>

          {post.coverImageUrl ? (
            <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
              <div className="relative aspect-[16/9] overflow-hidden bg-zinc-100">
                <Image
                  src={post.coverImageUrl}
                  alt={post.coverImageAlt || post.title}
                  fill
                  sizes="(max-width: 1280px) 100vw, 960px"
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          ) : null}

          <article className="site-rich-content text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />

          {relatedPosts.length > 0 ? (
            <section className="space-y-4">
              <h2 className="site-section-title text-[rgb(114,112,111)]">More from the blog</h2>
              <div className="grid gap-4 md:grid-cols-3">
                {relatedPosts.map((relatedPost) => (
                  <Link
                    key={relatedPost.id}
                    href={`/blog/${relatedPost.slug}`}
                    className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        {formatPublishDate(relatedPost.publishedAt) ?? "Article"}
                      </p>
                      <h3 className="site-subsection-title text-[rgb(114,112,111)]">{relatedPost.title}</h3>
                      <p className="text-sm text-zinc-600">{relatedPost.excerpt}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
