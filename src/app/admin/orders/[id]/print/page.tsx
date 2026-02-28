import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { supabaseServerClient } from "@/lib/supabase/server";
import { CandyPreview } from "@/app/quote/CandyPreview";
import { paletteSections } from "@/app/admin/settings/palette";
import { PrintButton } from "./PrintButton";

type Params = {
  params?: { id?: string } | Promise<{ id?: string }>;
  searchParams?: { id?: string } | Promise<{ id?: string }>;
};

const formatDate = (iso: string | null) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
};

const formatDay = (iso: string | null) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { weekday: "long" });
  } catch {
    return "";
  }
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
    .replace(/[\u2665\u2764]/g, "\u2665")
    .replace(/\s*\u2665\s*/g, " \u2665 ");

const isImageUrl = (value: string) => {
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
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 120);

const getFileExtensionFromUrl = (value: string) => {
  try {
    const url = new URL(value);
    const ext = url.pathname.split(".").pop()?.toLowerCase() ?? "";
    return ext || "png";
  } catch {
    const ext = value.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
    return ext || "png";
  }
};

const CARD_CLASS = "rounded-2xl border border-zinc-200 p-4 print:p-2";
const SECTION_HEADING_CLASS = "text-[11px] uppercase tracking-[0.22em] text-zinc-500";
const SECTION_BODY_CLASS = "mt-3 space-y-2 print:mt-1 print:space-y-1";
const INLINE_ROW_CLASS = "flex flex-wrap items-baseline gap-x-2 gap-y-1";
const INLINE_LABEL_CLASS = "text-[10px] uppercase tracking-[0.18em] text-zinc-500";
const INLINE_VALUE_CLASS = "font-semibold text-zinc-900";

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



export default async function PrintOrderPage({ params, searchParams }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");

  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const rawId = resolvedParams?.id || resolvedSearchParams?.id || "";

  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  const client = supabaseServerClient;
  const orderQuery = client.from("orders").select("*");
  let order: any = null;
  let error: { message: string } | null = null;
  if (rawId && rawId !== "undefined") {
    if (isUuid(rawId)) {
      const result = await orderQuery.eq("id", rawId).maybeSingle();
      order = result.data;
      error = result.error ? { message: result.error.message } : null;
    } else {
      const result = await orderQuery
        .eq("order_number", rawId)
        .order("created_at", { ascending: false })
        .limit(1);
      order = result.data?.[0] ?? null;
      error = result.error ? { message: result.error.message } : null;
    }
  }
  if (error || !order) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 bg-white px-6 py-10 text-zinc-900">
        <h1 className="text-2xl font-semibold">Order printout</h1>
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
        <a
          href="/admin/orders"
          className="inline-flex items-center rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
        >
          Back to production schedule
        </a>
      </div>
    );
  }

  const { data: packagingOptions } = await client.from("packaging_options").select("*");
  const packaging = packagingOptions?.find((opt) => opt.id === order.packaging_option_id) ?? null;
  const { data: paletteRows } = await client.from("color_palette").select("category,shade,hex");
  const paletteHexMap = buildPaletteHexMap(paletteRows ?? []);

  const { data: orderSlots } = await client.from("order_slots").select("slot_id").eq("order_id", order.id);
  const slotIds = (orderSlots ?? []).map((slot) => slot.slot_id);
  const { data: slots } =
    slotIds.length > 0
      ? await client.from("production_slots").select("slot_date,slot_index").in("id", slotIds)
      : { data: [] };
  const productionDate = (slots ?? [])
    .map((slot) => slot.slot_date)
    .sort((a, b) => (a > b ? 1 : -1))[0];

  const labelsYesNo = order.labels_count && Number(order.labels_count) > 0 ? "Yes" : "No";
  const textColorHex = order.text_color || "#b7b7b7";
  const heartColorHex = order.heart_color || textColorHex;
  const textColorDisplay = resolveColorDisplay(textColorHex, paletteHexMap);
  const heartColorDisplay = resolveColorDisplay(heartColorHex, paletteHexMap);
  const jacketColorOneDisplay = resolveColorDisplay(order.jacket_color_one, paletteHexMap);
  const jacketColorTwoDisplay = resolveColorDisplay(order.jacket_color_two, paletteHexMap);
  const labelImageUrl = order.label_image_url || "";
  const labelImageIsImage = labelImageUrl ? isImageUrl(labelImageUrl) : false;
  const labelDownloadName = (() => {
    const orderNumberPart = sanitizeFilenamePart(order.order_number ? String(order.order_number) : "Unknown");
    const titlePart = sanitizeFilenamePart(order.title ? String(order.title) : "Untitled");
    const ext = getFileExtensionFromUrl(labelImageUrl);
    return `Order#${orderNumberPart} Custom Label ${titlePart}.${ext}`;
  })();

  const designText = order.design_text ? normalizeHeart(order.design_text) : "";
  const hasHeart = designText.includes("\u2665");
  const [lineOne, lineTwo] = hasHeart ? designText.split("\u2665").map((part) => part.trim()) : ["", ""];
  const isWeddingInitials = order.category_id === "weddings-initials";
  const isWedding = order.category_id?.startsWith("weddings");
  const isCustomText = order.category_id?.startsWith("custom-");
  const isBranded = order.category_id === "branded";

  const jacketLabel = (() => {
    if (order.jacket === "rainbow") return "Rainbow";
    if (order.jacket === "two_colour_pinstripe") return "2 Colour + Pinstripe";
    if (order.jacket === "two_colour") return "2 Colour";
    if (order.jacket === "pinstripe") return "Single Colour + Pinstripe";
    return "Single Colour";
  })();

  const showJacketColorOne =
    order.jacket === "two_colour" || order.jacket === "two_colour_pinstripe" || order.jacket === "pinstripe" || !order.jacket;
  const showJacketColorTwo = order.jacket === "two_colour" || order.jacket === "two_colour_pinstripe";

  return (
    <div className="mx-auto max-w-4xl space-y-6 bg-white px-6 py-8 text-[13px] leading-[1.45] text-zinc-900 print:mx-0 print:max-w-none print:space-y-2 print:px-0 print:py-0 print:text-[10.5px] print:leading-[1.3]">
      <style>{`
        @media print {
          @page { size: A4; margin: 6mm; }
          .print-grid-two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        }
      `}</style>
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-semibold">Order printout</h1>
        <PrintButton className="rounded border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300" />
      </div>

      <div className="print-grid-two grid gap-6 md:grid-cols-2 print:gap-2">
        <div className="space-y-6 print:space-y-2">
          <div className={CARD_CLASS}>
            <h2 className={SECTION_HEADING_CLASS}>Candy design</h2>
            <div className="mt-4 flex items-center justify-center print:mt-1 print:scale-[0.85]">
              <CandyPreview
                designText={!isBranded && !isWedding ? designText : undefined}
                lineOne={isWedding ? lineOne : undefined}
                lineTwo={isWedding ? lineTwo : undefined}
                showHeart={isWedding}
                mode={(order.jacket_type as "" | "rainbow" | "pinstripe" | "two_colour") || ""}
                showPinstripe={order.jacket === "pinstripe" || order.jacket === "two_colour_pinstripe"}
                colorOne={order.jacket_color_one || "#000000"}
                colorTwo={order.jacket_color_two || "#000000"}
                logoUrl={isBranded ? order.logo_url : undefined}
                textColor={textColorHex}
                heartColor={heartColorHex}
                isInitials={isWeddingInitials}
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
                    {formatDate(order.due_date) || "-"}
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
                          {[order.suburb, order.state, order.postcode].filter(Boolean).join(", ") || "-"}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <p className={INLINE_ROW_CLASS}>
                  <span className={INLINE_LABEL_CLASS}>Date ordered:</span>
                  <span className={INLINE_VALUE_CLASS}>{formatDate(order.created_at)}</span>
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
                      className="block h-16 w-16 overflow-hidden rounded border border-zinc-200 bg-white"
                    >
                      <img
                        src={labelImageUrl}
                        alt="Label preview"
                        className="h-full w-full object-cover"
                      />
                    </a>
                  ) : null}
                  <a
                    href={labelImageUrl}
                    download={labelDownloadName}
                    className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                  >
                    Download label image
                  </a>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
              {order.logo_url && (
                <a
                  href={order.logo_url}
                  download
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
                  {order.total_weight_kg} kg
                </span>
              </p>
              <p className={INLINE_ROW_CLASS}>
                <span className={INLINE_LABEL_CLASS}>Flavour:</span>
                <span className={INLINE_VALUE_CLASS}>{order.flavor || "-"}</span>
              </p>
              {!isBranded && (
                <p className={INLINE_ROW_CLASS}>
                  <span className={INLINE_LABEL_CLASS}>Text colour:</span>
                  {renderColorDisplay(textColorDisplay)}
                </p>
              )}
              {isWedding && (
                <p className={INLINE_ROW_CLASS}>
                  <span className={INLINE_LABEL_CLASS}>Heart colour:</span>
                  {renderColorDisplay(heartColorDisplay)}
                </p>
              )}
              <div>
                <p className={INLINE_ROW_CLASS}>
                  <span className={INLINE_LABEL_CLASS}>Jacket:</span>
                  <span className={INLINE_VALUE_CLASS}>{jacketLabel}</span>
                </p>
                {order.jacket !== "rainbow" && (
                  <div className="mt-2 space-y-1 text-zinc-700">
                    {showJacketColorOne && (
                      <p className={INLINE_ROW_CLASS}>
                        <span className={INLINE_LABEL_CLASS}>Colour 1:</span>
                        {renderColorDisplay(jacketColorOneDisplay)}
                      </p>
                    )}
                    {showJacketColorTwo && (
                      <p className={INLINE_ROW_CLASS}>
                        <span className={INLINE_LABEL_CLASS}>Colour 2:</span>
                        {renderColorDisplay(jacketColorTwoDisplay)}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <p className={INLINE_ROW_CLASS}>
                <span className={INLINE_LABEL_CLASS}>Packaging type:</span>
                <span className={INLINE_VALUE_CLASS}>{packaging ? packaging.type : "N/A"}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


