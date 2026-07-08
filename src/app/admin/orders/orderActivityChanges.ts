import type { OrderRow } from "@/lib/data";

export type OrderActivityChange = {
  field: string;
  from: string;
  to: string;
};

type ChangeKind = "attachment" | "batchWeights" | "boolean" | "date" | "money" | "pickup" | "status" | "text" | "weight";

type ChangeField = {
  key: keyof OrderRow;
  label: string;
  kind?: ChangeKind;
};

const CHANGE_FIELDS: ChangeField[] = [
  { key: "title", label: "Title" },
  { key: "order_description", label: "Description" },
  { key: "category_id", label: "Order type" },
  { key: "packaging_option_id", label: "Packaging" },
  { key: "quantity", label: "Quantity" },
  { key: "total_weight_kg", label: "Weight", kind: "weight" },
  { key: "admin_batch_weights_kg", label: "Batch weights", kind: "batchWeights" },
  { key: "total_price", label: "Total", kind: "money" },
  { key: "due_date", label: "Due date", kind: "date" },
  { key: "status", label: "Status", kind: "status" },
  { key: "payment_method", label: "Payment method" },
  { key: "customer_name", label: "Customer" },
  { key: "customer_email", label: "Customer email" },
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "phone", label: "Phone" },
  { key: "organization_name", label: "Organisation" },
  { key: "pickup", label: "Delivery mode", kind: "pickup" },
  { key: "address_line1", label: "Address line 1" },
  { key: "address_line2", label: "Address line 2" },
  { key: "suburb", label: "Suburb" },
  { key: "state", label: "State" },
  { key: "postcode", label: "Postcode" },
  { key: "labels_count", label: "Custom labels" },
  { key: "ingredient_labels_count", label: "Ingredient labels" },
  { key: "jar_lid_color", label: "Jar lid colour" },
  { key: "jacket", label: "Jacket" },
  { key: "jacket_type", label: "Jacket type" },
  { key: "jacket_color_one", label: "Jacket colour 1" },
  { key: "jacket_color_two", label: "Jacket colour 2" },
  { key: "text_color", label: "Text colour" },
  { key: "heart_color", label: "Heart colour" },
  { key: "flavor", label: "Flavour" },
  { key: "design_type", label: "Design type" },
  { key: "design_text", label: "Design text" },
  { key: "logo_url", label: "Logo", kind: "attachment" },
  { key: "label_image_url", label: "Label image", kind: "attachment" },
  { key: "label_type_id", label: "Label type" },
  { key: "notes", label: "Internal notes" },
  { key: "customer_note", label: "Customer note" },
  { key: "admin_pricing_subtotal", label: "Pricing subtotal", kind: "money" },
  { key: "admin_discount_type", label: "Discount type" },
  { key: "admin_discount_value", label: "Discount value" },
  { key: "admin_price_override", label: "Price override", kind: "money" },
  { key: "square_invoice_title", label: "Invoice title" },
];

const TEXT_LIMIT = 120;

const hasKey = (value: Record<string, unknown>, key: keyof OrderRow) =>
  Object.prototype.hasOwnProperty.call(value, key);

const roundTo = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const trimTrailingZeros = (value: string) => value.replace(/\.?0+$/, "");

const formatNumber = (value: number, decimals = 2) => {
  const rounded = roundTo(value, decimals);
  return trimTrailingZeros(rounded.toFixed(decimals));
};

const normalizeText = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
};

const truncateText = (value: string) =>
  value.length > TEXT_LIMIT ? `${value.slice(0, TEXT_LIMIT - 3).trimEnd()}...` : value;

const normalizeNumber = (value: unknown, decimals = 2) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? roundTo(parsed, decimals) : null;
};

const normalizeBatchWeights = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((weight) => normalizeNumber(weight, 2))
    .filter((weight): weight is number => weight !== null && weight > 0);
};

const normalizeValue = (value: unknown, kind: ChangeKind) => {
  if (kind === "batchWeights") return normalizeBatchWeights(value);
  if (kind === "money" || kind === "weight") return normalizeNumber(value, 2);
  if (kind === "boolean" || kind === "pickup") return value === null || value === undefined ? null : Boolean(value);
  if (kind === "date") return normalizeText(value)?.slice(0, 10) ?? null;
  return normalizeText(value);
};

const valuesMatch = (before: unknown, after: unknown) => JSON.stringify(before) === JSON.stringify(after);

const formatBatchWeights = (value: unknown) => {
  const weights = normalizeBatchWeights(value);
  return weights.length > 0 ? weights.map((weight) => `${formatNumber(weight)}kg`).join(" + ") : "-";
};

const formatAttachmentChange = (before: unknown, after: unknown) => {
  const hadAttachment = Boolean(normalizeText(before));
  const hasAttachment = Boolean(normalizeText(after));
  if (hadAttachment && hasAttachment) return { from: "Attached", to: "Changed" };
  return { from: hadAttachment ? "Attached" : "-", to: hasAttachment ? "Attached" : "-" };
};

const formatValue = (value: unknown, kind: ChangeKind) => {
  if (kind === "batchWeights") return formatBatchWeights(value);
  if (kind === "money") {
    const normalized = normalizeNumber(value, 2);
    return normalized === null ? "-" : `$${normalized.toFixed(2)}`;
  }
  if (kind === "weight") {
    const normalized = normalizeNumber(value, 2);
    return normalized === null ? "-" : `${formatNumber(normalized)}kg`;
  }
  if (kind === "pickup") {
    if (value === null || value === undefined) return "-";
    return Boolean(value) ? "Pickup" : "Delivery";
  }
  if (kind === "boolean") {
    if (value === null || value === undefined) return "-";
    return Boolean(value) ? "Yes" : "No";
  }
  if (kind === "date") return normalizeText(value)?.slice(0, 10) ?? "-";
  if (kind === "status") return normalizeText(value)?.replace(/_/g, " ") ?? "-";
  const text = normalizeText(value);
  return text ? truncateText(text) : "-";
};

export function buildOrderActivityChanges(
  existing: OrderRow,
  next: Partial<Record<keyof OrderRow, unknown>>,
): OrderActivityChange[] {
  const nextRecord = next as Record<string, unknown>;

  return CHANGE_FIELDS.flatMap((field) => {
    if (!hasKey(nextRecord, field.key)) return [];

    const kind = field.kind ?? "text";
    const beforeValue = existing[field.key];
    const afterValue = next[field.key];
    if (afterValue === undefined) return [];

    const normalizedBefore = normalizeValue(beforeValue, kind);
    const normalizedAfter = normalizeValue(afterValue, kind);
    if (valuesMatch(normalizedBefore, normalizedAfter)) return [];

    if (kind === "attachment") {
      return [{ field: field.label, ...formatAttachmentChange(beforeValue, afterValue) }];
    }

    return [
      {
        field: field.label,
        from: formatValue(beforeValue, kind),
        to: formatValue(afterValue, kind),
      },
    ];
  });
}
