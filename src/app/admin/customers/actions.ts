"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminToast, requireAdminSession, requireAdminWriteAccess } from "@/lib/adminAuth";
import { canAccessCustomerCrm, insertCustomerNote, mergeCustomerRecords } from "@/lib/customerHistory";

const CUSTOMERS_PATH = "/admin/customers";

function safeCustomerPath(customerId: string) {
  return `${CUSTOMERS_PATH}/${encodeURIComponent(customerId)}`;
}

export async function addCustomerNote(formData: FormData) {
  const session = await requireAdminWriteAccess({ onDenied: "redirect" });
  if (!canAccessCustomerCrm(session.user)) {
    redirect(appendAdminToast("/admin", "error", "Customer history is not available for this admin role."));
  }

  const customerId = formData.get("customer_id")?.toString().trim() ?? "";
  const body = formData.get("body")?.toString() ?? "";
  if (!customerId) {
    redirect(appendAdminToast(CUSTOMERS_PATH, "error", "Customer id is missing."));
  }

  try {
    await insertCustomerNote({
      customerId,
      body,
      createdByName: session.user.name ?? null,
      createdByEmail: session.user.email ?? null,
    });
  } catch (error) {
    redirect(appendAdminToast(safeCustomerPath(customerId), "error", error instanceof Error ? error.message : "Unable to save note."));
  }

  revalidatePath(CUSTOMERS_PATH);
  revalidatePath(safeCustomerPath(customerId));
  redirect(appendAdminToast(safeCustomerPath(customerId), "success", "Customer note saved."));
}

export async function mergeCustomersAction(formData: FormData) {
  const session = await requireAdminWriteAccess({ onDenied: "redirect" });
  if (!canAccessCustomerCrm(session.user)) {
    redirect(appendAdminToast("/admin", "error", "Customer history is not available for this admin role."));
  }

  const targetCustomerId = formData.get("target_customer_id")?.toString().trim() ?? "";
  const sourceCustomerId = formData.get("source_customer_id")?.toString().trim() ?? "";
  if (!targetCustomerId || !sourceCustomerId) {
    redirect(appendAdminToast(CUSTOMERS_PATH, "error", "Choose a customer to merge."));
  }

  try {
    await mergeCustomerRecords({ targetCustomerId, sourceCustomerId });
  } catch (error) {
    redirect(
      appendAdminToast(
        safeCustomerPath(targetCustomerId),
        "error",
        error instanceof Error ? error.message : "Unable to merge customers.",
      ),
    );
  }

  revalidatePath(CUSTOMERS_PATH);
  revalidatePath(safeCustomerPath(targetCustomerId));
  redirect(appendAdminToast(safeCustomerPath(targetCustomerId), "success", "Customer records merged."));
}

export async function assertCustomerCrmAccess() {
  const session = await requireAdminSession();
  if (!canAccessCustomerCrm(session.user)) {
    redirect(appendAdminToast("/admin", "error", "Customer history is not available for this admin role."));
  }
  return session;
}
