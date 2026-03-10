import { supabaseServerClient } from "@/lib/supabase/server";

const SEO_IMAGE_BUCKET = "seo-images";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

function normalizeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferExtension(name: string) {
  const lowered = name.toLowerCase();
  const match = ALLOWED_EXTENSIONS.find((extension) => lowered.endsWith(extension));
  return match ?? "";
}

function isMissingBucketError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("bucket") && (normalized.includes("not found") || normalized.includes("does not exist"));
}

async function ensureSeoImageBucket() {
  const { error } = await supabaseServerClient.storage.createBucket(SEO_IMAGE_BUCKET, {
    public: true,
    fileSizeLimit: `${MAX_UPLOAD_BYTES}`,
    allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
  });

  if (!error) return;

  const normalized = error.message.toLowerCase();
  if (normalized.includes("already exists") || normalized.includes("duplicate")) {
    return;
  }

  throw new Error(error.message);
}

export async function uploadSeoImage(file: File, slugPath: string) {
  if (!file || file.size === 0) {
    return null;
  }

  const extension = inferExtension(file.name);
  if (!extension) {
    throw new Error("Only JPG, PNG, and WEBP images are supported.");
  }

  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Only JPG, PNG, and WEBP images are supported.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("SEO images must be 5MB or smaller.");
  }

  const baseName = normalizeFileName(file.name.replace(/\.[^.]+$/, "")) || "seo-image";
  const folder = normalizeFileName(slugPath.replace(/\//g, "-")) || "page";
  const objectPath = `${folder}/${Date.now()}-${baseName}${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const upload = async () =>
    supabaseServerClient.storage.from(SEO_IMAGE_BUCKET).upload(objectPath, bytes, {
      contentType: file.type || "image/jpeg",
      upsert: true,
    });

  let result = await upload();
  if (result.error && isMissingBucketError(result.error.message)) {
    await ensureSeoImageBucket();
    result = await upload();
  }

  if (result.error) {
    throw new Error(result.error.message);
  }

  const { data } = supabaseServerClient.storage.from(SEO_IMAGE_BUCKET).getPublicUrl(objectPath);
  if (!data.publicUrl) {
    throw new Error("Unable to generate a public URL for the SEO image.");
  }

  return {
    path: objectPath,
    publicUrl: data.publicUrl,
  };
}

export async function listSeoLibraryImages() {
  await ensureSeoImageBucket();
  const { data, error } = await supabaseServerClient.storage.from(SEO_IMAGE_BUCKET).list("library", {
    limit: 100,
    sortBy: { column: "name", order: "desc" },
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .filter((item) => item.name && item.id)
    .map((item) => {
      const path = `library/${item.name}`;
      const { data: publicData } = supabaseServerClient.storage.from(SEO_IMAGE_BUCKET).getPublicUrl(path);
      return {
        name: item.name,
        path,
        publicUrl: publicData.publicUrl,
        updatedAt: item.updated_at ?? null,
      };
    });
}
