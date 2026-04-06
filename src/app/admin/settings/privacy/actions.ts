"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSeoWriteAccess } from "@/lib/adminAuth";
import { saveManagedSitePage } from "@/lib/sitePages";
import { renderTextContentToHtml } from "@/lib/textContentEditor";

const PRIVACY_ADMIN_PATH = "/admin/settings/privacy";

function normalizeField(value: FormDataEntryValue | null) {
  return (value?.toString() ?? "").replace(/\r\n/g, "\n").trim();
}

export async function savePrivacyPage(formData: FormData) {
  await requireAdminSeoWriteAccess({ onDenied: "redirect", redirectTo: PRIVACY_ADMIN_PATH });
  const title = normalizeField(formData.get("title"));
  const bodyText = normalizeField(formData.get("bodyText"));
  const bodyContent = renderTextContentToHtml(bodyText);

  if (bodyContent.issues.length > 0) {
    redirect(
      `${PRIVACY_ADMIN_PATH}?updated=0&error=${encodeURIComponent(
        `Line ${bodyContent.issues[0].line}: ${bodyContent.issues[0].message}`,
      )}`,
    );
  }

  await saveManagedSitePage({
    slug: "privacy",
    title: title || "Privacy Policy",
    bodyHtml: bodyContent.html,
  });

  revalidatePath("/privacy");
  revalidatePath(PRIVACY_ADMIN_PATH);
  redirect(`${PRIVACY_ADMIN_PATH}?updated=1`);
}
