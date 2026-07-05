import Image from "next/image";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { CandyPreview } from "@/app/quote/CandyPreview";
import { paletteSections } from "@/app/admin/settings/palette";
import type { OrderRow } from "@/lib/data";
import { hasIngredientLabelsRequested } from "@/lib/customPricingInput";
import {
  batchWeightsForOrder,
  formatPackagingOptionLabel,
  logoDownloadNameForOrder,
} from "@/app/admin/orders/productionScheduleShared";
import { resolveCandyPreviewJacket } from "@/app/admin/orders/orderColorUtils";
import { PrintButton } from "./PrintButton";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Params = {
  params?: { id?: string } | Promise<{ id?: string }>;
  searchParams?: { id?: string } | Promise<{ id?: string }>;
};

const hexToCmyk = (hex: string) => {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);
  const pct = (v: number) => Math.round(v * 100);
  return { c: pct(c), m: pct(m), y: pct(y), k: pct(k) };
};

const renderCmyk = (cmyk: { c: number; m: number; y: number; k: number }) => (
  <span className="inline-flex flex-wrap gap-x-3 gap-y-1">
    <span>
      <span className="font-semibold">C:</span> {cmyk.c}
    </span>
    <span>
      <span className="font-semibold">M:</span> {cmyk.m}
    </span>
    <span>
      <span className="font-semibold">Y:</span> {cmyk.y}
    </span>
    <span>
      <span className="font-semibold">K:</span> {cmyk.k}
    </span>
  </span>
);

const normalizeHeart = (text: string) =>
  text
    .replace(/&#x2665;|&#9829;|&hearts;|&heart;/gi, "\u2665")
    .replace(/\u00E2\u009D\u00A4\u00EF\u00B8\u008F|\u00E2\u009D\u00A4|\u00E2\u0099\u00A5|\u0192T\u00BE/g, "\u2665")
    .replace(/[\u2665\u2764]\ufe0f?/g, "\u2665")
    .replace(/\ufe0f/g, "")
    .replace(/\s*\u2665\s*/g, " \u2665 ");

const isImageUrl = (value: string) => {
  if (/^data:image\//i.test(value)) return true;
  try {
    const url = new URL(value);
    const ext = url.pathname.split(".").pop()?.toLowerCase();
    return ext ? ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext) : false;
  } catch {
    const ext = value.split("?")[0].split(".").pop()?.toLowerCase();
    return ext ? ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext) : false;
  }
};

const sanitizeFilenamePart = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 120);

const getFileExtensionFromUrl = (value: string) => {
  const dataUrlMatch = value.match(/^data:([^;,]+)[;,]/i);
  if (dataUrlMatch?.[1]) {
    const mime = dataUrlMatch[1].toLowerCase();
    if (mime === "image/jpeg") return "jpg";
    if (mime === "image/png") return "png";
    if (mime === "image/gif") return "gif";
    if (mime === "image/webp") return "webp";
    if (mime === "image/svg+xml") return "svg";
    return "png";
  }

  try {
    const url = new URL(value);
    const ext = url.pathname.split(".").pop()?.toLowerCase() ?? "";
    return ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext) ? ext : "png";
  } catch {
    const ext = value.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
    return ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext) ? ext : "png";
  }
};

const CARD_CLASS = "rounded-2xl border border-zinc-200 p-4 print:p-2";
const SECTION_HEADING_CLASS = "text-[11px] uppercase tracking-[0.22em] text-zinc-500";
const SECTION_BODY_CLASS = "mt-3 space-y-2 print:mt-1 print:space-y-1";
const INLINE_ROW_CLASS = "flex flex-wrap items-baseline gap-x-2 gap-y-1";
const INLINE_LABEL_CLASS = "text-[10px] tracking-[0.04em] text-zinc-500";
const INLINE_VALUE_CLASS = "font-semibold text-zinc-900";
const SPEC_ROW_CLASS = "flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[20px] leading-[1.15]";
const SPEC_LABEL_CLASS = "text-[10px] tracking-[0.04em] text-zinc-500";
const SPEC_VALUE_CLASS = "text-[20px] font-semibold text-zinc-900";
const PRINT_FONT_FAMILY = "Helvetica, Arial, sans-serif";

type ColorDisplay = {
  label: string;
  cmyk?: { c: number; m: number; y: number; k: number };
};

const buildPaletteHexMap = (rows: { category: string; shade: string; hex: string }[]) => {
  const labelByKey = new Map<string, string>();
  paletteSections.forEach((section) => {
    section.items.forEach((item) => {
      labelByKey.set(`${item.categoryKey}:${item.shadeKey}`, item.label);
    });
  });
  const map = new Map<string, string>();
  rows.forEach((row) => {
    const key = `${row.category}:${row.shade}`;
    const label = labelByKey.get(key) ?? `${row.shade} ${row.category}`;
    map.set(row.hex.trim().toLowerCase(), label);
  });
  return map;
};

const resolveColorDisplay = (hex: string | null | undefined, paletteHexMap: Map<string, string>): ColorDisplay | null => {
  if (!hex) return null;
  const normalized = hex.trim().toLowerCase();
  const label = paletteHexMap.get(normalized);
  if (label) return { label };
  const cmyk = hexToCmyk(hex);
  return { label: "Custom", cmyk: cmyk ?? undefined };
};

const formatTokenLabel = (value: string) =>
  value
    .replace(/[-_]+/g, " ")
    .replace(/\w\S*/g, (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());

const resolveJarLidColorDisplay = (
  value: string | null | undefined,
  paletteHexMap: Map<string, string>,
): ColorDisplay | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^#?[0-9a-f]{6}$/i.test(trimmed)) {
    const normalizedHex = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    return resolveColorDisplay(normalizedHex, paletteHexMap);
  }

  return { label: formatTokenLabel(trimmed) };
};

const renderColorDisplay = (display: ColorDisplay | null) => {
  if (!display) return <span className="font-semibold">N/A</span>;
  if (!display.cmyk) return <span className="font-semibold">{display.label}</span>;
  return (
    <span className="inline-flex flex-wrap gap-x-2 gap-y-1">
      <span className="font-semibold">Custom</span>
      {display.cmyk ? renderCmyk(display.cmyk) : null}
    </span>
  );
};

const formatPrintKg = (weight: number) => {
  const rounded = Math.round(weight * 100) / 100;
  return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
};

const groupBatchWeights = (weights: number[]) =>
  weights.reduce<Array<{ weight: number; count: number }>>((groups, weight) => {
    const existing = groups.find((group) => Math.abs(group.weight - weight) < 0.005);
    if (existing) {
      existing.count += 1;
      return groups;
    }
    groups.push({ weight, count: 1 });
    return groups;
  }, []);

const normalizePrintBatchWeights = (weights: number[], totalWeightKg: number) => {
  if (weights.length <= 1 || !Number.isFinite(totalWeightKg) || totalWeightKg <= 0) return weights;
  const allocated = weights.reduce((sum, weight) => sum + weight, 0);
  if (Math.abs(allocated - totalWeightKg) <= 0.02) return weights;

  const base = Math.floor((totalWeightKg / weights.length) * 100) / 100;
  const normalized = Array.from({ length: weights.length }, () => base);
  const allocatedBeforeLast = normalized.slice(0, -1).reduce((sum, weight) => sum + weight, 0);
  normalized[normalized.length - 1] = Math.round((totalWeightKg - allocatedBeforeLast) * 100) / 100;
  return normalized;
};

const resolvePrintQuantity = ({
  quantity,
  totalWeightKg,
  packagingWeightG,
  batchCount,
}: {
  quantity: number | null | undefined;
  totalWeightKg: number;
  packagingWeightG: number | null | undefined;
  batchCount: number;
}) => {
  const storedQuantity = Number(quantity);
  if (!Number.isFinite(storedQuantity) || storedQuantity <= 0) return null;
  const unitWeightG = Number(packagingWeightG);
  if (!Number.isFinite(unitWeightG) || unitWeightG <= 0 || batchCount <= 1) {
    return Math.floor(storedQuantity);
  }

  const totalWeightG = totalWeightKg * 1000;
  const storedTotalWeightG = storedQuantity * unitWeightG;
  const asPerBatchTotalWeightG = storedTotalWeightG * batchCount;
  return Math.abs(totalWeightG - asPerBatchTotalWeightG) < Math.abs(totalWeightG - storedTotalWeightG)
    ? Math.floor(storedQuantity * batchCount)
    : Math.floor(storedQuantity);
};

const batchQuantityLabel = (group: { weight: number; count: number }, totalBatchWeightKg: number, totalQuantity: number | null) => {
  if (!totalQuantity || !Number.isFinite(totalBatchWeightKg) || totalBatchWeightKg <= 0) return "";
  const perBatchQuantity = Math.round((totalQuantity * group.weight) / totalBatchWeightKg);
  if (!Number.isFinite(perBatchQuantity) || perBatchQuantity <= 0) return "";
  return ` (${perBatchQuantity} bags each)`;
};

const formatLabelPrintCount = (count: number | null) => {
  if (!count || !Number.isFinite(count) || count <= 0) return "No";
  return `Yes - ${Math.floor(count)}`;
};

export default async function PrintOrderPage({ params, searchParams }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");

  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const rawId = resolvedParams?.id || resolvedSearchParams?.id || "";

  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  const client = supabaseAdminClient;
  const orderQuery = client.from("orders").select("*");
  let order: OrderRow | null = null;
  let error: { message: string } | null = null;
  if (rawId && rawId !== "undefined") {
    if (isUuid(rawId)) {
      const result = await orderQuery.eq("id", rawId).maybeSingle();
      order = (result.data as OrderRow | null) ?? null;
      error = result.error ? { message: result.error.message } : null;
    } else {
      const result = await orderQuery
        .eq("order_number", rawId)
        .order("created_at", { ascending: false })
        .limit(1);
      order = (result.data?.[0] as OrderRow | null) ?? null;
      error = result.error ? { message: result.error.message } : null;
    }
  }
  if (error || !order) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 bg-white px-6 py-10 text-zinc-900">
        <h1 className="admin-section-title">Order printout</h1>
        <p className="text-sm text-zinc-600">
          Unable to load this order. Please check the order id and try again.
        </p>
        <p className="text-xs text-zinc-500">
          Requested id: {rawId || "missing"} {rawId ? (isUuid(rawId) ? "(uuid)" : "(order number)") : ""}
        </p>
        {error?.message && (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {error.message}
          </p>
        )}
        <Link
          href="/admin/orders"
          className="inline-flex items-center rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
        >
          Back to production schedule
        </Link>
      </div>
    );
  }

  const { data: packagingOptions } = await client.from("packaging_options").select("id,type,size,candy_weight_g");
  const packaging = packagingOptions?.find((opt) => opt.id === order.packaging_option_id) ?? null;
  const { data: orderSlotRows } = await client
    .from("order_slots")
    .select("kg_assigned")
    .eq("order_id", order.id);
  const { data: paletteRows } = await client.from("color_palette").select("category,shade,hex");
  const paletteHexMap = buildPaletteHexMap(paletteRows ?? []);

  const textColorHex = order.text_color || "#b7b7b7";
  const heartColorHex = order.heart_color || textColorHex;
  const textColorDisplay = resolveColorDisplay(textColorHex, paletteHexMap);
  const heartColorDisplay = resolveColorDisplay(heartColorHex, paletteHexMap);
  const jacketColorOneDisplay = resolveColorDisplay(order.jacket_color_one, paletteHexMap);
  const jacketColorTwoDisplay = resolveColorDisplay(order.jacket_color_two, paletteHexMap);
  const jarLidColorDisplay = resolveJarLidColorDisplay(order.jar_lid_color, paletteHexMap);
  const labelImageUrl = order.label_image_url || "";
  const labelImageIsImage = labelImageUrl ? isImageUrl(labelImageUrl) : false;
  const labelDownloadName = (() => {
    const orderNumberPart = sanitizeFilenamePart(order.order_number ? String(order.order_number) : "Unknown");
    const titlePart = sanitizeFilenamePart(order.title ? String(order.title) : "Untitled");
    const ext = getFileExtensionFromUrl(labelImageUrl);
    return `Order#${orderNumberPart} Custom Label ${titlePart}.${ext}`;
  })();
  const logoDownloadName = logoDownloadNameForOrder(order);

  const designText = order.design_text ? normalizeHeart(order.design_text) : "";
  const hasHeart = designText.includes("\u2665");
  const [lineOne, lineTwo] = hasHeart ? designText.split("\u2665").map((part) => part.trim()) : ["", ""];
  const isWeddingInitials = order.category_id === "weddings-initials";
  const isWedding = order.category_id?.startsWith("weddings");
  const jacketPreview = resolveCandyPreviewJacket(order);
  const isBranded = order.category_id === "branded";

  const jacketLabel = (() => {
    if (order.jacket === "rainbow") return "Rainbow";
    if (order.jacket === "two_colour_pinstripe") return "2 Colour + Pinstripe";
    if (order.jacket === "two_colour") return "2 Colour";
    if (order.jacket === "pinstripe") return "Single Colour + Pinstripe";
    return "Single Colour";
  })();
  const labelsToPrint = Number.isFinite(Number(order.labels_count)) && Number(order.labels_count) > 0 ? Number(order.labels_count) : null;
  const ingredientLabelsRequested = hasIngredientLabelsRequested({ notes: order.notes });
  const explicitBatchWeights = Array.isArray(order.admin_batch_weights_kg)
    ? order.admin_batch_weights_kg.map((weight) => Number(weight)).filter((weight) => Number.isFinite(weight) && weight > 0)
    : [];
  const assignmentBatchWeights = (orderSlotRows ?? [])
    .map((slot) => Number(slot.kg_assigned))
    .filter((weight) => Number.isFinite(weight) && weight > 0);
  const batchWeights = normalizePrintBatchWeights(
    explicitBatchWeights.length > 0
      ? explicitBatchWeights
      : assignmentBatchWeights.length > 0
        ? assignmentBatchWeights
        : batchWeightsForOrder(order),
    Number(order.total_weight_kg),
  );
  const batchWeightGroups = groupBatchWeights(batchWeights);
  const totalBatchWeightKg = batchWeights.reduce((sum, weight) => sum + weight, 0);
  const printQuantity = resolvePrintQuantity({
    quantity: order.quantity,
    totalWeightKg: Number(order.total_weight_kg),
    packagingWeightG: packaging?.candy_weight_g,
    batchCount: batchWeights.length,
  });
  const packagingSummary = (() => {
    const packagingLabel = formatPackagingOptionLabel(packaging) || "N/A";
    const summaryParts = [];
    if (printQuantity) {
      summaryParts.push(`Qty: ${printQuantity}`);
    }
    if (packaging?.type?.toLowerCase() === "jar" && jarLidColorDisplay) {
      summaryParts.push(`Lid colour: ${jarLidColorDisplay.label}`);
    }
    return summaryParts.length > 0 ? `${packagingLabel} (${summaryParts.join(", ")})` : packagingLabel;
  })();
  const ingredientLabelsToPrint = (() => {
    const storedCount = Number(order.ingredient_labels_count);
    if (Number.isFinite(storedCount) && storedCount > 0) {
      return Math.floor(storedCount);
    }
    if (!ingredientLabelsRequested) return null;
    const packagingType = packaging?.type?.trim().toLowerCase();
    if (packagingType === "bulk") return null;
    if (printQuantity && printQuantity > 0) {
      return Math.floor(printQuantity);
    }
    return 1;
  })();

  const showJacketColorOne =
    order.jacket === "two_colour" || order.jacket === "two_colour_pinstripe" || order.jacket === "pinstripe" || !order.jacket;
  const showJacketColorTwo = order.jacket === "two_colour" || order.jacket === "two_colour_pinstripe";

  const formatPrintDate = (iso: string | null) => {
    if (!iso) return "";
    try {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "Australia/Perth",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 bg-white px-6 py-8 text-[13px] leading-[1.45] text-zinc-900 print:mx-0 print:max-w-none print:space-y-2 print:px-0 print:py-0 print:text-[10.5px] print:leading-[1.3]">
      <style>{`
        @media print {
          @page { size: A4; margin: 6mm; }
          .print-grid-two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        }
      `}</style>
      <div className="flex items-center justify-between print:hidden">
        <h1 className="admin-section-title">Order printout</h1>
        <PrintButton className="rounded border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300" />
      </div>

      <div className="print-grid-two grid gap-6 md:grid-cols-2 print:gap-2">
        <div className="space-y-6 print:space-y-2">
          <div className={CARD_CLASS}>
            <h2 className={SECTION_HEADING_CLASS}>Candy design</h2>
            <div className="mt-4 flex items-center justify-center print:mt-1 print:scale-[0.85]" style={{ fontFamily: PRINT_FONT_FAMILY }}>
              <CandyPreview
                designText={!isBranded && !isWedding ? designText : undefined}
                lineOne={isWedding ? lineOne : undefined}
                lineTwo={isWedding ? lineTwo : undefined}
                showHeart={isWedding}
                mode={jacketPreview.mode}
                showPinstripe={jacketPreview.showPinstripe}
                colorOne={order.jacket_color_one || "#000000"}
                colorTwo={order.jacket_color_two || "#000000"}
                logoUrl={isBranded ? order.logo_url : undefined}
                textColor={textColorHex}
                heartColor={heartColorHex}
                isInitials={isWeddingInitials}
                customTextVariant={
                  order.category_id === "custom-1-6"
                    ? "short"
                    : order.category_id === "custom-7-14"
                      ? "long"
                      : undefined
                }
              />
            </div>
          </div>

          <div className={CARD_CLASS}>
            <h2 className={SECTION_HEADING_CLASS}>Customer details</h2>
            <div className="mt-3 space-y-4 print:mt-1 print:space-y-2">
              <div>
                <p className={INLINE_ROW_CLASS}>
                  <span className={INLINE_LABEL_CLASS}>Requested date:</span>
                  <span className="font-semibold text-zinc-900" style={{ fontSize: "32pt", lineHeight: 1.1 }}>
                    {formatPrintDate(order.due_date) || "-"}
                  </span>
                </p>
                <div className="mt-3">
                  {order.pickup ? (
                    <p className={INLINE_ROW_CLASS}>
                      <span className={INLINE_LABEL_CLASS}>Delivery:</span>
                      <span className={INLINE_VALUE_CLASS}>Pickup</span>
                    </p>
                  ) : (
                    <div className="space-y-1">
                      <p className={INLINE_ROW_CLASS}>
                        <span className={INLINE_LABEL_CLASS}>Delivery:</span>
                        <span className={INLINE_VALUE_CLASS}>Delivery</span>
                      </p>
                      <p className={INLINE_ROW_CLASS}>
                        <span className={INLINE_LABEL_CLASS}>Address:</span>
                        <span className={INLINE_VALUE_CLASS}>{order.address_line1 || "-"}</span>
                      </p>
                      {order.address_line2 && (
                        <p className={INLINE_ROW_CLASS}>
                          <span className={INLINE_LABEL_CLASS}>Address 2:</span>
                          <span className={INLINE_VALUE_CLASS}>{order.address_line2}</span>
                        </p>
                      )}
                      <p className={INLINE_ROW_CLASS}>
                        <span className={INLINE_LABEL_CLASS}>Suburb:</span>
                        <span className={INLINE_VALUE_CLASS}>
                          {order.suburb || "-"}
                          {order.state ? (
                            <>
                              , <span style={{ fontSize: "125%" }}>{order.state}</span>
                            </>
                          ) : null}
                          {order.postcode ? <> , {order.postcode}</> : null}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <p className={INLINE_ROW_CLASS}>
                  <span className={INLINE_LABEL_CLASS}>Date ordered:</span>
                  <span className={INLINE_VALUE_CLASS}>{formatPrintDate(order.created_at)}</span>
                </p>
                <p className={INLINE_ROW_CLASS}>
                  <span className={INLINE_LABEL_CLASS}>Order number:</span>
                  <span className={INLINE_VALUE_CLASS}>{order.order_number || "-"}</span>
                </p>
                <p className={INLINE_ROW_CLASS}>
                  <span className={INLINE_LABEL_CLASS}>Email:</span>
                  <span className={INLINE_VALUE_CLASS}>{order.customer_email || "-"}</span>
                </p>
                <p className={INLINE_ROW_CLASS}>
                  <span className={INLINE_LABEL_CLASS}>First name:</span>
                  <span className={INLINE_VALUE_CLASS}>{order.first_name || "-"}</span>
                </p>
                <p className={INLINE_ROW_CLASS}>
                  <span className={INLINE_LABEL_CLASS}>Last name:</span>
                  <span className={INLINE_VALUE_CLASS}>{order.last_name || "-"}</span>
                </p>
                <p className={INLINE_ROW_CLASS}>
                  <span className={INLINE_LABEL_CLASS}>Phone:</span>
                  <span className={INLINE_VALUE_CLASS}>{order.phone || "-"}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 print:space-y-2">
          <div className={`${CARD_CLASS} print:hidden`}>
            <h2 className={SECTION_HEADING_CLASS}>Downloads</h2>
            <div className="mt-3 space-y-3">
              {labelImageUrl && (
                <div className="flex items-center gap-3">
                  {labelImageIsImage ? (
                    <a
                      href={labelImageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block h-16 w-16 shrink-0 overflow-hidden rounded border border-zinc-200 bg-white"
                    >
                      <Image
                        src={labelImageUrl}
                        alt="Label preview"
                        width={64}
                        height={64}
                        className="h-full w-full object-cover"
                      />
                    </a>
                  ) : null}
                  <div className="space-y-1">
                    <a
                      href={labelImageUrl}
                      download={labelDownloadName}
                      className="inline-flex rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                    >
                      Download label image
                    </a>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
              {order.logo_url && (
                <a
                  href={order.logo_url}
                  download={logoDownloadName}
                  className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                >
                  Download logo
                </a>
              )}
              {!labelImageUrl && !order.logo_url && (
                <p className="text-xs text-zinc-500">No uploaded images for this order.</p>
              )}
              </div>
            </div>
          </div>

          <div className={CARD_CLASS}>
            <h2 className={SECTION_HEADING_CLASS}>Order summary</h2>
            <div className={SECTION_BODY_CLASS}>
              <p className={INLINE_ROW_CLASS}>
                <span className={INLINE_LABEL_CLASS}>Order weight:</span>
                <span className={INLINE_VALUE_CLASS} style={{ fontSize: "32pt", lineHeight: 1.1 }}>
                  {batchWeightGroups.length > 1 || batchWeights.length > 1 ? (
                    <span className="block">
                      {batchWeightGroups.map((group) => (
                        <span key={group.weight} className="block whitespace-nowrap">
                          {group.count} x {formatPrintKg(group.weight)}kg{batchQuantityLabel(group, totalBatchWeightKg, printQuantity)}
                        </span>
                      ))}
                    </span>
                  ) : (
                    `${formatPrintKg(batchWeights[0] ?? Number(order.total_weight_kg))}kg`
                  )}
                </span>
              </p>
              <p className={SPEC_ROW_CLASS}>
                <span className={SPEC_LABEL_CLASS}>Flavour:</span>
                <span className={SPEC_VALUE_CLASS}>{order.flavor || "-"}</span>
              </p>
              {!isBranded && (
                <p className={SPEC_ROW_CLASS}>
                  <span className={SPEC_LABEL_CLASS}>Text colour:</span>
                  <span className={SPEC_VALUE_CLASS}>{renderColorDisplay(textColorDisplay)}</span>
                </p>
              )}
              {isWedding && (
                <p className={SPEC_ROW_CLASS}>
                  <span className={SPEC_LABEL_CLASS}>Heart colour:</span>
                  <span className={SPEC_VALUE_CLASS}>{renderColorDisplay(heartColorDisplay)}</span>
                </p>
              )}
              <div>
                <p className={SPEC_ROW_CLASS}>
                  <span className={SPEC_LABEL_CLASS}>Jacket:</span>
                  <span className={SPEC_VALUE_CLASS}>{jacketLabel}</span>
                </p>
                {order.jacket !== "rainbow" && (
                  <div className="mt-2 space-y-1 text-zinc-700">
                    {showJacketColorOne && (
                      <p className={SPEC_ROW_CLASS}>
                        <span className={SPEC_LABEL_CLASS}>Colour 1:</span>
                        <span className={SPEC_VALUE_CLASS}>{renderColorDisplay(jacketColorOneDisplay)}</span>
                      </p>
                    )}
                    {showJacketColorTwo && (
                      <p className={SPEC_ROW_CLASS}>
                        <span className={SPEC_LABEL_CLASS}>Colour 2:</span>
                        <span className={SPEC_VALUE_CLASS}>{renderColorDisplay(jacketColorTwoDisplay)}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
              <p className={SPEC_ROW_CLASS}>
                <span className={SPEC_LABEL_CLASS}>Packaging type:</span>
                <span className={SPEC_VALUE_CLASS}>{packagingSummary}</span>
              </p>
              <p className={SPEC_ROW_CLASS}>
                <span className={SPEC_LABEL_CLASS}>Custom Labels:</span>
                <span className={SPEC_VALUE_CLASS}>{formatLabelPrintCount(labelsToPrint)}</span>
              </p>
              <p className={SPEC_ROW_CLASS}>
                <span className={SPEC_LABEL_CLASS}>Ingredient labels:</span>
                <span className={SPEC_VALUE_CLASS}>{formatLabelPrintCount(ingredientLabelsToPrint)}</span>
              </p>
              {order.notes ? (
                <div className="rounded border border-zinc-200 bg-zinc-50 p-3 print:p-2">
                  <p className={SPEC_LABEL_CLASS}>Production Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-[15px] font-semibold leading-snug text-zinc-900 print:text-[12px]">
                    {order.notes}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
