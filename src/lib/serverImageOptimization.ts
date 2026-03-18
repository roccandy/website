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

type OptimizedServerImage = {
  buffer: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
  width: number | null;
  height: number | null;
};

export function isOptimizableWebImageMimeType(value: string | null | undefined) {
  return !!value && OPTIMIZABLE_WEB_IMAGE_MIME_TYPES.has(value.toLowerCase());
}

function normalizeImageMimeType(value: string | null | undefined) {
  const normalized = (value ?? "").toLowerCase();
  if (normalized === "image/jpg") return "image/jpeg" as const;
  if (normalized === "image/jpeg" || normalized === "image/png" || normalized === "image/webp") {
    return normalized;
  }
  return null;
}

function extensionForMimeType(mimeType: OptimizedServerImage["contentType"]) {
  if (mimeType === "image/jpeg") return "jpg" as const;
  if (mimeType === "image/png") return "png" as const;
  return "webp" as const;
}

function resolveOrientedDimensions(metadata: sharp.Metadata) {
  const width = metadata.width ?? null;
  const height = metadata.height ?? null;
  if (!width || !height) {
    return { width, height };
  }

  const orientation = metadata.orientation ?? 1;
  if (orientation >= 5 && orientation <= 8) {
    return { width: height, height: width };
  }

  return { width, height };
}

async function encodePipeline(
  pipeline: sharp.Sharp,
  mimeType: OptimizedServerImage["contentType"],
  quality: number
): Promise<OptimizedServerImage> {
  const formatter =
    mimeType === "image/webp"
      ? pipeline.webp({ quality })
      : mimeType === "image/png"
        ? pipeline.png({ compressionLevel: 9, palette: true, quality: 90 })
        : pipeline.jpeg({ quality, mozjpeg: true, progressive: true });
  const { data, info } = await formatter.toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    contentType: mimeType,
    extension: extensionForMimeType(mimeType),
    width: info.width ?? null,
    height: info.height ?? null,
  };
}

export async function optimizeServerImageForWeb(file: File, options: OptimizeServerImageOptions = {}) {
  const maxWidth = options.maxWidth ?? 2400;
  const maxHeight = options.maxHeight ?? 2400;
  const quality = options.quality ?? 82;
  const normalizedMimeType = normalizeImageMimeType(file.type);
  const input = Buffer.from(await file.arrayBuffer());
  const metadata = await sharp(input, { failOn: "none" }).metadata();
  const oriented = resolveOrientedDimensions(metadata);
  const pipeline = sharp(input, { failOn: "none" }).rotate().resize({
    width: maxWidth,
    height: maxHeight,
    fit: "inside",
    withoutEnlargement: true,
  });

  const candidateMimeTypes: Array<OptimizedServerImage["contentType"]> =
    normalizedMimeType === "image/jpeg" ? ["image/webp", "image/jpeg"] : ["image/webp", "image/png"];

  const candidates = await Promise.all(
    candidateMimeTypes.map((mimeType) => encodePipeline(pipeline.clone(), mimeType, quality))
  );

  let best = candidates.reduce((smallest, candidate) =>
    candidate.buffer.byteLength < smallest.buffer.byteLength ? candidate : smallest
  );

  const canKeepOriginal =
    normalizedMimeType !== null &&
    oriented.width !== null &&
    oriented.height !== null &&
    oriented.width <= maxWidth &&
    oriented.height <= maxHeight;

  if (canKeepOriginal && input.byteLength <= best.buffer.byteLength && normalizedMimeType) {
    best = {
      buffer: input,
      contentType: normalizedMimeType,
      extension: extensionForMimeType(normalizedMimeType),
      width: oriented.width,
      height: oriented.height,
    };
  }

  return best;
}
