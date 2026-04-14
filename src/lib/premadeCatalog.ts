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

export function resolvePremadePrice(item: Pick<PremadeCandy, "price" | "sale_price">) {
  const salePrice = Number(item.sale_price);
  if (Number.isFinite(salePrice) && salePrice > 0) {
    return salePrice;
  }
  return Number(item.price);
}

export function hasPremadeSale(item: Pick<PremadeCandy, "price" | "sale_price">) {
  const salePrice = Number(item.sale_price);
  const basePrice = Number(item.price);
  return Number.isFinite(salePrice) && salePrice > 0 && salePrice < basePrice;
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

export function normalizePremadeSlugInput(value: string | null | undefined) {
  const normalized = makePremadeSlug(value ?? "");
  return normalized || "item";
}

export function buildPremadeLegacyItemPath(item: Pick<PremadeCandy, "id" | "name">) {
  return `/pre-made-candy/${item.id}--${makePremadeSlug(item.name)}`;
}

export function buildPremadeItemPath(item: Pick<PremadeCandy, "id" | "name"> & { slug?: string | null }) {
  const slug = normalizePremadeSlugInput(item.slug ?? item.name);
  return `/pre-made-candy/${slug}`;
}

export function isPremadeLegacyParam(param?: string | null) {
  if (!param || typeof param !== "string") return false;
  return param.includes("--") || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(param);
}

export function extractPremadeLegacyIdFromParam(param?: string | null) {
  if (!param || typeof param !== "string") return "";
  if (!isPremadeLegacyParam(param)) return "";
  const [id] = param.split("--");
  return id?.trim() || "";
}
