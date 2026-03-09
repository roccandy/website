import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import type { AdminRole } from "@/types/next-auth";

export async function getAdminSession() {
  return getServerSession(authOptions);
}

export async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  return session;
}

export async function requireAdminWriteAccess() {
  const session = await requireAdminSession();
  if (!session.user.canWrite) {
    throw new Error("Read-only users cannot make changes.");
  }
  return session;
}

export async function requireAdminRole(role: AdminRole) {
  const session = await requireAdminSession();
  if (session.user.role !== role) {
    throw new Error("You do not have permission to perform this action.");
  }
  return session;
}

export async function requireAdminManageUsersAccess() {
  const session = await requireAdminSession();
  if (!session.user.canManageUsers) {
    throw new Error("Only full admins can manage users.");
  }
  return session;
}
