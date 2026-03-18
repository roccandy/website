import "server-only";

import sharp from "sharp";

export const OPTIMIZABLE_WEB_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

type OptimizeServerImageOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
};

export function isOptimizableWebImageMimeType(value: string | null | undefined) {
  return !!value && OPTIMIZABLE_WEB_IMAGE_MIME_TYPES.has(value.toLowerCase());
}

export async function optimizeServerImageToWebp(
  file: File,
  options: OptimizeServerImageOptions = {},
) {
  const maxWidth = options.maxWidth ?? 2400;
  const maxHeight = options.maxHeight ?? 2400;
  const quality = options.quality ?? 82;
  const input = Buffer.from(await file.arrayBuffer());
  const pipeline = sharp(input, { failOn: "none" }).rotate().resize({
    width: maxWidth,
    height: maxHeight,
    fit: "inside",
    withoutEnlargement: true,
  });
  const { data, info } = await pipeline.webp({ quality }).toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    contentType: "image/webp" as const,
    extension: "webp" as const,
    width: info.width ?? null,
    height: info.height ?? null,
  };
}
