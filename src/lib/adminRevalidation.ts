import { revalidatePath } from "next/cache";
import { invalidateAdminWorkspace } from "./adminWorkspaceCache";

/** One invalidation policy for all admin saves, including settings and CRM. */
export function revalidateAdminPath(path: string, type?: "layout" | "page") {
  invalidateAdminWorkspace();
  revalidatePath(path,type);
}
