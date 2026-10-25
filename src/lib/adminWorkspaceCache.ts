import { revalidateTag } from "next/cache";

export const ADMIN_WORKSPACE_TAG = "admin-workspace-v1";
export const ADMIN_WORKSPACE_TTL = 30;

export function invalidateAdminWorkspace() {
  // Cache invalidation must never turn a successful payment into a reported failure.
  try { revalidateTag(ADMIN_WORKSPACE_TAG, { expire: 0 }); } catch { /* The short TTL remains the fallback. */ }
}
