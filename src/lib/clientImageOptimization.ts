"use client";

const OPTIMIZABLE_RASTER_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function replaceExtension(name: string, extension: string) {
  const base = name.replace(/\.[^.]+$/, "") || "image";
  return `${base}.${extension}`;
}

function formatMimeType(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "JPEG";
  if (normalized === "image/png") return "PNG";
  if (normalized === "image/webp") return "WEBP";
  if (normalized === "application/pdf") return "PDF";
  return value.toUpperCase();
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result);
    };
    reader.onerror = () => reject(new Error("Unable to read the file."));
    reader.readAsDataURL(file);
  });
}

function loadImageFromObjectUrl(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to decode the image."));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to export the image."));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

export async function optimizeBrowserImageFile(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {},
) {
  const mimeType = (file.type || "").toLowerCase();
  if (!OPTIMIZABLE_RASTER_IMAGE_MIME_TYPES.has(mimeType)) {
    return file;
  }

  const maxWidth = options.maxWidth ?? 1800;
  const maxHeight = options.maxHeight ?? 1800;
  const quality = options.quality ?? 0.82;
  const image = await loadImageFromObjectUrl(file);
  const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
  const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
  const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to prepare the image.");
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  const blob = await canvasToBlob(canvas, "image/webp", quality);
  return new File([blob], replaceExtension(file.name, "webp"), {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

export type ImageOptimizationSummary = {
  originalType: string;
  originalBytes: number;
  finalType: string;
  finalBytes: number;
};

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

export async function analyzeImageOptimization(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {},
): Promise<ImageOptimizationSummary> {
  const optimizedFile = await optimizeBrowserImageFile(file, options);
  return {
    originalType: formatMimeType(file.type || "unknown"),
    originalBytes: file.size,
    finalType: formatMimeType(optimizedFile.type || "image/webp"),
    finalBytes: optimizedFile.size,
  };
}

export async function optimizeBrowserImageToDataUrl(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {},
) {
  const optimized = await optimizeBrowserImageFile(file, options);
  return readFileAsDataUrl(optimized);
}

export async function fileToDataUrl(file: File) {
  return readFileAsDataUrl(file);
}
