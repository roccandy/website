import { getColorPalette, getLabelTypes, getPackagingOptions } from "@/lib/data";
import { supabaseAdminClient } from "@/lib/supabase/admin";

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
  labelsCount: number | null;
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
  ingredientLabels: string;
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
  customDetailsList: AdminCustomOrderDetails[];
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
    const { error } = await supabaseAdminClient.storage.from(bucket).upload(objectPath, bytes, {
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
  const showHeart = designType.includes("wedding");
  const isInitials = designType === "weddings-initials" || String(payload.category_id ?? "").toLowerCase() === "weddings-initials";
  const isBranded = designType === "branded" || String(payload.category_id ?? "").toLowerCase() === "branded";
  const categoryId = String(payload.category_id ?? "").toLowerCase();
  const customTextVariant =
    categoryId === "custom-1-6"
      ? "short"
      : categoryId === "custom-7-14" || designType.includes("custom")
        ? "long"
        : "";
  const sourceText = String(payload.design_text ?? payload.title ?? "").trim();
  const { lineOne, lineTwo } = designType.includes("wedding")
    ? deriveWeddingNames(sourceText)
    : { lineOne: "", lineTwo: "" };
  const logoUrl = isBranded && typeof payload.logo_url === "string" ? payload.logo_url.trim() : "";

  const params = new URLSearchParams({
    mode,
    showPinstripe: modeRaw.includes("pinstripe") ? "1" : "0",
    colorOne: String(payload.jacket_color_one ?? "#b7b7b7"),
    colorTwo: String(payload.jacket_color_two ?? payload.jacket_color_one ?? "#b7b7b7"),
    textColor: String(payload.text_color ?? "#5f5f5f"),
    heartColor: String(payload.heart_color ?? payload.text_color ?? "#5f5f5f"),
    designText: designType.includes("wedding") ? "" : sourceText,
    lineOne,
    lineTwo,
    showHeart: showHeart ? "1" : "0",
    isInitials: isInitials ? "1" : "0",
  });
  if (logoUrl) params.set("logoUrl", logoUrl);
  if (customTextVariant) params.set("customTextVariant", customTextVariant);
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
  customPreviews,
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
  customPreviews?: Array<{
    orderNumber?: string | null;
    previewSvg?: string | null;
    previewPngDataUrl?: string | null;
  }>;
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
    labelsCount: toNumber(payload.labels_count),
    totalPrice: toNumber(payload.total_price),
  }));

  const customItems = orderPayloads.filter((payload) => Boolean(payload.packaging_option_id));

  const customDetailsList = await Promise.all(customItems.map(async (customItem, index) => {
    const customOrderNumber = String(customItem.order_number ?? "").trim() || orderNumber;
    const preview =
      customPreviews?.find((item) => item.orderNumber && item.orderNumber === customOrderNumber) ??
      customPreviews?.[index] ??
      null;
    const designType = String(customItem.design_type ?? customItem.category_id ?? "").toLowerCase();
    const isBranded = designType === "branded" || String(customItem.category_id ?? "").toLowerCase() === "branded";
    const hasLogoUrl = typeof customItem.logo_url === "string" && customItem.logo_url.trim().length > 0;
    const jacketTypeRaw = String(customItem.jacket_type ?? "").toLowerCase();
    const jacketRaw = String(customItem.jacket ?? "").toLowerCase();
    const jacketCombined = `${jacketTypeRaw} ${jacketRaw}`.trim();
    const rainbow = jacketCombined.includes("rainbow");
    const pinstripe = jacketCombined.includes("pinstripe");
    const colourOne = formatColour(customItem.jacket_color_one);
    const colourTwoRaw = formatColour(customItem.jacket_color_two);
    const hasSecondColour = typeof customItem.jacket_color_two === "string" && customItem.jacket_color_two.trim().length > 0;
    const outerColours = rainbow
      ? "Rainbow"
      : hasSecondColour
        ? `${colourOne} + ${colourTwoRaw}`
        : colourOne;

    const customWeight = toNumber(customItem.total_weight_kg) ?? 0;
    const packagingLabel = packagingMap.get(String(customItem.packaging_option_id ?? "")) ?? "-";
    const packageQty = Math.max(1, Number(customItem.quantity ?? 1) || 1);
    const lidColourRaw = String(customItem.jar_lid_color ?? "").trim();
    const lidDetail = lidColourRaw ? ` (Lid colour: ${formatColour(lidColourRaw)})` : "";
    const packagingWithQty = `${packageQty} x ${packagingLabel}${lidDetail}`;
    const notesRaw = String(customItem.notes ?? "").toLowerCase();
    const ingredientLabelsCount = toNumber(customItem.ingredient_labels_count);
    const ingredientLabels = Number.isFinite(ingredientLabelsCount)
      ? String(Math.max(0, Math.floor(ingredientLabelsCount as number)))
      : notesRaw.includes("ingredient labels requested")
        ? "Yes"
        : "No";
    const labelType = labelTypeMap.get(String(customItem.label_type_id ?? "")) ?? "No label selected";
    const labelImageUrl =
      typeof customItem.label_image_url === "string" && customItem.label_image_url.trim()
        ? customItem.label_image_url
        : null;
    const previewPngDataUrl =
      typeof preview?.previewPngDataUrl === "string" && preview.previewPngDataUrl.trim().startsWith("data:image/")
        ? preview.previewPngDataUrl.trim()
        : index === 0 && typeof customPreviewPngDataUrl === "string" && customPreviewPngDataUrl.trim().startsWith("data:image/")
          ? customPreviewPngDataUrl.trim()
        : null;
    const previewSvgDataUrl = buildDataUrlFromSvg(
      typeof preview?.previewSvg === "string"
        ? preview.previewSvg
        : index === 0 && typeof customPreviewSvg === "string"
          ? customPreviewSvg
          : null
    );
    const generatedPreviewUrl = buildCandyPreviewUrl(customItem);
    const previewSource =
      isBranded && hasLogoUrl
        ? previewPngDataUrl ?? generatedPreviewUrl ?? previewSvgDataUrl
        : previewPngDataUrl ?? previewSvgDataUrl ?? generatedPreviewUrl;
    const persistedPreviewUrl = await persistEmailPreview(
      previewSource,
      customOrderNumber
    );
    const imageUrl =
      persistedPreviewUrl ||
      generatedPreviewUrl ||
      (typeof customItem.logo_url === "string" && customItem.logo_url.trim()) ||
      null;
    const shouldShowHeart =
      typeof customItem.heart_color === "string" &&
      customItem.heart_color.trim().length > 0 &&
      String(customItem.design_type ?? "").toLowerCase().includes("wedding");

    const detail: AdminCustomOrderDetails = {
      imageUrl,
      imageDataUrl: previewPngDataUrl,
      orderNumber: customOrderNumber,
      weightKg: customWeight > 0 ? customWeight : null,
      outerColours,
      pinstripe: pinstripe ? "Yes" : "No",
      textColour: formatColour(customItem.text_color),
      heartColour: shouldShowHeart ? formatColour(customItem.heart_color) : null,
      packaging: packagingWithQty,
      labels: labelType,
      labelImageUrl,
      ingredientLabels,
    };
    return detail;
  }));
  const customDetails = customDetailsList[0] ?? null;

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
    customDetailsList,
  };
}
