import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabasePublicClient } from "@/lib/supabase/public";

const BLOG_POSTS_TABLE = "blog_posts";
const BLOG_POSTS_SELECT =
  "id,slug,title,excerpt,cover_image_url,cover_image_alt,body_html,seo_title,meta_description,canonical_url,status,published_at,author_name,created_at,updated_at";

export type BlogPostStatus = "draft" | "published";

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  bodyHtml: string;
  seoTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  status: BlogPostStatus;
  publishedAt: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
};

type BlogPostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_image_url?: string | null;
  cover_image_alt?: string | null;
  body_html: string;
  seo_title?: string | null;
  meta_description?: string | null;
  canonical_url?: string | null;
  status: string;
  published_at?: string | null;
  author_name?: string | null;
  created_at: string;
  updated_at: string;
};

function isMissingBlogPostsTableError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("blog_posts") || normalized.includes("relation") || normalized.includes("schema cache");
}

export type BlogPostInput = {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  bodyHtml: string;
  seoTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  status: BlogPostStatus;
  publishedAt?: string | null;
  authorName?: string | null;
};

function mapBlogPost(row: BlogPostRow): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    coverImageUrl: row.cover_image_url ?? null,
    coverImageAlt: row.cover_image_alt ?? null,
    bodyHtml: row.body_html,
    seoTitle: row.seo_title ?? null,
    metaDescription: row.meta_description ?? null,
    canonicalUrl: row.canonical_url ?? null,
    status: row.status === "published" ? "published" : "draft",
    publishedAt: row.published_at ?? null,
    authorName: row.author_name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function makeBlogSlug(value: string) {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "post";
}

export async function resolveUniqueBlogSlug(slug: string, excludeId?: string | null, autoAdjust = false) {
  const baseSlug = makeBlogSlug(slug);
  let nextSlug = baseSlug;
  let suffix = 2;

  while (true) {
    let query = supabaseAdminClient.from(BLOG_POSTS_TABLE).select("id").eq("slug", nextSlug);
    if (excludeId) {
      query = query.neq("id", excludeId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return nextSlug;
    }
    if (!autoAdjust) {
      throw new Error("This blog URL is already in use.");
    }
    nextSlug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

export async function listPublishedBlogPosts() {
  const { data, error } = await supabasePublicClient
    .from(BLOG_POSTS_TABLE)
    .select(BLOG_POSTS_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingBlogPostsTableError(error.message)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as BlogPostRow[]).map(mapBlogPost);
}

export async function listAllBlogPosts() {
  const { data, error } = await supabaseAdminClient
    .from(BLOG_POSTS_TABLE)
    .select(BLOG_POSTS_SELECT)
    .order("status", { ascending: true })
    .order("published_at", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingBlogPostsTableError(error.message)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as BlogPostRow[]).map(mapBlogPost);
}

export async function getPublishedBlogPostBySlug(slug: string) {
  const { data, error } = await supabasePublicClient
    .from(BLOG_POSTS_TABLE)
    .select(BLOG_POSTS_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    if (isMissingBlogPostsTableError(error.message)) return null;
    throw new Error(error.message);
  }
  return data ? mapBlogPost(data as BlogPostRow) : null;
}

export async function getBlogPostById(id: string) {
  const { data, error } = await supabaseAdminClient
    .from(BLOG_POSTS_TABLE)
    .select(BLOG_POSTS_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (isMissingBlogPostsTableError(error.message)) return null;
    throw new Error(error.message);
  }
  return data ? mapBlogPost(data as BlogPostRow) : null;
}

export async function upsertBlogPost(input: BlogPostInput) {
  const now = new Date().toISOString();
  const payload = {
    slug: input.slug,
    title: input.title,
    excerpt: input.excerpt,
    cover_image_url: input.coverImageUrl ?? null,
    cover_image_alt: input.coverImageAlt ?? null,
    body_html: input.bodyHtml,
    seo_title: input.seoTitle ?? null,
    meta_description: input.metaDescription ?? null,
    canonical_url: input.canonicalUrl ?? null,
    status: input.status,
    published_at: input.status === "published" ? input.publishedAt ?? now : null,
    author_name: input.authorName?.trim() || "Roc Candy",
    updated_at: now,
  };

  const query = input.id
    ? supabaseAdminClient.from(BLOG_POSTS_TABLE).update(payload).eq("id", input.id)
    : supabaseAdminClient.from(BLOG_POSTS_TABLE).insert(payload);
  const { data, error } = await query.select(BLOG_POSTS_SELECT).single();

  if (error) throw new Error(error.message);
  return mapBlogPost(data as BlogPostRow);
}

export async function deleteBlogPost(id: string) {
  const { error } = await supabaseAdminClient.from(BLOG_POSTS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
