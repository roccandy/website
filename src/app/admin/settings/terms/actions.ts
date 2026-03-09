"use server";

import { revalidatePath } from "next/cache";
import { requireAdminWriteAccess } from "@/lib/adminAuth";
import { saveManagedTermsItems } from "@/lib/terms";
import type { ManagedTermsItem } from "@/lib/terms-shared";

const TERMS_PATHS = ["/terms-and-conditions", "/admin/settings/terms"];

export async function saveTermsTree(items: ManagedTermsItem[]): Promise<{ error: string | null }> {
  await requireAdminWriteAccess();
  try {
    await saveManagedTermsItems(items);
    for (const path of TERMS_PATHS) {
      revalidatePath(path);
    }
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to save terms." };
  }
}
