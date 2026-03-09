import { supabaseServerClient } from "@/lib/supabase/server";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import type { AdminRole } from "@/types/next-auth";

const ADMIN_USERS_TABLE = "admin_users";

export type AdminUserRecord = {
  id: string;
  email: string;
  display_name: string | null;
  password_hash: string;
  role: AdminRole;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  last_login_at?: string | null;
};

export function getRolePermissions(role: AdminRole) {
  return {
    canWrite: role === "editor" || role === "admin",
    canManageUsers: role === "admin",
  };
}

export function normalizeAdminEmail(email: string) {
  return email.trim().toLowerCase();
}

function isMissingTableError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("admin_users") && (normalized.includes("does not exist") || normalized.includes("schema cache"));
}

export async function listAdminUsers() {
  const { data, error } = await supabaseServerClient
    .from(ADMIN_USERS_TABLE)
    .select("id,email,display_name,password_hash,role,is_active,created_at,updated_at,last_login_at")
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingTableError(error.message)) return [];
    throw new Error(error.message);
  }

  return (data ?? []) as AdminUserRecord[];
}

export async function getAdminUserByEmail(email: string) {
  const normalized = normalizeAdminEmail(email);
  const { data, error } = await supabaseServerClient
    .from(ADMIN_USERS_TABLE)
    .select("id,email,display_name,password_hash,role,is_active,created_at,updated_at,last_login_at")
    .eq("email", normalized)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error.message)) return null;
    throw new Error(error.message);
  }

  return (data as AdminUserRecord | null) ?? null;
}

export async function hasAnyAdminUsers() {
  const { count, error } = await supabaseServerClient
    .from(ADMIN_USERS_TABLE)
    .select("id", { count: "exact", head: true });

  if (error) {
    if (isMissingTableError(error.message)) return false;
    throw new Error(error.message);
  }

  return (count ?? 0) > 0;
}

export async function createAdminUser(input: {
  email: string;
  displayName?: string | null;
  password: string;
  role: AdminRole;
}) {
  const email = normalizeAdminEmail(input.email);
  const passwordHash = hashPassword(input.password);
  const { error } = await supabaseServerClient.from(ADMIN_USERS_TABLE).insert({
    email,
    display_name: input.displayName?.trim() || null,
    password_hash: passwordHash,
    role: input.role,
    is_active: true,
  });
  if (error) throw new Error(error.message);
}

export async function updateAdminUserProfile(input: {
  id: string;
  displayName?: string | null;
  role: AdminRole;
  isActive: boolean;
}) {
  const { error } = await supabaseServerClient
    .from(ADMIN_USERS_TABLE)
    .update({
      display_name: input.displayName?.trim() || null,
      role: input.role,
      is_active: input.isActive,
    })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
}

export async function updateAdminUserPassword(id: string, password: string) {
  const { error } = await supabaseServerClient
    .from(ADMIN_USERS_TABLE)
    .update({ password_hash: hashPassword(password) })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteAdminUser(id: string) {
  const { error } = await supabaseServerClient.from(ADMIN_USERS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function verifyAdminUserPassword(email: string, password: string) {
  const user = await getAdminUserByEmail(email);
  if (!user || !user.is_active) return null;
  if (!verifyPassword(password, user.password_hash)) return null;

  await supabaseServerClient
    .from(ADMIN_USERS_TABLE)
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", user.id);

  return user;
}
