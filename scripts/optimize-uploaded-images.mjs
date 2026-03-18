import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const SEO_IMAGE_BUCKET = "seo-images";
const PREMADE_IMAGE_BUCKET = "premade-images";
const PACKAGING_IMAGE_BUCKET = "packaging-images";
const PROCESSABLE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, "utf8");
  contents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const index = trimmed.indexOf("=");
    if (index === -1) return;
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

function buildPublicUrl(baseUrl, bucket, objectPath) {
  return `${baseUrl}/storage/v1/object/public/${bucket}/${encodeURIComponent(objectPath)}`;
}

function replaceAll(value, replacements) {
  let next = value;
  for (const [from, to] of replacements) {
    next = next.split(from).join(to);
  }
  return next;
}

function decodeDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1].toLowerCase(),
    buffer: Buffer.from(match[2], "base64"),
  };
}

function normalizeMimeType(value) {
  const normalized = (value ?? "").toLowerCase();
  if (normalized === "image/jpg") return "image/jpeg";
  if (normalized === "image/jpeg" || normalized === "image/png" || normalized === "image/webp") {
    return normalized;
  }
  return null;
}

function extensionForMimeType(mimeType) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  return "webp";
}

function resolveOrientedDimensions(metadata) {
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

async function encodeCandidate(pipeline, mimeType, quality) {
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

async function optimizeBufferForWeb(buffer, mimeType, { maxWidth = 2400, maxHeight = 2400, quality = 82 } = {}) {
  const normalizedMimeType = normalizeMimeType(mimeType);
  const metadata = await sharp(buffer, { failOn: "none" }).metadata();
  const oriented = resolveOrientedDimensions(metadata);
  const pipeline = sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({
      width: maxWidth,
      height: maxHeight,
      fit: "inside",
      withoutEnlargement: true,
    });

  const candidateMimeTypes =
    normalizedMimeType === "image/jpeg" ? ["image/webp", "image/jpeg"] : ["image/webp", "image/png"];
  const candidates = await Promise.all(
    candidateMimeTypes.map((candidateMimeType) => encodeCandidate(pipeline.clone(), candidateMimeType, quality))
  );
  let best = candidates.reduce((smallest, candidate) =>
    candidate.buffer.byteLength < smallest.buffer.byteLength ? candidate : smallest
  );

  const canKeepOriginal =
    normalizedMimeType &&
    oriented.width !== null &&
    oriented.height !== null &&
    oriented.width <= maxWidth &&
    oriented.height <= maxHeight;

  if (canKeepOriginal && buffer.byteLength <= best.buffer.byteLength) {
    best = {
      buffer,
      contentType: normalizedMimeType,
      extension: extensionForMimeType(normalizedMimeType),
      width: oriented.width,
      height: oriented.height,
    };
  }

  return best;
}

async function listAllObjects(client, bucket, prefix = "") {
  const { data, error } = await client.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw error;

  const files = [];
  for (const item of data ?? []) {
    const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) {
      files.push(itemPath);
      continue;
    }
    files.push(...(await listAllObjects(client, bucket, itemPath)));
  }
  return files;
}

async function optimizeStorageBucket(client, baseUrl, bucket, options, apply, deleteOriginals) {
  const objectPaths = await listAllObjects(client, bucket);
  const pathReplacements = new Map();
  const urlReplacements = new Map();
  let processed = 0;

  for (const objectPath of objectPaths) {
    const extension = path.posix.extname(objectPath).toLowerCase();
    if (!PROCESSABLE_EXTENSIONS.has(extension)) {
      continue;
    }

    const { data, error } = await client.storage.from(bucket).download(objectPath);
    if (error || !data) {
      throw new Error(error?.message ?? `Unable to download ${bucket}/${objectPath}`);
    }

    const fileBuffer = Buffer.from(await data.arrayBuffer());
    const fallbackMimeType = extension === ".jpg" ? "image/jpeg" : `image/${extension.replace(".", "")}`;
    const optimized = await optimizeBufferForWeb(fileBuffer, normalizeMimeType(data.type) ?? fallbackMimeType, options);
    const nextPath = objectPath.replace(/\.[^.]+$/i, `.${optimized.extension}`);
    const currentPublicUrl = buildPublicUrl(baseUrl, bucket, objectPath);
    const nextPublicUrl = buildPublicUrl(baseUrl, bucket, nextPath);

    pathReplacements.set(objectPath, nextPath);
    urlReplacements.set(currentPublicUrl, nextPublicUrl);
    processed += 1;

    if (!apply) continue;

    const { error: uploadError } = await client.storage
      .from(bucket)
      .upload(nextPath, optimized.buffer, { contentType: optimized.contentType, upsert: true });
    if (uploadError) {
      throw new Error(uploadError.message);
    }

    if (deleteOriginals && nextPath !== objectPath) {
      const { error: removeError } = await client.storage.from(bucket).remove([objectPath]);
      if (removeError) {
        throw new Error(removeError.message);
      }
    }
  }

  return { processed, pathReplacements, urlReplacements };
}

async function updateSitePages(client, replacements, apply) {
  const { data: pages, error } = await client
    .from("site_pages")
    .select("slug,og_image_url,gallery_image_urls,body_html");
  if (error) throw error;

  let updated = 0;
  for (const page of pages ?? []) {
    const nextOgImageUrl =
      typeof page.og_image_url === "string" ? replaceAll(page.og_image_url, replacements) : page.og_image_url;
    const nextGalleryImageUrls = Array.isArray(page.gallery_image_urls)
      ? page.gallery_image_urls.map((value) => replaceAll(value, replacements))
      : page.gallery_image_urls;
    const nextBodyHtml =
      typeof page.body_html === "string" ? replaceAll(page.body_html, replacements) : page.body_html;
    const changed =
      nextOgImageUrl !== page.og_image_url ||
      JSON.stringify(nextGalleryImageUrls ?? []) !== JSON.stringify(page.gallery_image_urls ?? []) ||
      nextBodyHtml !== page.body_html;

    if (!changed) continue;
    updated += 1;
    if (!apply) continue;

    const { error: updateError } = await client
      .from("site_pages")
      .update({
        og_image_url: nextOgImageUrl,
        gallery_image_urls: nextGalleryImageUrls,
        body_html: nextBodyHtml,
      })
      .eq("slug", page.slug);
    if (updateError) throw updateError;
  }

  return updated;
}

async function updatePathColumn(client, table, column, replacements, apply) {
  const { data, error } = await client.from(table).select(`id,${column}`);
  if (error) throw error;

  let updated = 0;
  for (const row of data ?? []) {
    const currentValue = row[column];
    if (typeof currentValue !== "string" || !replacements.has(currentValue)) continue;
    updated += 1;
    if (!apply) continue;

    const { error: updateError } = await client
      .from(table)
      .update({ [column]: replacements.get(currentValue) })
      .eq("id", row.id);
    if (updateError) throw updateError;
  }

  return updated;
}

async function listOrders(client) {
  const fullResult = await client.from("orders").select("id,label_image_url,logo_url");
  if (!fullResult.error) {
    return fullResult.data ?? [];
  }
  if (!fullResult.error.message.toLowerCase().includes("logo_url")) {
    throw fullResult.error;
  }

  const fallbackResult = await client.from("orders").select("id,label_image_url");
  if (fallbackResult.error) throw fallbackResult.error;
  return (fallbackResult.data ?? []).map((row) => ({ ...row, logo_url: null }));
}

async function optimizeOrderInlineImages(client, apply) {
  const orders = await listOrders(client);
  let updated = 0;

  for (const order of orders) {
    const next = {};

    for (const key of ["label_image_url", "logo_url"]) {
      const currentValue = order[key];
      if (typeof currentValue !== "string" || !currentValue.startsWith("data:image/")) continue;
      const decoded = decodeDataUrl(currentValue);
      if (!decoded || decoded.mimeType === "image/svg+xml") continue;
      const optimized = await optimizeBufferForWeb(decoded.buffer, decoded.mimeType, {
        maxWidth: 1800,
        maxHeight: 1800,
        quality: 82,
      });
      next[key] = `data:${optimized.contentType};base64,${optimized.buffer.toString("base64")}`;
    }

    if (Object.keys(next).length === 0) continue;
    updated += 1;
    if (!apply) continue;

    const { error } = await client.from("orders").update(next).eq("id", order.id);
    if (error) throw error;
  }

  return updated;
}

async function main() {
  const cwd = process.cwd();
  loadEnvFile(path.join(cwd, ".env.local"));
  loadEnvFile(path.join(cwd, ".env"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const apply = process.argv.includes("--apply");
  const deleteOriginals = process.argv.includes("--delete-originals");
  const client = createClient(supabaseUrl, serviceKey);

  const seoResult = await optimizeStorageBucket(
    client,
    supabaseUrl,
    SEO_IMAGE_BUCKET,
    { maxWidth: 2400, maxHeight: 2400, quality: 82 },
    apply,
    deleteOriginals,
  );
  const premadeResult = await optimizeStorageBucket(
    client,
    supabaseUrl,
    PREMADE_IMAGE_BUCKET,
    { maxWidth: 1800, maxHeight: 1800, quality: 82 },
    apply,
    deleteOriginals,
  );
  const packagingResult = await optimizeStorageBucket(
    client,
    supabaseUrl,
    PACKAGING_IMAGE_BUCKET,
    { maxWidth: 1800, maxHeight: 1800, quality: 82 },
    apply,
    deleteOriginals,
  );

  const sitePagesUpdated = await updateSitePages(client, seoResult.urlReplacements, apply);
  const premadeRowsUpdated = await updatePathColumn(
    client,
    "premade_candies",
    "image_path",
    premadeResult.pathReplacements,
    apply,
  );
  const packagingRowsUpdated = await updatePathColumn(
    client,
    "packaging_option_images",
    "image_path",
    packagingResult.pathReplacements,
    apply,
  );
  const ordersUpdated = await optimizeOrderInlineImages(client, apply);

  console.log(`SEO bucket images processed: ${seoResult.processed}`);
  console.log(`Pre-made bucket images processed: ${premadeResult.processed}`);
  console.log(`Packaging bucket images processed: ${packagingResult.processed}`);
  console.log(`Site pages updated: ${sitePagesUpdated}`);
  console.log(`Pre-made rows updated: ${premadeRowsUpdated}`);
  console.log(`Packaging image rows updated: ${packagingRowsUpdated}`);
  console.log(`Orders with inline images updated: ${ordersUpdated}`);

  if (!apply) {
    console.log("Dry run complete. Re-run with --apply to upload optimised images and update references.");
    console.log("Add --delete-originals if you also want the old storage files removed after replacement.");
  }
}

main().catch((err) => {
  console.error("Image optimisation failed:", err.message || err);
  process.exit(1);
});
