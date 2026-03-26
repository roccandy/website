"use server";

import { redirect } from "next/navigation";
import { appendAdminToast, requireAdminSession } from "@/lib/adminAuth";
import { getAdminUserByEmail, updateAdminUserPassword } from "@/lib/adminUsers";
import { verifyPassword } from "@/lib/passwords";

const PASSWORD_PATH = "/admin/settings/password";

function normalizeField(value: FormDataEntryValue | null) {
  return value?.toString().trim() ?? "";
}

export async function changeOwnPasswordAction(formData: FormData) {
  const session = await requireAdminSession();

  if (session.user.isBootstrap) {
    redirect(
      appendAdminToast(
        PASSWORD_PATH,
        "error",
        "Bootstrap env login passwords cannot be changed here. Create or use a database-backed admin user instead."
      )
    );
  }

  const email = session.user.email?.trim().toLowerCase() ?? "";
  const currentPassword = normalizeField(formData.get("currentPassword"));
  const newPassword = normalizeField(formData.get("newPassword"));
  const confirmPassword = normalizeField(formData.get("confirmPassword"));

  if (!email) {
    redirect(appendAdminToast(PASSWORD_PATH, "error", "Your session is missing an email address."));
  }

  if (!currentPassword) {
    redirect(appendAdminToast(PASSWORD_PATH, "error", "Enter your current password."));
  }

  if (!newPassword || newPassword.length < 8) {
    redirect(appendAdminToast(PASSWORD_PATH, "error", "New password must be at least 8 characters."));
  }

  if (newPassword !== confirmPassword) {
    redirect(appendAdminToast(PASSWORD_PATH, "error", "New password and confirmation do not match."));
  }

  const user = await getAdminUserByEmail(email);
  if (!user || !user.is_active || user.id !== session.user.id) {
    redirect(appendAdminToast(PASSWORD_PATH, "error", "Could not verify the current signed-in user."));
  }

  if (!verifyPassword(currentPassword, user.password_hash)) {
    redirect(appendAdminToast(PASSWORD_PATH, "error", "Current password is incorrect."));
  }

  await updateAdminUserPassword(user.id, newPassword);
  redirect(appendAdminToast(PASSWORD_PATH, "success", "Password updated."));
}
