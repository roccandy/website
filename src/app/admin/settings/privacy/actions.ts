"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSeoWriteAccess } from "@/lib/adminAuth";
import { saveManagedSitePage } from "@/lib/sitePages";

const PRIVACY_ADMIN_PATH = "/admin/settings/privacy";

function normalizeField(value: FormDataEntryValue | null) {
  return (value?.toString() ?? "").replace(/\r\n/g, "\n").trim();
}

export async function savePrivacyPage(formData: FormData) {
  await requireAdminSeoWriteAccess({ onDenied: "redirect", redirectTo: PRIVACY_ADMIN_PATH });
  const title = normalizeField(formData.get("title"));
  const bodyHtml = normalizeField(formData.get("bodyHtml"));

  await saveManagedSitePage({
    slug: "privacy",
    title: title || "Privacy Policy",
    bodyHtml,
  });

  revalidatePath("/privacy");
  revalidatePath(PRIVACY_ADMIN_PATH);
  redirect(`${PRIVACY_ADMIN_PATH}?updated=1`);
}
