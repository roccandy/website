export const ADMIN_PREMADE_CATEGORY_ID = "__admin_premade__";
export const ADMIN_PREMADE_ORDER_LABEL = "Premade";
export const ADMIN_PREMADE_ORDER_MARKER = "[admin-premade-stock]";

export function isAdminPremadeCategoryId(value: string | null | undefined) {
  return (value ?? "").trim() === ADMIN_PREMADE_CATEGORY_ID;
}

export function isAdminPremadeOrder(input: {
  category_id?: string | null;
  design_type?: string | null;
  notes?: string | null;
  title?: string | null;
} | null | undefined) {
  if (input?.design_type !== "premade") return false;
  const notes = input.notes?.trim() ?? "";
  if (notes === ADMIN_PREMADE_ORDER_MARKER) return true;
  const title = input.title?.trim().toLowerCase() ?? "";
  return title.startsWith("premade stock -");
}
