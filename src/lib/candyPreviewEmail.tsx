import { createElement } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import sharp from "sharp";
import { CandyPreview } from "@/app/quote/CandyPreview";

type LegacyCandyPreviewOrder = Record<string, unknown>;

const value = (input: unknown, fallback = "") =>
  typeof input === "string" && input.trim() ? input.trim() : fallback;

function weddingNames(value: string) {
  const parts = value.split(/\s*(?:♥|❤️|❤|\+)\s*/u).map((part) => part.trim());
  return { lineOne: parts[0] ?? "", lineTwo: parts[1] ?? "" };
}

function mergeCandyPreviewSvg(markup: string) {
  const svgs = markup.match(/<svg\b[^>]*>[\s\S]*?<\/svg>/g) ?? [];
  const [base, ...overlays] = svgs;
  if (!base) throw new Error("Candy preview did not render an SVG.");

  return overlays.reduce((combined, overlay) => {
    const content = overlay.replace(/^<svg\b[^>]*>/, "").replace(/<\/svg>$/, "");
    return combined.replace(/<\/svg>$/, `${content}</svg>`);
  }, base);
}

/**
 * Renders the same faceted legacy CandyPreview used by the site into a
 * mail-safe PNG. Studio artwork has its own exact snapshot renderer.
 */
export async function legacyCandyPreviewPng(order: LegacyCandyPreviewOrder) {
  const categoryId = value(order.category_id).toLowerCase();
  const designType = value(order.design_type).toLowerCase();
  if (categoryId === "branded" || designType === "branded") return null;

  const jacket = `${value(order.jacket_type)} ${value(order.jacket)}`.toLowerCase();
  const mode = jacket.includes("rainbow")
    ? "rainbow"
    : jacket.includes("two_colour")
      ? "two_colour"
      : jacket.includes("pinstripe")
        ? "pinstripe"
        : "";
  const sourceText = value(order.design_text, value(order.title));
  const isWedding = categoryId.startsWith("weddings") || designType.startsWith("weddings");
  const { lineOne, lineTwo } = isWedding ? weddingNames(sourceText) : { lineOne: "", lineTwo: "" };
  const isInitials = categoryId === "weddings-initials" || designType === "weddings-initials";
  const customTextVariant = categoryId === "custom-1-6" ? "short" : categoryId === "custom-7-14" ? "long" : undefined;

  const stream = await renderToReadableStream(
    createElement(CandyPreview, {
      mode,
      showPinstripe: jacket.includes("pinstripe"),
      colorOne: value(order.jacket_color_one, "#b7b7b7"),
      colorTwo: value(order.jacket_color_two, value(order.jacket_color_one, "#b7b7b7")),
      fillColor: value(order.candy_fill_color, "#ffffff"),
      pinstripeColor: value(order.pinstripe_color, "#ffffff"),
      textColor: value(order.text_color, "#b7b7b7"),
      heartColor: value(order.heart_color, value(order.text_color, "#b7b7b7")),
      designText: isWedding ? undefined : sourceText,
      lineOne,
      lineTwo,
      showHeart: isWedding,
      isInitials,
      customTextVariant,
      dimensions: { width: 709, height: 520 },
    }),
  );
  const markup = await new Response(stream).text();

  return sharp(Buffer.from(mergeCandyPreviewSvg(markup)))
    .resize(1418, 1040)
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
}
