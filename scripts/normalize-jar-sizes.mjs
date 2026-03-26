import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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

function normalizeJarSize(size) {
  const trimmed = (size ?? "").trim();
  if (!trimmed) return "";
  const withoutGrams = trimmed.replace(/\s*\(?\d+\s*g\)?$/i, "");
  return withoutGrams.trim() || trimmed;
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

  const apply = process.argv.includes("--apply");
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: options, error } = await supabase
    .from("packaging_options")
    .select("id,type,size");
  if (error) throw error;

  const jarOptions = options.filter((opt) => (opt.type ?? "").toLowerCase().includes("jar"));
  let updated = 0;
  let skipped = 0;

  for (const opt of jarOptions) {
    const nextSize = normalizeJarSize(opt.size ?? "");
    if (!nextSize || nextSize === opt.size) {
      skipped += 1;
      continue;
    }

    if (!apply) {
      console.log(`Would update ${opt.id}: "${opt.size}" -> "${nextSize}"`);
      updated += 1;
      continue;
    }

    const { error: updateError } = await supabase
      .from("packaging_options")
      .update({ size: nextSize })
      .eq("id", opt.id);
    if (updateError) throw updateError;
    console.log(`Updated ${opt.id}: "${opt.size}" -> "${nextSize}"`);
    updated += 1;
  }

  if (!apply) {
    console.log(`Dry run complete. ${updated} updates pending, ${skipped} unchanged.`);
    console.log("Re-run with --apply to persist changes.");
    return;
  }

  console.log(`Done. Updated ${updated} jar sizes, ${skipped} unchanged.`);
}

main().catch((err) => {
  console.error("Normalize failed:", err.message || err);
  process.exit(1);
});
