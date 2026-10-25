"use server";

import { requireAdminSession } from "@/lib/adminAuth";
import { invalidateAdminWorkspace } from "@/lib/adminWorkspaceCache";

export async function refreshAdminWorkspace() {
  await requireAdminSession();
  invalidateAdminWorkspace();
}
