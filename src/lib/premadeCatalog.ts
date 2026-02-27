import type { PremadeCandy } from "@/lib/data";

const PREMADE_IMAGE_BUCKET = "premade-images";

export function buildPremadeImageUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !path) return "";
  const encoded = encodeURIComponent(path);
  return `${base}/storage/v1/object/public/${PREMADE_IMAGE_BUCKET}/${encoded}`;
}

export function formatPremadeWeight(weight_g: number) {
  if (!Number.isFinite(weight_g)) return "";
  if (weight_g >= 1000) {
    const kg = weight_g / 1000;
    return `${kg % 1 === 0 ? kg.toFixed(0) : kg.toFixed(1)}kg`;
  }
  return `${weight_g}g`;
}

export function formatPremadeMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

export function formatPremadeFlavors(flavors: string[] | null) {
  if (!flavors || flavors.length === 0) return "";
  if (flavors.includes("Mixed")) return "Mixed Flavours";
  if (flavors.length === 1) return flavors[0];
  if (flavors.length === 2) return `${flavors[0]} & ${flavors[1]}`;
  if (flavors.length === 3) return `${flavors[0]}, ${flavors[1]} & ${flavors[2]}`;
  const allButLast = flavors.slice(0, -1).join(", ");
  const last = flavors[flavors.length - 1];
  return `${allButLast} & ${last}`;
}

export function makePremadeSlug(name: string) {
  const normalized = name
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "item";
}

export function buildPremadeItemPath(item: Pick<PremadeCandy, "id" | "name">) {
  return `/pre-made-candy/${item.id}--${makePremadeSlug(item.name)}`;
}

export function extractPremadeIdFromParam(param: string) {
  const [id] = param.split("--");
  return id?.trim() || "";
}
