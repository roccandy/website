export const ADMIN_PREMADE_CATEGORY_ID = "__admin_premade__";
export const ADMIN_PREMADE_ORDER_LABEL = "Premade";

export function isAdminPremadeCategoryId(value: string | null | undefined) {
  return (value ?? "").trim() === ADMIN_PREMADE_CATEGORY_ID;
}

export function isAdminPremadeOrder(input: {
  category_id?: string | null;
  design_type?: string | null;
} | null | undefined) {
  return input?.design_type === "premade" && isAdminPremadeCategoryId(input.category_id);
}
