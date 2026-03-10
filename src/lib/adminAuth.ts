import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import type { AdminRole } from "@/types/next-auth";

export const READ_ONLY_MESSAGE = "User is read only. Contact admin@roccandy.com.au for permission.";
export const SEO_READ_ONLY_MESSAGE = "User can only edit SEO content. Other admin areas are read only.";

type WriteAccessOptions = {
  onDenied?: "throw" | "redirect";
  redirectTo?: string;
};

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

export function appendAdminToast(target: string, tone: "success" | "error", message: string) {
  const url = new URL(target, "http://admin.local");
  url.searchParams.set("toast", tone);
  url.searchParams.set("message", message);
  const path = `${url.pathname}${url.search}${url.hash}`;
  return path.startsWith("/") ? path : `/${path}`;
}

async function resolveAdminRedirectTarget(explicitTarget?: string) {
  if (explicitTarget) {
    return explicitTarget;
  }

  const headerStore = await headers();
  const referer = headerStore.get("referer");
  if (!referer) {
    return "/admin";
  }

  try {
    const url = new URL(referer);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/admin";
  }
}

export async function requireAdminWriteAccess(options: WriteAccessOptions = {}) {
  const session = await requireAdminSession();
  if (!session.user.canWrite) {
    if (options.onDenied === "redirect") {
      redirect(appendAdminToast(await resolveAdminRedirectTarget(options.redirectTo), "error", READ_ONLY_MESSAGE));
    }
    throw new Error(READ_ONLY_MESSAGE);
  }
  return session;
}

export async function requireAdminSeoWriteAccess(options: WriteAccessOptions = {}) {
  const session = await requireAdminSession();
  if (!session.user.canWriteSeo) {
    if (options.onDenied === "redirect") {
      redirect(appendAdminToast(await resolveAdminRedirectTarget(options.redirectTo), "error", READ_ONLY_MESSAGE));
    }
    throw new Error(READ_ONLY_MESSAGE);
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
