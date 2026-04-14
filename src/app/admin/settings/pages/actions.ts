"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminToast, requireAdminSeoWriteAccess } from "@/lib/adminAuth";
import { resolveLandingGalleryUploadPath } from "@/lib/landingGallery";
import { buildPremadeItemPath } from "@/lib/premadeCatalog";
import { resolveUniquePremadeSlug } from "@/lib/premadeSlugs";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { uploadSeoImage } from "@/lib/seoAssets";
import { deleteSiteRedirect, saveSiteRedirect } from "@/lib/siteRedirects";
import { buildManagedSitePageHref, saveManagedSitePage } from "@/lib/sitePages";
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

  await revalidateSitePagePath(slug);
  redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "success", "Built-in page saved."));
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

  const { error } = await supabaseAdminClient
    .from("premade_candies")
    .update({
      slug: resolvedSlug,
      seo_title: normalizeField(formData.get("seoTitle")) || null,
      meta_description: normalizeField(formData.get("metaDescription")) || null,
      og_image_url: uploadedOgImage?.publicUrl || normalizeField(formData.get("ogImageUrl")) || null,
      canonical_url: normalizeField(formData.get("canonicalUrl")) || null,
    })
    .eq("id", id);

  if (error) {
    redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "error", error.message));
  }

  const previousPath = pagePath;
  const nextPagePath = buildPremadeItemPath({
    id: existingItem.id,
    name: existingItem.name,
    slug: resolvedSlug,
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
  try {
    await saveSiteRedirect({
      sourcePath: normalizeField(formData.get("sourcePath")),
      destinationPath: normalizeField(formData.get("destinationPath")),
      statusCode: normalizeField(formData.get("statusCode")),
      isActive: readCheckbox(formData, "isActive"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save the redirect.";
    redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "error", message));
  }

  revalidatePath(MANAGED_PAGES_ADMIN_PATH);
  redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "success", "Redirect saved."));
}

export async function deleteSiteRedirectAction(formData: FormData) {
  await requireAdminSeoWriteAccess({ onDenied: "redirect", redirectTo: MANAGED_PAGES_ADMIN_PATH });
  try {
    await deleteSiteRedirect(normalizeField(formData.get("sourcePath")));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete the redirect.";
    redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "error", message));
  }
  revalidatePath(MANAGED_PAGES_ADMIN_PATH);
  redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "success", "Redirect deleted."));
}
