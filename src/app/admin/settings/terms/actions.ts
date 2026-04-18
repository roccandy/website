"use server";

import { revalidatePath } from "next/cache";
import { logAdminActivity } from "@/lib/adminActivity";
import { requireAdminSeoWriteAccess } from "@/lib/adminAuth";
import { getManagedTermsItems, saveManagedTermsItems } from "@/lib/terms";
import type { ManagedTermsItem } from "@/lib/terms-shared";

const TERMS_PATHS = ["/terms-and-conditions", "/admin/settings/terms"];

export async function saveTermsTree(items: ManagedTermsItem[]): Promise<{ error: string | null }> {
  try {
    await requireAdminSeoWriteAccess();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to save terms." };
  }
  try {
    const previousItems = await getManagedTermsItems();
    await saveManagedTermsItems(items);
    for (const path of TERMS_PATHS) {
      revalidatePath(path);
    }
    await logAdminActivity({
      area: "content-seo",
      action: "updated",
      entityType: "terms",
      entityLabel: "Terms and Conditions",
      summary: "Saved the terms and conditions content tree.",
      path: "/admin/settings/terms",
      changedFields: ["Terms content"],
      metadata: {
        previousCount: previousItems.length,
        nextCount: items.length,
      },
    });
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to save terms." };
  }
}
