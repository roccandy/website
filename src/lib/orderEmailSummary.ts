import { getColorPalette, getPackagingOptions } from "@/lib/data";

type OrderPayload = Record<string, unknown>;

type BillingAddress = {
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
};

export type AdminOrderSummaryItem = {
  title: string;
  quantity: number;
  totalPrice: number | null;
};

export type AdminCustomOrderDetails = {
  imageUrl: string | null;
  orderNumber: string | null;
  weightKg: number | null;
  outerColours: string;
  pinstripe: "Yes" | "No";
  textColour: string;
  heartColour: string;
  packaging: string;
};

export type AdminOrderSummaryEmailPayload = {
  orderNumber: string | null;
  dateOrderedIso: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  requestedDate: string | null;
  deliveryAddress: string;
  paymentMethod: string | null;
  paymentAmount: number;
  items: AdminOrderSummaryItem[];
  customDetails: AdminCustomOrderDetails | null;
};

const normalizeHex = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(trimmed)) return trimmed;
  if (/^[0-9a-f]{6}$/.test(trimmed)) return `#${trimmed}`;
  return null;
};

const titleCase = (value: string) =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const hexToCmyk = (hex: string) => {
  const safe = normalizeHex(hex);
  if (!safe) return null;
  const r = parseInt(safe.slice(1, 3), 16) / 255;
  const g = parseInt(safe.slice(3, 5), 16) / 255;
  const b = parseInt(safe.slice(5, 7), 16) / 255;

  const k = 1 - Math.max(r, g, b);
  if (k >= 0.9999) return "CMYK(0%, 0%, 0%, 100%)";

  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);
  const toPct = (value: number) => `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

  return `CMYK(${toPct(c)}, ${toPct(m)}, ${toPct(y)}, ${toPct(k)})`;
};

const toNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export async function buildAdminOrderSummaryEmailPayload({
  orderPayloads,
  orderNumber,
  requestedDate,
  billing,
  pickup,
  paymentMethod,
  paymentAmount,
}: {
  orderPayloads: OrderPayload[];
  orderNumber: string | null;
  requestedDate: string | null;
  billing: BillingAddress;
  pickup: boolean;
  paymentMethod: string | null;
  paymentAmount: number;
}): Promise<AdminOrderSummaryEmailPayload> {
  const palette = await getColorPalette();
  const packagingOptions = await getPackagingOptions();

  const colourMap = new Map<string, string>();
  for (const row of palette) {
    const key = normalizeHex(row.hex);
    if (!key) continue;
    const shade = row.shade?.toLowerCase() === "main" ? "" : ` (${titleCase(row.shade)})`;
    colourMap.set(key, `${titleCase(row.category)}${shade}`.trim());
  }

  const packagingMap = new Map(
    packagingOptions.map((option) => [
      option.id,
      `${titleCase(option.type)} ${option.size}`.trim(),
    ])
  );

  const formatColour = (value: unknown) => {
    if (typeof value !== "string" || !value.trim()) return "-";
    const hex = normalizeHex(value);
    if (!hex) return titleCase(value);
    const paletteLabel = colourMap.get(hex);
    if (paletteLabel) return paletteLabel;
    return hexToCmyk(hex) || value.toUpperCase();
  };

  const items = orderPayloads.map((payload) => ({
    title: String(payload.title ?? "Order item"),
    quantity: Number(payload.quantity ?? 1),
    totalPrice: toNumber(payload.total_price),
  }));

  const customItems = orderPayloads.filter((payload) => Boolean(payload.packaging_option_id));
  const firstCustom = customItems[0] ?? null;

  let customDetails: AdminCustomOrderDetails | null = null;
  if (firstCustom) {
    const jacketTypeRaw = String(firstCustom.jacket_type ?? firstCustom.jacket ?? "").toLowerCase();
    const rainbow = jacketTypeRaw.includes("rainbow");
    const pinstripe = jacketTypeRaw.includes("pinstripe");
    const colourOne = formatColour(firstCustom.jacket_color_one);
    const colourTwoRaw = formatColour(firstCustom.jacket_color_two);
    const hasSecondColour = typeof firstCustom.jacket_color_two === "string" && firstCustom.jacket_color_two.trim().length > 0;
    const outerColours = rainbow
      ? "Rainbow"
      : hasSecondColour
        ? `${colourOne} + ${colourTwoRaw}`
        : colourOne;

    const customWeight = customItems.reduce((sum, payload) => sum + (toNumber(payload.total_weight_kg) ?? 0), 0);
    const packagingLabel = packagingMap.get(String(firstCustom.packaging_option_id ?? "")) ?? "-";
    const imageUrl =
      (typeof firstCustom.logo_url === "string" && firstCustom.logo_url.trim()) ||
      (typeof firstCustom.label_image_url === "string" && firstCustom.label_image_url.trim()) ||
      null;

    customDetails = {
      imageUrl,
      orderNumber,
      weightKg: customWeight > 0 ? customWeight : null,
      outerColours,
      pinstripe: pinstripe ? "Yes" : "No",
      textColour: formatColour(firstCustom.text_color),
      heartColour: formatColour(firstCustom.heart_color),
      packaging: packagingLabel,
    };
  }

  const firstItem = orderPayloads[0] ?? {};
  const customerName = String(firstItem.customer_name ?? "").trim() || null;
  const customerEmail = String(firstItem.customer_email ?? "").trim() || null;
  const customerPhone = String(firstItem.phone ?? "").trim() || null;

  const deliveryAddress = pickup
    ? "Pickup"
    : [billing.address_1, billing.address_2, billing.city, billing.state, billing.postcode]
        .filter((part) => typeof part === "string" && part.trim().length > 0)
        .join(", ") || "-";

  return {
    orderNumber,
    dateOrderedIso: new Date().toISOString(),
    customerName,
    customerEmail,
    customerPhone,
    requestedDate,
    deliveryAddress,
    paymentMethod,
    paymentAmount,
    items,
    customDetails,
  };
}
