import type { AdminRole } from "@/types/next-auth";

export function removesActiveAdmin(
  user: { role: AdminRole; is_active: boolean },
  next: { role: AdminRole; is_active: boolean } | null,
) {
  return user.role === "admin" && user.is_active && (!next || next.role !== "admin" || !next.is_active);
}
