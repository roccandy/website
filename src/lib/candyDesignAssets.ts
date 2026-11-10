import sharp from "sharp";
import { createHash } from "node:crypto";
import { designAssetKey, type CandyDesign } from "@/lib/candyDesign";

export const MAX_STUDIO_ASSET_BYTES = 20_000_000;
export const MAX_STUDIO_ASSET_PIXELS = 36_000_000;
export const designAssetContentType = (key: string) =>
  key.endsWith(".webp")
    ? "image/webp"
    : /\.jpe?g$/.test(key)
      ? "image/jpeg"
      : "image/png";
export async function loadDesignAsset(reference: string) {
  const key = designAssetKey(reference);
  if (!key) throw new Error("Invalid artwork reference.");
  const { supabaseAdminClient } = await import("@/lib/supabase/admin");
  const { data, error } = await supabaseAdminClient.storage
    .from("candy-design-assets")
    .download(key);
  if (error || !data)
    throw new Error(
      "Saved artwork could not be loaded. Retry before saving the order.",
    );
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.length > MAX_STUDIO_ASSET_BYTES)
    throw new Error("Saved artwork exceeds the 20MB image limit.");
  return { bytes, contentType: designAssetContentType(key) };
}
export async function storeDesignImage(input: Buffer) {
  if (!input.length || input.length > MAX_STUDIO_ASSET_BYTES)
    throw new Error("Choose artwork up to 20MB.");
  const image = sharp(input, {
    limitInputPixels: MAX_STUDIO_ASSET_PIXELS,
    animated: false,
  });
  const metadata = await image.metadata();
  if (!["png", "jpeg", "webp"].includes(metadata.format || ""))
    throw new Error("Upload a valid PNG, JPEG or WebP image.");
  if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1)
    throw new Error("Use a still image for candy artwork.");
  // Keep full native pixels and the original encoded bytes whenever orientation/size permits.
  const normalise =
    (metadata.orientation ?? 1) !== 1 ||
    Math.max(metadata.width, metadata.height) > 6000;
  const bytes = normalise
    ? await image
        .rotate()
        .resize(6000, 6000, { fit: "inside", withoutEnlargement: true })
        .toFormat(metadata.format as "png" | "jpeg" | "webp")
        .toBuffer()
    : input;
  if (bytes.length > MAX_STUDIO_ASSET_BYTES)
    throw new Error("Artwork exceeds the 20MB image limit after processing.");
  const extension = metadata.format === "jpeg" ? "jpg" : metadata.format!;
  const key = `${createHash("sha256").update(bytes).digest("hex")}.${extension}`;
  const { supabaseAdminClient } = await import("@/lib/supabase/admin");
  const { error } = await supabaseAdminClient.storage
    .from("candy-design-assets")
    .upload(key, bytes, {
      contentType: designAssetContentType(key),
      upsert: false,
      cacheControl: "31536000",
    });
  if (
    error &&
    !("statusCode" in error && String(error.statusCode) === "409") &&
    !/already exists|duplicate/i.test(error.message)
  )
    throw new Error(
      "Unable to save artwork. Your changes are still open; please try again.",
    );
  const dimensions = normalise ? await sharp(bytes).metadata() : metadata;
  return {
    image: `candy-asset:${key}`,
    imageWidth: dimensions.width!,
    imageHeight: dimensions.height!,
  };
}
export async function persistInlineDesignAssets(
  design: CandyDesign,
): Promise<CandyDesign> {
  const layers = await Promise.all(
    design.layers.map(async (layer) =>
      layer.type !== "image" || designAssetKey(layer.image)
        ? layer
        : {
            ...layer,
            ...(await storeDesignImage(
              Buffer.from(layer.image.split(",")[1], "base64"),
            )),
          },
    ),
  );
  return { ...design, layers };
}
