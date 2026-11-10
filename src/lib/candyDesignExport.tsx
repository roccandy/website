import { createElement } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import sharp from "sharp";
import { CandyDesignSvg } from "@/components/CandyDesignSvg";
import { parseCandyDesign, type CandyDesign } from "@/lib/candyDesign";
import { isDesignAssetUrl, designAssetKey } from "@/lib/candyDesign";
import { createHash } from "node:crypto";
import { candyTextOutlines } from "@/lib/candyDesignText";

export type DesignExportOptions = {
  view?: "three-dimensional" | "face";
  presentation?: boolean;
};
export async function candyDesignSvg(
  design: CandyDesign,
  options: DesignExportOptions = {},
) {
  const layers = await Promise.all(
    design.layers.map(async (layer) => {
      if (layer.type !== "image" || !isDesignAssetUrl(layer.image))
        return layer;
      const { supabaseAdminClient } = await import("@/lib/supabase/admin");
      const { data, error } = await supabaseAdminClient.storage
        .from("candy-design-assets")
        .download(designAssetKey(layer.image)!);
      if (error || !data)
        throw new Error(
          "Saved artwork could not be loaded. Please retry the export.",
        );
      const bytes = Buffer.from(await data.arrayBuffer());
      if (bytes.length > 5_000_000)
        throw new Error("Saved artwork exceeds the design size limit.");
      return {
        ...layer,
        image: `data:image/png;base64,${bytes.toString("base64")}`,
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
    }),
  );
  const svg = await new Response(stream).text();
  return svg;
}
export async function candyDesignPng(
  design: CandyDesign,
  options: DesignExportOptions = {},
) {
  const image = sharp(
    Buffer.from(await candyDesignSvg(design, options)),
  ).resize(options.view === "face" ? 1040 : 1418, 1040);
  if (!(options.presentation && design.presentation?.transparent))
    image.flatten({
      background: options.presentation
        ? (design.presentation?.background ?? "#ffffff")
        : "#ffffff",
    });
  return image.png().toBuffer();
}
export async function validateDesignImages(design: CandyDesign) {
  await candyTextOutlines(design);
  for (const layer of design.layers) {
    if (layer.type !== "image") continue;
    if (isDesignAssetUrl(layer.image)) continue;
    const bytes = Buffer.from(layer.image.split(",")[1], "base64");
    const image = sharp(bytes, { limitInputPixels: 16_000_000 });
    const metadata = await image.metadata();
    if (!["png", "jpeg", "webp"].includes(metadata.format || ""))
      throw new Error("Upload a valid PNG, JPEG or WebP image.");
  }
  return parseCandyDesign(design)!;
}

/** Store each raster once; large base64 uploads must not travel in every order/list response. */
export async function persistDesignAssets(
  design: CandyDesign,
): Promise<CandyDesign> {
  const { supabaseAdminClient } = await import("@/lib/supabase/admin");
  const validated = await validateDesignImages(design);
  const layers = await Promise.all(
    validated.layers.map(async (layer) => {
      if (layer.type !== "image" || isDesignAssetUrl(layer.image)) return layer;
      const bytes = await sharp(
        Buffer.from(layer.image.split(",")[1], "base64"),
        { limitInputPixels: 16_000_000 },
      )
        .rotate()
        .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
      const key = `${createHash("sha256").update(bytes).digest("hex")}.png`;
      const { error } = await supabaseAdminClient.storage
        .from("candy-design-assets")
        .upload(key, bytes, {
          contentType: "image/png",
          upsert: false,
          cacheControl: "31536000",
        });
      if (
        error &&
        !("statusCode" in error && String(error.statusCode) === "409") &&
        !/already exists|duplicate/i.test(error.message)
      )
        throw new Error(
          "Unable to save design artwork. Your changes are still open; please try again.",
        );
      return { ...layer, image: `candy-asset:${key}` };
    }),
  );
  return { ...validated, layers };
}
