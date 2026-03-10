"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminToast, requireAdminSeoWriteAccess } from "@/lib/adminAuth";
import { uploadSeoImage } from "@/lib/seoAssets";
import { deleteSiteRedirect, saveSiteRedirect } from "@/lib/siteRedirects";
import { buildManagedSitePageHref, saveManagedSitePage } from "@/lib/sitePages";

const MANAGED_PAGES_ADMIN_PATH = "/admin/settings/pages";

function normalizeField(value: FormDataEntryValue | null) {
  return (value?.toString() ?? "").replace(/\r\n/g, "\n").trim();
}

function readCheckbox(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

async function revalidateSitePagePath(slug: string) {
  revalidatePath(buildManagedSitePageHref(slug));
  revalidatePath(MANAGED_PAGES_ADMIN_PATH);
  revalidatePath("/sitemap.xml");
}

export async function updateSitePageAction(formData: FormData) {
  await requireAdminSeoWriteAccess({ onDenied: "redirect", redirectTo: MANAGED_PAGES_ADMIN_PATH });
  const slug = normalizeField(formData.get("slug"));
  if (!slug) {
    redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "error", "Page slug is required."));
  }

  const ogImageFile = formData.get("ogImageFile");
  const uploadedOgImage =
    ogImageFile instanceof File && ogImageFile.size > 0 ? await uploadSeoImage(ogImageFile, slug) : null;

  await saveManagedSitePage({
    slug,
    title: normalizeField(formData.get("title")),
    bodyHtml: normalizeField(formData.get("bodyHtml")),
    seoTitle: normalizeField(formData.get("seoTitle")) || null,
    metaDescription: normalizeField(formData.get("metaDescription")) || null,
    ogImageUrl: uploadedOgImage?.publicUrl || normalizeField(formData.get("ogImageUrl")) || null,
    canonicalUrl: normalizeField(formData.get("canonicalUrl")) || null,
  });

  await revalidateSitePagePath(slug);
  redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "success", "Built-in page saved."));
}

export async function uploadSeoLibraryImageAction(formData: FormData) {
  await requireAdminSeoWriteAccess({ onDenied: "redirect", redirectTo: MANAGED_PAGES_ADMIN_PATH });
  const file = formData.get("libraryImageFile");
  if (!(file instanceof File) || file.size === 0) {
    redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "error", "Choose an image to upload."));
  }

  try {
    await uploadSeoImage(file, "library");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload the SEO image.";
    redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "error", message));
  }
  revalidatePath(MANAGED_PAGES_ADMIN_PATH);
  redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "success", "SEO library image uploaded."));
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
