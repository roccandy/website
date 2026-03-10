"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminToast, requireAdminSeoWriteAccess } from "@/lib/adminAuth";
import {
  buildManagedPageHref,
  deleteManagedPage,
  normalizeManagedPagePath,
  saveManagedPage,
} from "@/lib/managedPages";
import { uploadSeoImage } from "@/lib/seoAssets";

const MANAGED_PAGES_ADMIN_PATH = "/admin/settings/pages";

function normalizeField(value: FormDataEntryValue | null) {
  return (value?.toString() ?? "").replace(/\r\n/g, "\n").trim();
}

function readCheckbox(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

async function revalidateManagedPagePaths(paths: Array<string | null | undefined>) {
  for (const path of paths) {
    const normalized = normalizeManagedPagePath(path ?? "");
    if (!normalized) continue;
    revalidatePath(buildManagedPageHref(normalized));
  }
  revalidatePath("/sitemap.xml");
}

export async function createManagedPageAction(formData: FormData) {
  await requireAdminSeoWriteAccess({ onDenied: "redirect", redirectTo: MANAGED_PAGES_ADMIN_PATH });
  const normalizedPath = normalizeField(formData.get("slugPath"));
  const ogImageFile = formData.get("ogImageFile");
  const uploadedOgImage =
    ogImageFile instanceof File && ogImageFile.size > 0 ? await uploadSeoImage(ogImageFile, normalizedPath) : null;

  const result = await saveManagedPage({
    slugPath: normalizedPath,
    title: normalizeField(formData.get("title")),
    bodyHtml: normalizeField(formData.get("bodyHtml")),
    seoTitle: normalizeField(formData.get("seoTitle")) || null,
    metaDescription: normalizeField(formData.get("metaDescription")) || null,
    ogImageUrl: uploadedOgImage?.publicUrl || normalizeField(formData.get("ogImageUrl")) || null,
    canonicalUrl: normalizeField(formData.get("canonicalUrl")) || null,
    isPublished: readCheckbox(formData, "isPublished"),
    isIndexable: readCheckbox(formData, "isIndexable"),
  });

  if (!result.ok) {
    redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "error", result.error));
  }

  await revalidateManagedPagePaths([result.page.slugPath]);
  revalidatePath(MANAGED_PAGES_ADMIN_PATH);
  redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "success", "Managed page created."));
}

export async function updateManagedPageAction(formData: FormData) {
  await requireAdminSeoWriteAccess({ onDenied: "redirect", redirectTo: MANAGED_PAGES_ADMIN_PATH });
  const id = normalizeField(formData.get("id"));
  if (!id) {
    redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "error", "Page id is required."));
  }
  const normalizedPath = normalizeField(formData.get("slugPath"));
  const ogImageFile = formData.get("ogImageFile");
  const uploadedOgImage =
    ogImageFile instanceof File && ogImageFile.size > 0 ? await uploadSeoImage(ogImageFile, normalizedPath) : null;

  const result = await saveManagedPage({
    id,
    slugPath: normalizedPath,
    title: normalizeField(formData.get("title")),
    bodyHtml: normalizeField(formData.get("bodyHtml")),
    seoTitle: normalizeField(formData.get("seoTitle")) || null,
    metaDescription: normalizeField(formData.get("metaDescription")) || null,
    ogImageUrl: uploadedOgImage?.publicUrl || normalizeField(formData.get("ogImageUrl")) || null,
    canonicalUrl: normalizeField(formData.get("canonicalUrl")) || null,
    isPublished: readCheckbox(formData, "isPublished"),
    isIndexable: readCheckbox(formData, "isIndexable"),
  });

  if (!result.ok) {
    redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "error", result.error));
  }

  await revalidateManagedPagePaths([result.previousPath, result.page.slugPath]);
  revalidatePath(MANAGED_PAGES_ADMIN_PATH);
  redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "success", "Managed page saved."));
}

export async function deleteManagedPageAction(formData: FormData) {
  await requireAdminSeoWriteAccess({ onDenied: "redirect", redirectTo: MANAGED_PAGES_ADMIN_PATH });
  const id = normalizeField(formData.get("id"));
  if (!id) {
    redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "error", "Page id is required."));
  }

  const path = normalizeField(formData.get("slugPath"));
  const result = await deleteManagedPage(id);
  if (!result.ok) {
    redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "error", result.error));
  }

  await revalidateManagedPagePaths([path || result.page.slugPath]);
  revalidatePath(MANAGED_PAGES_ADMIN_PATH);
  redirect(appendAdminToast(MANAGED_PAGES_ADMIN_PATH, "success", "Managed page deleted."));
}
