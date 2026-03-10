"use server";

import { redirect } from "next/navigation";
import {
  createAdminUser,
  deleteAdminUser,
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

  await updateAdminUserProfile({ id, displayName, role, isActive });
  redirect(`${USERS_PATH}?updated=1`);
}

export async function resetAdminUserPassword(formData: FormData) {
  await requireAdminManageUsersAccess();
  const id = normalizeField(formData.get("id"));
  const password = normalizeField(formData.get("password"));
  if (!id) throw new Error("User id is required.");
  if (!password || password.length < 8) throw new Error("Password must be at least 8 characters.");

  await updateAdminUserPassword(id, password);
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

  await deleteAdminUser(id);
  redirect(`${USERS_PATH}?updated=1`);
}
