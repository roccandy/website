"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getChangedFieldLabels, logAdminActivity } from "@/lib/adminActivity";
import { appendAdminToast, requireAdminSeoWriteAccess } from "@/lib/adminAuth";
import { deleteBlogPost, getBlogPostById, resolveUniqueBlogSlug, upsertBlogPost } from "@/lib/blog";
import { uploadSeoImage } from "@/lib/seoAssets";
import { saveSiteRedirect } from "@/lib/siteRedirects";
import { renderTextContentToHtml } from "@/lib/textContentEditor";

const BLOG_ADMIN_PATH = "/admin/settings/blog-posts";

export type BlogPostActionState = {
  error: string | null;
};

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

export async function saveBlogPostAction(
  _previousState: BlogPostActionState,
  formData: FormData,
): Promise<BlogPostActionState> {
  await requireAdminSeoWriteAccess({ onDenied: "redirect", redirectTo: BLOG_ADMIN_PATH });

  const id = normalizeField(formData.get("id"));
  const title = normalizeField(formData.get("title"));
  const slugInput = normalizeField(formData.get("slug"));
  const excerpt = normalizeField(formData.get("excerpt"));
  const hasBodyText = formData.has("bodyText");
  const bodyText = hasBodyText ? normalizeField(formData.get("bodyText")) : null;
  const status = normalizeField(formData.get("status")) === "published" ? "published" : "draft";
  const publishedAt = normalizeField(formData.get("publishedAt")) || null;

  if (!title) {
    return { error: "Enter a blog title before saving." };
  }
  if (!excerpt) {
    return { error: "Enter a short excerpt before saving." };
  }

  let existingPost = null;
  try {
    existingPost = id ? await getBlogPostById(id) : null;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to load the blog post before saving." };
  }
  const renderedBody = hasBodyText
    ? renderTextContentToHtml(bodyText ?? "")
    : { html: existingPost?.bodyHtml ?? "", issues: [] };
  if (hasBodyText && renderedBody.issues.length > 0) {
    const issue = renderedBody.issues[0];
    return { error: `Blog content issue on line ${issue.line}: ${issue.message}` };
  }

  let resolvedSlug = "";
  try {
    resolvedSlug = await resolveUniqueBlogSlug(slugInput || title, id || null, !slugInput);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve blog slug.";
    return { error: message };
  }

  try {
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

    const changedFields = existingPost
      ? getChangedFieldLabels(
        {
          title: existingPost.title,
          slug: existingPost.slug,
          excerpt: existingPost.excerpt,
          coverImageUrl: existingPost.coverImageUrl,
          coverImageAlt: existingPost.coverImageAlt,
          bodyHtml: existingPost.bodyHtml,
          seoTitle: existingPost.seoTitle,
          metaDescription: existingPost.metaDescription,
          canonicalUrl: existingPost.canonicalUrl,
          status: existingPost.status,
          publishedAt: existingPost.publishedAt,
          authorName: existingPost.authorName,
        },
        {
          title: savedPost.title,
          slug: savedPost.slug,
          excerpt: savedPost.excerpt,
          coverImageUrl: savedPost.coverImageUrl,
          coverImageAlt: savedPost.coverImageAlt,
          bodyHtml: savedPost.bodyHtml,
          seoTitle: savedPost.seoTitle,
          metaDescription: savedPost.metaDescription,
          canonicalUrl: savedPost.canonicalUrl,
          status: savedPost.status,
          publishedAt: savedPost.publishedAt,
          authorName: savedPost.authorName,
        },
        {
          title: "Title",
          slug: "URL slug",
          excerpt: "Excerpt",
          coverImageUrl: "Cover image",
          coverImageAlt: "Cover alt text",
          bodyHtml: "Body",
          seoTitle: "SEO title",
          metaDescription: "Meta description",
          canonicalUrl: "Canonical URL",
          status: "Status",
          publishedAt: "Published date",
          authorName: "Author",
        },
        )
      : ["Title", "Body", "Status"];

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
    await logAdminActivity({
      area: "content-seo",
      action: existingPost ? "updated" : "created",
      entityType: "blog-post",
      entityId: savedPost.id,
      entityLabel: savedPost.title,
      summary: `${existingPost ? "Updated" : "Created"} blog post "${savedPost.title}".`,
      path: BLOG_ADMIN_PATH,
      changedFields,
      metadata: {
        slug: savedPost.slug,
        status: savedPost.status,
      },
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to save the blog post. Please try again." };
  }

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
  await logAdminActivity({
    area: "content-seo",
    action: "deleted",
    entityType: "blog-post",
    entityId: existingPost.id,
    entityLabel: existingPost.title,
    summary: `Deleted blog post "${existingPost.title}".`,
    path: BLOG_ADMIN_PATH,
    changedFields: ["Blog post"],
    metadata: {
      slug: existingPost.slug,
    },
  });
  redirect(appendAdminToast(BLOG_ADMIN_PATH, "success", "Blog post deleted."));
}
