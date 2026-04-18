"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getChangedFieldLabels, logAdminActivity } from "@/lib/adminActivity";
import { requireAdminSeoWriteAccess } from "@/lib/adminAuth";
import { getManagedSitePage, saveManagedSitePage } from "@/lib/sitePages";
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

  const previousPage = await getManagedSitePage("privacy");
  await saveManagedSitePage({
    slug: "privacy",
    title: title || "Privacy Policy",
    bodyHtml: bodyContent.html,
  });
  const nextPage = await getManagedSitePage("privacy");

  revalidatePath("/privacy");
  revalidatePath(PRIVACY_ADMIN_PATH);
  await logAdminActivity({
    area: "content-seo",
    action: "updated",
    entityType: "site-page",
    entityId: nextPage.slug,
    entityLabel: nextPage.title,
    summary: 'Updated the "Privacy Policy" page.',
    path: PRIVACY_ADMIN_PATH,
    changedFields: getChangedFieldLabels(
      {
        title: previousPage.title,
        bodyHtml: previousPage.bodyHtml,
      },
      {
        title: nextPage.title,
        bodyHtml: nextPage.bodyHtml,
      },
      {
        title: "Title",
        bodyHtml: "Body",
      },
    ),
  });
  redirect(`${PRIVACY_ADMIN_PATH}?updated=1`);
}
