"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminToast, requireAdminSeoWriteAccess } from "@/lib/adminAuth";
import { deleteBlogPost, getBlogPostById, resolveUniqueBlogSlug, upsertBlogPost } from "@/lib/blog";
import { uploadSeoImage } from "@/lib/seoAssets";
import { saveSiteRedirect } from "@/lib/siteRedirects";
import { renderTextContentToHtml } from "@/lib/textContentEditor";

const BLOG_ADMIN_PATH = "/admin/settings/blog-posts";

function normalizeField(value: FormDataEntryValue | null) {
  return (value?.toString() ?? "").replace(/\r\n/g, "\n").trim();
}

function revalidateBlogPaths(paths: string[]) {
  for (const path of Array.from(new Set(paths.filter(Boolean)))) {
    revalidatePath(path);
  }
  revalidatePath("/blog");
  revalidatePath(BLOG_ADMIN_PATH);
  revalidatePath("/sitemap.xml");
}

export async function saveBlogPostAction(formData: FormData) {
  await requireAdminSeoWriteAccess({ onDenied: "redirect", redirectTo: BLOG_ADMIN_PATH });

  const id = normalizeField(formData.get("id"));
  const title = normalizeField(formData.get("title"));
  const slugInput = normalizeField(formData.get("slug"));
  const excerpt = normalizeField(formData.get("excerpt"));
  const bodyText = normalizeField(formData.get("bodyText"));
  const status = normalizeField(formData.get("status")) === "published" ? "published" : "draft";
  const publishedAt = normalizeField(formData.get("publishedAt")) || null;

  if (!title) {
    redirect(appendAdminToast(BLOG_ADMIN_PATH, "error", "Blog title is required."));
  }
  if (!excerpt) {
    redirect(appendAdminToast(BLOG_ADMIN_PATH, "error", "Blog excerpt is required."));
  }

  const renderedBody = renderTextContentToHtml(bodyText);
  if (renderedBody.issues.length > 0) {
    const issue = renderedBody.issues[0];
    redirect(
      appendAdminToast(
        BLOG_ADMIN_PATH,
        "error",
        `Blog content issue on line ${issue.line}: ${issue.message}`,
      ),
    );
  }

  const existingPost = id ? await getBlogPostById(id) : null;

  let resolvedSlug = "";
  try {
    resolvedSlug = await resolveUniqueBlogSlug(slugInput || title, id || null, !slugInput);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve blog slug.";
    redirect(appendAdminToast(BLOG_ADMIN_PATH, "error", message));
  }

  const coverImageFile = formData.get("coverImageFile");
  let uploadedCoverImageUrl: string | null = null;
  if (coverImageFile instanceof File && coverImageFile.size > 0) {
    const uploaded = await uploadSeoImage(coverImageFile, `blog-${resolvedSlug}`);
    uploadedCoverImageUrl = uploaded?.publicUrl ?? null;
  }

  const savedPost = await upsertBlogPost({
    id: id || undefined,
    slug: resolvedSlug,
    title,
    excerpt,
    coverImageUrl: uploadedCoverImageUrl || normalizeField(formData.get("coverImageUrl")) || existingPost?.coverImageUrl || null,
    coverImageAlt: normalizeField(formData.get("coverImageAlt")) || title,
    bodyHtml: renderedBody.html,
    seoTitle: normalizeField(formData.get("seoTitle")) || null,
    metaDescription: normalizeField(formData.get("metaDescription")) || null,
    canonicalUrl: normalizeField(formData.get("canonicalUrl")) || null,
    status,
    publishedAt,
    authorName: normalizeField(formData.get("authorName")) || "Roc Candy",
  });

  if (existingPost && existingPost.slug !== savedPost.slug) {
    await saveSiteRedirect({
      sourcePath: `/blog/${existingPost.slug}`,
      destinationPath: `/blog/${savedPost.slug}`,
      statusCode: 301,
      isActive: true,
    });
  }

  revalidateBlogPaths([
    existingPost ? `/blog/${existingPost.slug}` : "",
    `/blog/${savedPost.slug}`,
  ]);
  redirect(appendAdminToast(BLOG_ADMIN_PATH, "success", "Blog post saved."));
}

export async function deleteBlogPostAction(formData: FormData) {
  await requireAdminSeoWriteAccess({ onDenied: "redirect", redirectTo: BLOG_ADMIN_PATH });

  const id = normalizeField(formData.get("id"));
  if (!id) {
    redirect(appendAdminToast(BLOG_ADMIN_PATH, "error", "Blog id is required."));
  }

  const existingPost = await getBlogPostById(id);
  if (!existingPost) {
    redirect(appendAdminToast(BLOG_ADMIN_PATH, "error", "Blog post not found."));
  }

  await deleteBlogPost(id);
  revalidateBlogPaths([`/blog/${existingPost.slug}`]);
  redirect(appendAdminToast(BLOG_ADMIN_PATH, "success", "Blog post deleted."));
}
