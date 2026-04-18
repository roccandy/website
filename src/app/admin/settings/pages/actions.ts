"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getChangedFieldLabels, logAdminActivity } from "@/lib/adminActivity";
import { appendAdminToast, requireAdminSeoWriteAccess } from "@/lib/adminAuth";
import { getManagedFaqItems, saveManagedFaqItems } from "@/lib/faqs";
import { resolveLandingGalleryUploadPath } from "@/lib/landingGallery";
import { buildPremadeItemPath } from "@/lib/premadeCatalog";
import { resolveUniquePremadeSlug } from "@/lib/premadeSlugs";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { uploadSeoImage } from "@/lib/seoAssets";
import { deleteSiteRedirect, listSiteRedirects, saveSiteRedirect } from "@/lib/siteRedirects";
import { buildManagedSitePageHref, getManagedSitePage, saveManagedSitePage } from "@/lib/sitePages";
import { renderTextContentToHtml } from "@/lib/textContentEditor";

const MANAGED_PAGES_ADMIN_PATH = "/admin/settings/pages";

export type LandingGalleryBulkUploadActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  uploaded:
    | Array<{
        name: string;
        path: string;
        publicUrl: string;
        sizeBytes: number | null;
        updatedAt: string | null;
      }>
    | null;
  requestId: string | null;
};

function normalizeField(value: FormDataEntryValue | null) {
  return (value?.toString() ?? "").replace(/\r\n/g, "\n").trim();
}

function normalizeGalleryImageUrls(values: FormDataEntryValue[]) {
  return values
    .map((value) => normalizeField(value))
    .filter(Boolean);
}

function readCheckbox(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

async function revalidateSitePagePath(slug: string) {
  revalidatePath(buildManagedSitePageHref(slug));
  revalidatePath(MANAGED_PAGES_ADMIN_PATH);
  revalidatePath("/sitemap.xml");
}

function revalidateFaqAdminAndPublicPaths() {
  revalidatePath("/admin/settings/faqs");
  revalidatePath("/faq");
  revalidatePath("/faqs");
}

async function revalidatePremadePagePath(path: string) {
  revalidatePath(path);
  revalidatePath("/pre-made-candy");
  revalidatePath(MANAGED_PAGES_ADMIN_PATH);
  revalidatePath("/sitemap.xml");
}

export async function updateSitePageAction(formData: FormData) {
  await requireAdminSeoWriteAccess({ onDenied: "redirect", redirectTo: MANAGED_PAGES_ADMIN_PATH });
  const slug = normalizeField(formData.get("slug"));
  if (!slug) {
    redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "error", "Page slug is required."));
  }
  const hasBodyText = formData.has("bodyText");
  const bodyText = hasBodyText ? normalizeField(formData.get("bodyText")) : "";
  const bodyContent = hasBodyText ? renderTextContentToHtml(bodyText) : null;
  if (bodyContent && bodyContent.issues.length > 0) {
    redirect(
      appendAdminToast(
        MANAGED_PAGES_ADMIN_PATH,
        "error",
        `Page content issue on line ${bodyContent.issues[0].line}: ${bodyContent.issues[0].message}`,
      ),
    );
  }

  const ogImageFile = formData.get("ogImageFile");
  const uploadedOgImage =
    ogImageFile instanceof File && ogImageFile.size > 0 ? await uploadSeoImage(ogImageFile, slug) : null;
  const previousPage = await getManagedSitePage(slug);

  await saveManagedSitePage({
    slug,
    title: normalizeField(formData.get("title")),
    heroSubheading: normalizeField(formData.get("heroSubheading")) || null,
    heroSupportingLine: normalizeField(formData.get("heroSupportingLine")) || null,
    bodyHtml: bodyContent?.html,
    faqHeading: normalizeField(formData.get("faqHeading")) || null,
    faqItemIds: formData.getAll("faqItemIds").map((value) => normalizeField(value)).filter(Boolean),
    seoTitle: normalizeField(formData.get("seoTitle")) || null,
    metaDescription: normalizeField(formData.get("metaDescription")) || null,
    ogImageUrl: uploadedOgImage?.publicUrl || normalizeField(formData.get("ogImageUrl")) || null,
    canonicalUrl: normalizeField(formData.get("canonicalUrl")) || null,
    galleryImageUrls: normalizeGalleryImageUrls(formData.getAll("galleryImageUrls")),
  });
  const nextPage = await getManagedSitePage(slug);

  await revalidateSitePagePath(slug);
  await logAdminActivity({
    area: "content-seo",
    action: "updated",
    entityType: "site-page",
    entityId: nextPage.slug,
    entityLabel: nextPage.title || nextPage.slug,
    summary: `Updated built-in page "${nextPage.title || nextPage.slug}".`,
    path: MANAGED_PAGES_ADMIN_PATH,
    changedFields: getChangedFieldLabels(
      {
        title: previousPage.title,
        heroSubheading: previousPage.heroSubheading,
        heroSupportingLine: previousPage.heroSupportingLine,
        bodyHtml: previousPage.bodyHtml,
        faqHeading: previousPage.faqHeading,
        faqItemIds: previousPage.faqItemIds,
        seoTitle: previousPage.seoTitle,
        metaDescription: previousPage.metaDescription,
        ogImageUrl: previousPage.ogImageUrl,
        canonicalUrl: previousPage.canonicalUrl,
        galleryImageUrls: previousPage.galleryImageUrls,
      },
      {
        title: nextPage.title,
        heroSubheading: nextPage.heroSubheading,
        heroSupportingLine: nextPage.heroSupportingLine,
        bodyHtml: nextPage.bodyHtml,
        faqHeading: nextPage.faqHeading,
        faqItemIds: nextPage.faqItemIds,
        seoTitle: nextPage.seoTitle,
        metaDescription: nextPage.metaDescription,
        ogImageUrl: nextPage.ogImageUrl,
        canonicalUrl: nextPage.canonicalUrl,
        galleryImageUrls: nextPage.galleryImageUrls,
      },
      {
        title: "Title",
        heroSubheading: "Hero subheading",
        heroSupportingLine: "Hero supporting line",
        bodyHtml: "Body",
        faqHeading: "FAQ heading",
        faqItemIds: "Linked FAQs",
        seoTitle: "SEO title",
        metaDescription: "Meta description",
        ogImageUrl: "OG image",
        canonicalUrl: "Canonical URL",
        galleryImageUrls: "Gallery images",
      },
    ),
  });
  redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "success", "Built-in page saved."));
}

export async function createPageFaqAction(formData: FormData) {
  await requireAdminSeoWriteAccess({ onDenied: "redirect", redirectTo: MANAGED_PAGES_ADMIN_PATH });

  const pageSlug = normalizeField(formData.get("pageSlug"));
  const question = normalizeField(formData.get("question"));
  const answerText = normalizeField(formData.get("answerText"));

  if (!pageSlug) {
    redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "error", "Page slug is required."));
  }

  if (!question || !answerText) {
    redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "error", "New FAQ question and answer are required."));
  }

  const answerContent = renderTextContentToHtml(answerText);
  if (answerContent.issues.length > 0) {
    redirect(
      appendAdminToast(
        MANAGED_PAGES_ADMIN_PATH,
        "error",
        `FAQ answer issue on line ${answerContent.issues[0].line}: ${answerContent.issues[0].message}`,
      ),
    );
  }

  const currentFaqs = await getManagedFaqItems();
  const newFaqId = crypto.randomUUID();
  await saveManagedFaqItems([
    ...currentFaqs,
    {
      id: newFaqId,
      question,
      answerHtml: answerContent.html,
      sortOrder: currentFaqs.length,
      showOnFaqPage: false,
    },
  ]);

  const page = await getManagedSitePage(pageSlug);
  await saveManagedSitePage({
    slug: pageSlug,
    faqItemIds: [...page.faqItemIds, newFaqId],
  });

  await revalidateSitePagePath(pageSlug);
  revalidateFaqAdminAndPublicPaths();
  await logAdminActivity({
    area: "content-seo",
    action: "created",
    entityType: "faq",
    entityId: newFaqId,
    entityLabel: question || "New FAQ",
    summary: `Added a page FAQ to "${page.title || pageSlug}".`,
    path: MANAGED_PAGES_ADMIN_PATH,
    changedFields: ["Question", "Answer", "Linked page"],
    metadata: {
      pageSlug,
    },
  });
  redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "success", "Page FAQ created."));
}

export async function updatePremadeSeoAction(formData: FormData) {
  await requireAdminSeoWriteAccess({ onDenied: "redirect", redirectTo: MANAGED_PAGES_ADMIN_PATH });
  const id = normalizeField(formData.get("id"));
  const pagePath = normalizeField(formData.get("pagePath"));
  if (!id || !pagePath) {
    redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "error", "Product id and path are required."));
  }

  const { data: existingItem, error: readError } = await supabaseAdminClient
    .from("premade_candies")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readError || !existingItem) {
    redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "error", readError?.message ?? "Pre-made product not found."));
  }

  const ogImageFile = formData.get("ogImageFile");
  const uploadedOgImage =
    ogImageFile instanceof File && ogImageFile.size > 0 ? await uploadSeoImage(ogImageFile, `premade-${id}`) : null;
  const submittedSlug = normalizeField(formData.get("slug"));
  let resolvedSlug = (existingItem.slug as string | null | undefined)?.trim() || "";
  try {
    resolvedSlug = await resolveUniquePremadeSlug(
      submittedSlug || existingItem.name || existingItem.slug || "item",
      id,
      !submittedSlug,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save the product URL.";
    redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "error", message));
  }

  const { data: updatedItem, error } = await supabaseAdminClient
    .from("premade_candies")
    .update({
      slug: resolvedSlug,
      seo_title: normalizeField(formData.get("seoTitle")) || null,
      meta_description: normalizeField(formData.get("metaDescription")) || null,
      og_image_url: uploadedOgImage?.publicUrl || normalizeField(formData.get("ogImageUrl")) || null,
      canonical_url: normalizeField(formData.get("canonicalUrl")) || null,
    })
    .eq("id", id)
    .select("id,name,slug,seo_title,meta_description,og_image_url,canonical_url")
    .single();

  if (error || !updatedItem) {
    redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "error", error?.message ?? "Unable to save the product SEO."));
  }

  const previousPath = pagePath;
  const nextPagePath = buildPremadeItemPath({
    id: updatedItem.id,
    name: updatedItem.name,
    slug: updatedItem.slug,
  });
  if (previousPath !== nextPagePath) {
    await saveSiteRedirect({
      sourcePath: previousPath,
      destinationPath: nextPagePath,
      statusCode: 301,
      isActive: true,
    });
  }
  await revalidatePremadePagePath(nextPagePath);
  await revalidatePremadePagePath(pagePath);
  await logAdminActivity({
    area: "content-seo",
    action: "updated",
    entityType: "premade-seo",
    entityId: updatedItem.id,
    entityLabel: updatedItem.name,
    summary: `Updated pre-made SEO for "${updatedItem.name}".`,
    path: MANAGED_PAGES_ADMIN_PATH,
    changedFields: getChangedFieldLabels(
      {
        slug: existingItem.slug,
        seo_title: existingItem.seo_title,
        meta_description: existingItem.meta_description,
        og_image_url: existingItem.og_image_url,
        canonical_url: existingItem.canonical_url,
      },
      {
        slug: updatedItem.slug,
        seo_title: updatedItem.seo_title,
        meta_description: updatedItem.meta_description,
        og_image_url: updatedItem.og_image_url,
        canonical_url: updatedItem.canonical_url,
      },
      {
        slug: "URL slug",
        seo_title: "SEO title",
        meta_description: "Meta description",
        og_image_url: "OG image",
        canonical_url: "Canonical URL",
      },
    ),
    metadata: {
      previousPath,
      nextPath: nextPagePath,
    },
  });
  redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "success", "Pre-made product SEO saved."));
}

export async function bulkUploadLandingGalleryImagesAction(
  formData: FormData
): Promise<LandingGalleryBulkUploadActionState> {
  try {
    await requireAdminSeoWriteAccess({ onDenied: "throw" });
    const slug = normalizeField(formData.get("slug"));
    const uploadTarget = normalizeField(formData.get("landingGalleryTarget"));
    const files = formData
      .getAll("landingGalleryFiles")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (!slug) {
      return {
        status: "error",
        message: "Page slug is required for gallery uploads.",
        uploaded: null,
        requestId: `${Date.now()}`,
      };
    }

    if (files.length === 0) {
      return {
        status: "error",
        message: "Choose one or more images to upload.",
        uploaded: null,
        requestId: `${Date.now()}`,
      };
    }

    const uploaded = [];
    const uploadPath = resolveLandingGalleryUploadPath(slug, uploadTarget);
    for (const file of files) {
      const result = await uploadSeoImage(file, uploadPath);
      if (!result) continue;
      const storedName = result.path.split("/").pop() ?? file.name;
      uploaded.push({
        name: storedName,
        path: result.path,
        publicUrl: result.publicUrl,
        sizeBytes: result.sizeBytes,
        updatedAt: null,
      });
    }

    if (uploaded.length === 0) {
      return {
        status: "error",
        message: "No images were uploaded.",
        uploaded: null,
        requestId: `${Date.now()}`,
      };
    }

    revalidatePath(MANAGED_PAGES_ADMIN_PATH);
    await logAdminActivity({
      area: "content-seo",
      action: "uploaded",
      entityType: "landing-gallery",
      entityLabel: slug,
      summary:
        uploaded.length === 1
          ? `Uploaded 1 landing gallery image for "${slug}".`
          : `Uploaded ${uploaded.length} landing gallery images for "${slug}".`,
      path: MANAGED_PAGES_ADMIN_PATH,
      changedFields: ["Gallery images"],
      metadata: {
        pageSlug: slug,
        uploadTarget: uploadTarget || null,
        count: uploaded.length,
      },
    });

    return {
      status: "success",
      message:
        uploaded.length === 1
          ? "1 image uploaded. Save the page to keep it in this gallery."
          : `${uploaded.length} images uploaded. Save the page to keep them in this gallery.`,
      uploaded,
      requestId: `${Date.now()}`,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to upload landing gallery images.",
      uploaded: null,
      requestId: `${Date.now()}`,
    };
  }
}

export async function saveSiteRedirectAction(formData: FormData) {
  await requireAdminSeoWriteAccess({ onDenied: "redirect", redirectTo: MANAGED_PAGES_ADMIN_PATH });
  const sourcePath = normalizeField(formData.get("sourcePath"));
  const destinationPath = normalizeField(formData.get("destinationPath"));
  const statusCode = normalizeField(formData.get("statusCode"));
  const isActive = readCheckbox(formData, "isActive");
  const existingRedirect = (await listSiteRedirects()).find((item) => item.sourcePath === sourcePath) ?? null;
  try {
    await saveSiteRedirect({
      sourcePath,
      destinationPath,
      statusCode,
      isActive,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save the redirect.";
    redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "error", message));
  }

  revalidatePath(MANAGED_PAGES_ADMIN_PATH);
  await logAdminActivity({
    area: "content-seo",
    action: existingRedirect ? "updated" : "created",
    entityType: "redirect",
    entityId: sourcePath,
    entityLabel: sourcePath,
    summary: `Saved redirect ${sourcePath} -> ${destinationPath}.`,
    path: MANAGED_PAGES_ADMIN_PATH,
    changedFields: existingRedirect
      ? getChangedFieldLabels(
          {
            destinationPath: existingRedirect.destinationPath,
            statusCode: String(existingRedirect.statusCode),
            isActive: existingRedirect.isActive,
          },
          {
            destinationPath,
            statusCode,
            isActive,
          },
          {
            destinationPath: "Destination",
            statusCode: "Status code",
            isActive: "Active state",
          },
        )
      : ["Destination", "Status code", "Active state"],
  });
  redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "success", "Redirect saved."));
}

export async function deleteSiteRedirectAction(formData: FormData) {
  await requireAdminSeoWriteAccess({ onDenied: "redirect", redirectTo: MANAGED_PAGES_ADMIN_PATH });
  const sourcePath = normalizeField(formData.get("sourcePath"));
  try {
    await deleteSiteRedirect(sourcePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete the redirect.";
    redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "error", message));
  }
  revalidatePath(MANAGED_PAGES_ADMIN_PATH);
  await logAdminActivity({
    area: "content-seo",
    action: "deleted",
    entityType: "redirect",
    entityId: sourcePath,
    entityLabel: sourcePath,
    summary: `Deleted redirect ${sourcePath}.`,
    path: MANAGED_PAGES_ADMIN_PATH,
    changedFields: ["Redirect"],
  });
  redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "success", "Redirect deleted."));
}
