"use server";

import { redirect } from "next/navigation";
import { getChangedFieldLabels, logAdminActivity } from "@/lib/adminActivity";
import {
  createAdminUser,
  deleteAdminUser,
  getAdminUserById,
  getAdminUserByEmail,
  hasAnyAdminUsers,
  normalizeAdminEmail,
  updateAdminUserPassword,
  updateAdminUserProfile,
} from "@/lib/adminUsers";
import { requireAdminManageUsersAccess } from "@/lib/adminAuth";
import type { AdminRole } from "@/types/next-auth";

const USERS_PATH = "/admin/settings/users";

function normalizeField(value: FormDataEntryValue | null) {
  return value?.toString().trim() ?? "";
}

function parseRole(value: string): AdminRole {
  if (value === "viewer" || value === "seo" || value === "editor" || value === "admin") {
    return value;
  }
  throw new Error("Invalid role.");
}

export async function addAdminUser(formData: FormData) {
  await requireAdminManageUsersAccess();

  const email = normalizeAdminEmail(normalizeField(formData.get("email")));
  const displayName = normalizeField(formData.get("display_name")) || null;
  const password = normalizeField(formData.get("password"));
  const role = parseRole(normalizeField(formData.get("role")));

  if (!email) throw new Error("Email is required.");
  if (!password || password.length < 8) throw new Error("Password must be at least 8 characters.");

  await createAdminUser({ email, displayName, password, role });
  const createdUser = await getAdminUserByEmail(email);
  await logAdminActivity({
    area: "admin",
    action: "created",
    entityType: "admin-user",
    entityId: createdUser?.id ?? null,
    entityLabel: createdUser?.email ?? email,
    summary: `Created admin user "${createdUser?.email ?? email}".`,
    path: USERS_PATH,
    changedFields: ["Email", "Password", "Role"],
    metadata: {
      role,
      isActive: true,
    },
  });
  redirect(`${USERS_PATH}?updated=1`);
}

export async function updateAdminUserAction(formData: FormData) {
  const session = await requireAdminManageUsersAccess();
  const id = normalizeField(formData.get("id"));
  const displayName = normalizeField(formData.get("display_name")) || null;
  const role = parseRole(normalizeField(formData.get("role")));
  const isActive = formData.get("is_active") === "on";

  if (!id) throw new Error("User id is required.");
  if (session.user.id === id && !isActive) {
    throw new Error("You cannot deactivate your own account.");
  }

  const previousUser = await getAdminUserById(id);
  await updateAdminUserProfile({ id, displayName, role, isActive });
  const nextUser = await getAdminUserById(id);
  if (previousUser && nextUser) {
    await logAdminActivity({
      area: "admin",
      action: "updated",
      entityType: "admin-user",
      entityId: nextUser.id,
      entityLabel: nextUser.email,
      summary: `Updated admin user "${nextUser.email}".`,
      path: USERS_PATH,
      changedFields: getChangedFieldLabels(
        {
          display_name: previousUser.display_name,
          role: previousUser.role,
          is_active: previousUser.is_active,
        },
        {
          display_name: nextUser.display_name,
          role: nextUser.role,
          is_active: nextUser.is_active,
        },
        {
          display_name: "Display name",
          role: "Role",
          is_active: "Account status",
        },
      ),
    });
  }
  redirect(`${USERS_PATH}?updated=1`);
}

export async function resetAdminUserPassword(formData: FormData) {
  await requireAdminManageUsersAccess();
  const id = normalizeField(formData.get("id"));
  const password = normalizeField(formData.get("password"));
  if (!id) throw new Error("User id is required.");
  if (!password || password.length < 8) throw new Error("Password must be at least 8 characters.");

  const user = await getAdminUserById(id);
  await updateAdminUserPassword(id, password);
  await logAdminActivity({
    area: "admin",
    action: "updated",
    entityType: "admin-user",
    entityId: user?.id ?? id,
    entityLabel: user?.email ?? "Admin user",
    summary: `Reset password for "${user?.email ?? "admin user"}".`,
    path: USERS_PATH,
    changedFields: ["Password"],
  });
  redirect(`${USERS_PATH}?updated=1`);
}

export async function deleteAdminUserAction(formData: FormData) {
  const session = await requireAdminManageUsersAccess();
  const id = normalizeField(formData.get("id"));
  if (!id) throw new Error("User id is required.");
  if (session.user.id === id) {
    throw new Error("You cannot delete your own account.");
  }

  const hasUsers = await hasAnyAdminUsers();
  if (!hasUsers) {
    throw new Error("No database-backed users exist yet.");
  }

  const deletedUser = await getAdminUserById(id);
  await deleteAdminUser(id);
  if (deletedUser) {
    await logAdminActivity({
      area: "admin",
      action: "deleted",
      entityType: "admin-user",
      entityId: deletedUser.id,
      entityLabel: deletedUser.email,
      summary: `Deleted admin user "${deletedUser.email}".`,
      path: USERS_PATH,
      changedFields: ["Admin user"],
    });
  }
  redirect(`${USERS_PATH}?updated=1`);
}
