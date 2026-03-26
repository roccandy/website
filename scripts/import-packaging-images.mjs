import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const PACKAGING_IMAGE_BUCKET = "packaging-images";
const ORDER_PREFIX_MAP = {
  initials: "weddings-initials",
  names: "weddings-both-names",
  "text1-6": "custom-1-6",
  "text7-14": "custom-7-14",
  branded: "branded",
};
const FILE_TYPE_OVERRIDES = {
  "zipbags": "zip-bags",
  "zip-bag": "zip-bags",
  "zip-bags": "zip-bags",
  "bags": "bags",
  "bag": "bags",
  "jars": "jars",
  "jar": "jars",
  "cones": "cones",
  "cone": "cones",
  "bulk": "bulk",
};
const SIZE_SLUG_ALIASES = {
  cones: {
    small: "12-15",
    medium: "25-30",
  },
};
const PACKAGING_TYPE_OVERRIDES = {
  "clear bag": "bags",
  "zip bag": "zip-bags",
  jar: "jars",
  cone: "cones",
  bulk: "bulk",
};

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

function normalizeToken(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

function normalizeFileName(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-");
}

function resolvePackagingTypeSlug(type) {
  const raw = type.trim().toLowerCase();
  const mapped = PACKAGING_TYPE_OVERRIDES[raw];
  return mapped ? normalizeToken(mapped) : normalizeToken(raw);
}

function resolvePackagingSizeSlug(typeSlug, size) {
  if (!typeSlug || typeSlug === "bulk") return "";
  const normalized = size.trim().toLowerCase();
  if (typeSlug === "jars") {
    const first = normalized.split(" ")[0] ?? "";
    return normalizeToken(first);
  }
  const cleaned = normalized.replace(/pc/g, "").replace(/\s+/g, "");
  return normalizeToken(cleaned);
}

function parseFileParts(baseName) {
  const parts = baseName.split("_");
  if (parts.length < 2) return null;
  const [orderPrefix, typeSlug, sizeSlug, ...rest] = parts;
  const lidSlug = rest.length > 0 ? rest.join("_") : "";
  return {
    orderPrefix: normalizeToken(orderPrefix),
    typeSlug: normalizeToken(typeSlug),
    sizeSlug: normalizeToken(sizeSlug ?? ""),
    lidSlug: normalizeToken(lidSlug ?? ""),
  };
}

async function main() {
  const cwd = process.cwd();
  loadEnvFile(path.join(cwd, ".env.local"));
  loadEnvFile(path.join(cwd, ".env"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const inputDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(cwd, "packaging-images");
  if (!fs.existsSync(inputDir)) {
    console.error(`Folder not found: ${inputDir}`);
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: packagingOptions, error: optionsError } = await supabase
    .from("packaging_options")
    .select("id,type,size,allowed_categories,lid_colors");
  if (optionsError) throw optionsError;

  const files = fs
    .readdirSync(inputDir)
    .filter((file) => [".jpg", ".jpeg"].includes(path.extname(file).toLowerCase()));

  const optionLookup = packagingOptions.map((opt) => {
    const typeSlug = resolvePackagingTypeSlug(opt.type);
    const sizeSlug = resolvePackagingSizeSlug(typeSlug, opt.size);
    return { opt, typeSlug, sizeSlug };
  });

  let uploaded = 0;
  let skipped = 0;

  for (const file of files) {
    const parsed = path.parse(file);
    const base = parsed.name.toLowerCase();
    const parts = parseFileParts(base);
    if (!parts) {
      console.warn(`Skipping ${file}: invalid name format.`);
      skipped += 1;
      continue;
    }

    const categoryId = ORDER_PREFIX_MAP[parts.orderPrefix];
    if (!categoryId) {
      console.warn(`Skipping ${file}: unknown category prefix ${parts.orderPrefix}`);
      skipped += 1;
      continue;
    }

    const typeSlug = FILE_TYPE_OVERRIDES[parts.typeSlug] ?? parts.typeSlug;
    const sizeAlias = SIZE_SLUG_ALIASES[typeSlug]?.[parts.sizeSlug] ?? parts.sizeSlug;
    const sizeSlug = typeSlug === "bulk" ? "" : sizeAlias;
    const lidSlug = parts.lidSlug;

    const matches = optionLookup.filter(
      (item) => item.typeSlug === typeSlug && item.sizeSlug === sizeSlug
    );

    if (matches.length !== 1) {
      console.warn(
        `Skipping ${file}: expected 1 packaging option, found ${matches.length} for ${typeSlug}/${sizeSlug}`
      );
      skipped += 1;
      continue;
    }

    const packagingOption = matches[0].opt;
    const isJar = typeSlug === "jars";
    const lidColor = isJar ? lidSlug : "";
    if (isJar && !lidColor) {
      console.warn(`Skipping ${file}: jar image missing lid colour.`);
      skipped += 1;
      continue;
    }
    if (isJar && !(packagingOption.lid_colors ?? []).includes(lidColor)) {
      console.warn(`Skipping ${file}: lid colour ${lidColor} not enabled for option.`);
      skipped += 1;
      continue;
    }

    const fileName = normalizeFileName(`${base}${parsed.ext.toLowerCase()}`);
    const filePath = path.join(inputDir, file);
    const buffer = fs.readFileSync(filePath);

    const { error: uploadError } = await supabase.storage
      .from(PACKAGING_IMAGE_BUCKET)
      .upload(fileName, buffer, { contentType: "image/jpeg", upsert: true });
    if (uploadError) throw uploadError;

    const { error: upsertError } = await supabase.from("packaging_option_images").upsert(
      {
        packaging_option_id: packagingOption.id,
        category_id: categoryId,
        lid_color: lidColor,
        image_path: fileName,
      },
      { onConflict: "packaging_option_id,category_id,lid_color" }
    );
    if (upsertError) throw upsertError;

    uploaded += 1;
  }

  console.log(`Uploaded ${uploaded} images. Skipped ${skipped}.`);
}

main().catch((err) => {
  console.error("Import failed:", err.message || err);
  process.exit(1);
});
