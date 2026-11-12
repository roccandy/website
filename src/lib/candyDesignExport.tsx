import { createElement } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import sharp from "sharp";
import { CandyDesignSvg } from "@/components/CandyDesignSvg";
import { parseCandyDesign, type CandyDesign } from "@/lib/candyDesign";
import { isDesignAssetUrl } from "@/lib/candyDesign";
import {
  loadDesignAsset,
  persistInlineDesignAssets,
  MAX_STUDIO_ASSET_PIXELS,
} from "@/lib/candyDesignAssets";
import { candyTextOutlines, candyTextGeometry } from "@/lib/candyDesignText";
import { designExportSize } from "@/lib/designImageBounds";

export type DesignExportOptions = {
  view?: "three-dimensional" | "face";
  presentation?: boolean;
  cropImages?: boolean;
  resolution?: "native" | 1 | 2 | 4 | 6;
  /** Exact output width, used for the administrator's email clipboard image. */
  width?: number;
};
export async function candyDesignSvg(
  design: CandyDesign,
  options: DesignExportOptions = {},
) {
  const layers = await Promise.all(
    design.layers.map(async (layer) => {
      if (layer.type !== "image" || !isDesignAssetUrl(layer.image))
        return layer;
      const { bytes, contentType } = await loadDesignAsset(layer.image);
      return {
        ...layer,
        image: `data:${contentType};base64,${bytes.toString("base64")}`,
      };
    }),
  );
  const stream = await renderToReadableStream(
    createElement(CandyDesignSvg, {
      design: { ...design, layers },
      prefix: "export",
      textOutlines: await candyTextOutlines(design),
      view: options.view,
      showBackground: options.presentation,
      cropImages: options.cropImages,
    }),
  );
  const svg = await new Response(stream).text();
  return svg;
}
export async function candyDesignPng(
  design: CandyDesign,
  options: DesignExportOptions = {},
) {
  if (options.resolution === "native") design = await validateDesignImages(design);
  const size = designExportSize(design, options);
  const image = sharp(Buffer.from(await candyDesignSvg(design, options)), {
    density: Math.max(72, Math.min(1200, 72 * size.scale)),
  }).resize(size.width, size.height);
  if (!(options.presentation && design.presentation?.transparent))
    image.flatten({
      background: options.presentation
        ? (design.presentation?.background ?? "#ffffff")
        : "#ffffff",
    });
  return image.png().toBuffer();
}
export async function validateDesignImages(design: CandyDesign) {
  const textGeometry = await candyTextGeometry(design);
  const layers = await Promise.all(design.layers.map(async (layer) => {
    if (layer.type !== "image") return layer;
    const bytes = isDesignAssetUrl(layer.image)
      ? (await loadDesignAsset(layer.image)).bytes
      : Buffer.from(layer.image.split(",")[1], "base64");
    const image = sharp(bytes, { limitInputPixels: MAX_STUDIO_ASSET_PIXELS });
    const metadata = await image.metadata();
    if (!["png", "jpeg", "webp"].includes(metadata.format || ""))
      throw new Error("Upload a valid PNG, JPEG or WebP image.");
    return { ...layer, imageWidth: metadata.width, imageHeight: metadata.height };
  }));
  return parseCandyDesign({ ...design, layers, textGeometry })!;
}

/** Store each raster once; large base64 uploads must not travel in every order/list response. */
export async function persistDesignAssets(
  design: CandyDesign,
): Promise<CandyDesign> {
  const validated = await validateDesignImages(design);
  return persistInlineDesignAssets(validated);
}
