import { getColorPalette, getLabelTypes, getPackagingOptions } from "@/lib/data";
import { supabaseServerClient } from "@/lib/supabase/server";

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
  imageDataUrl: string | null;
  orderNumber: string | null;
  weightKg: number | null;
  outerColours: string;
  pinstripe: "Yes" | "No";
  textColour: string;
  heartColour: string | null;
  packaging: string;
  labels: string;
  labelImageUrl: string | null;
  ingredientLabels: "Yes" | "No";
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

const ensureBaseUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, "");
  return `https://${trimmed.replace(/\/+$/, "")}`;
};

const getSiteBaseUrl = () => {
  const vercel = ensureBaseUrl(process.env.VERCEL_URL ?? "");
  if (vercel) return vercel;
  const explicit = ensureBaseUrl(process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "");
  if (explicit) return explicit;
  return null;
};

const safeOrderToken = (value: string | null | undefined) =>
  (value ?? "order")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "") || "order";

const encodeStoragePath = (value: string) =>
  value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const DATA_IMAGE_REGEX = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\s]+)$/;

const buildDataUrlFromSvg = (svg: string | null | undefined) => {
  if (!svg) return null;
  const trimmed = svg.trim();
  if (!trimmed.startsWith("<svg")) return null;
  return `data:image/svg+xml;base64,${Buffer.from(trimmed, "utf8").toString("base64")}`;
};

async function persistEmailPreview(previewSource: string | null, orderNumber: string | null | undefined) {
  if (!previewSource) return null;

  const supabaseBase = ensureBaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "");
  if (!supabaseBase) return null;

  const bucket = process.env.EMAIL_PREVIEW_BUCKET?.trim() || "flavor-images";
  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const orderKey = safeOrderToken(orderNumber);

  try {
    let contentType = "image/png";
    let bytes: Buffer | null = null;

    const dataMatch = previewSource.match(DATA_IMAGE_REGEX);
    if (dataMatch) {
      contentType = dataMatch[1] || contentType;
      bytes = Buffer.from(dataMatch[2].replace(/\s+/g, ""), "base64");
    } else if (/^https?:\/\//i.test(previewSource)) {
      const response = await fetch(previewSource, { cache: "no-store" });
      if (!response.ok) return previewSource;
      contentType = response.headers.get("content-type") || contentType;
      if (!contentType.startsWith("image/")) return previewSource;
      bytes = Buffer.from(await response.arrayBuffer());
    } else {
      return null;
    }
    if (!bytes || bytes.length === 0) return null;

    const ext = contentType.includes("jpeg")
      ? "jpg"
      : contentType.includes("webp")
        ? "webp"
        : contentType.includes("gif")
          ? "gif"
          : contentType.includes("svg")
            ? "svg"
            : "png";
    const objectPath = `email-previews/${monthKey}/${orderKey}-${Date.now()}.${ext}`;
    const { error } = await supabaseServerClient.storage.from(bucket).upload(objectPath, bytes, {
      upsert: false,
      contentType,
      cacheControl: "31536000",
    });
    if (error) {
      console.warn("Email preview upload failed:", error.message);
      return null;
    }
    return `${supabaseBase}/storage/v1/object/public/${bucket}/${encodeStoragePath(objectPath)}`;
  } catch (error) {
    console.warn("Email preview generation failed:", error);
    return null;
  }
}

const deriveWeddingNames = (value: string) => {
  const raw = value.trim();
  if (!raw) return { lineOne: "", lineTwo: "" };
  const separators = [" + ", " & ", " and ", "+", "&"];
  for (const separator of separators) {
    if (!raw.toLowerCase().includes(separator.trim().toLowerCase())) continue;
    const parts = raw.split(new RegExp(separator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    if (parts.length >= 2) {
      return {
        lineOne: parts[0]?.trim() ?? "",
        lineTwo: parts.slice(1).join(" ").trim(),
      };
    }
  }
  return { lineOne: raw, lineTwo: "" };
};

const buildCandyPreviewUrl = (payload: OrderPayload) => {
  const baseUrl = getSiteBaseUrl();
  if (!baseUrl) return null;

  const designType = String(payload.design_type ?? "").toLowerCase();
  const modeRaw = String(payload.jacket_type ?? payload.jacket ?? "").toLowerCase();
  const mode = modeRaw.includes("rainbow")
    ? "rainbow"
    : modeRaw.includes("two_colour")
      ? "two_colour"
      : modeRaw.includes("pinstripe")
        ? "pinstripe"
        : "solid";
  const showHeart =
    Boolean(payload.heart_color) &&
    designType.includes("wedding");
  const sourceText = String(payload.design_text ?? payload.title ?? "").trim();
  const { lineOne, lineTwo } = designType.includes("wedding")
    ? deriveWeddingNames(sourceText)
    : { lineOne: "", lineTwo: "" };

  const params = new URLSearchParams({
    mode,
    colorOne: String(payload.jacket_color_one ?? "#b7b7b7"),
    colorTwo: String(payload.jacket_color_two ?? payload.jacket_color_one ?? "#b7b7b7"),
    textColor: String(payload.text_color ?? "#5f5f5f"),
    heartColor: String(payload.heart_color ?? payload.text_color ?? "#5f5f5f"),
    designText: designType.includes("wedding") ? "" : sourceText,
    lineOne,
    lineTwo,
    showHeart: showHeart ? "1" : "0",
  });
  return `${baseUrl}/api/preview/candy-image?${params.toString()}`;
};

export async function buildAdminOrderSummaryEmailPayload({
  orderPayloads,
  orderNumber,
  requestedDate,
  billing,
  pickup,
  paymentMethod,
  paymentAmount,
  customPreviewSvg,
  customPreviewPngDataUrl,
}: {
  orderPayloads: OrderPayload[];
  orderNumber: string | null;
  requestedDate: string | null;
  billing: BillingAddress;
  pickup: boolean;
  paymentMethod: string | null;
  paymentAmount: number;
  customPreviewSvg?: string | null;
  customPreviewPngDataUrl?: string | null;
}): Promise<AdminOrderSummaryEmailPayload> {
  const palette = await getColorPalette();
  const [packagingOptions, labelTypes] = await Promise.all([
    getPackagingOptions(),
    getLabelTypes(),
  ]);

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
  const labelTypeMap = new Map(
    labelTypes.map((labelType) => [labelType.id, `${titleCase(labelType.shape)} ${labelType.dimensions}`.trim()])
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
    const packagingLines = customItems.map((payload) => {
      const packagingLabel = packagingMap.get(String(payload.packaging_option_id ?? "")) ?? "-";
      const packageQty = Math.max(1, Number(payload.quantity ?? 1) || 1);
      const lidColourRaw = String(payload.jar_lid_color ?? "").trim();
      const lidDetail = lidColourRaw ? ` (Lid colour: ${formatColour(lidColourRaw)})` : "";
      return `${packageQty} x ${packagingLabel}${lidDetail}`;
    });
    const packagingWithQty = packagingLines.join(" | ");
    const notesRaw = String(firstCustom.notes ?? "").toLowerCase();
    const ingredientLabels = notesRaw.includes("ingredient labels requested") ? "Yes" : "No";
    const labelType = labelTypeMap.get(String(firstCustom.label_type_id ?? "")) ?? "No label selected";
    const labelImageUrl =
      typeof firstCustom.label_image_url === "string" && firstCustom.label_image_url.trim()
        ? firstCustom.label_image_url
        : null;
    const previewPngDataUrl =
      typeof customPreviewPngDataUrl === "string" && customPreviewPngDataUrl.trim().startsWith("data:image/")
        ? customPreviewPngDataUrl.trim()
        : null;
    const previewSvgDataUrl = buildDataUrlFromSvg(
      typeof customPreviewSvg === "string" ? customPreviewSvg : null
    );
    const generatedPreviewUrl = buildCandyPreviewUrl(firstCustom);
    const persistedPreviewUrl = await persistEmailPreview(
      previewPngDataUrl ?? previewSvgDataUrl ?? generatedPreviewUrl,
      orderNumber
    );
    const imageUrl =
      persistedPreviewUrl ||
      generatedPreviewUrl ||
      (typeof firstCustom.logo_url === "string" && firstCustom.logo_url.trim()) ||
      null;
    const shouldShowHeart =
      typeof firstCustom.heart_color === "string" &&
      firstCustom.heart_color.trim().length > 0 &&
      String(firstCustom.design_type ?? "").toLowerCase().includes("wedding");

    customDetails = {
      imageUrl,
      imageDataUrl: previewPngDataUrl,
      orderNumber,
      weightKg: customWeight > 0 ? customWeight : null,
      outerColours,
      pinstripe: pinstripe ? "Yes" : "No",
      textColour: formatColour(firstCustom.text_color),
      heartColour: shouldShowHeart ? formatColour(firstCustom.heart_color) : null,
      packaging: packagingWithQty,
      labels: labelType,
      labelImageUrl,
      ingredientLabels,
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
