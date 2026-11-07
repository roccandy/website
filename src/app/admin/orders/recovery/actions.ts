"use server";

import { redirect } from "next/navigation";
import { appendAdminToast, requireAdminWriteAccess } from "@/lib/adminAuth";
import { logAdminActivity } from "@/lib/adminActivity";
import { resolvePaymentFailure } from "@/lib/paymentFailures";

const RECOVERY_PATH = "/admin/orders/recovery";

export async function resolvePaymentRecoveryAction(formData: FormData) {
  const session = await requireAdminWriteAccess();
  const id = formData.get("id")?.toString().trim() ?? "";
  const note = formData.get("resolution_note")?.toString().trim().slice(0, 1_000) || null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    redirect(appendAdminToast(RECOVERY_PATH, "error", "Invalid payment recovery item."));
  }

  await resolvePaymentFailure({ id, resolvedByEmail: session.user.email ?? null, note });
  await logAdminActivity({
    area: "orders",
    action: "resolved",
    entityType: "payment-failure",
    entityId: id,
    entityLabel: "Payment recovery",
    summary: "Closed a payment recovery item after manual reconciliation.",
    path: RECOVERY_PATH,
    changedFields: ["Recovery status"],
  });
  redirect(appendAdminToast(RECOVERY_PATH, "success", "Payment recovery item closed."));
}
