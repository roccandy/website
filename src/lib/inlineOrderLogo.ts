import { createHash } from "node:crypto";

const types: Record<string,string> = { "image/png":"png", "image/jpeg":"jpg", "image/webp":"webp", "image/gif":"gif", "image/svg+xml":"svg" };

export function inlineOrderLogo(value: string | null | undefined) {
  if (!value || value.length > 8_000_000) return null;
  const match = /^data:(image\/[a-z+]+);base64,([a-z0-9+/=\r\n]+)$/i.exec(value);
  if (!match || !types[match[1].toLowerCase()]) return null;
  return { contentType: match[1].toLowerCase(), extension: types[match[1].toLowerCase()], bytes: Buffer.from(match[2],"base64") };
}

export function productionLogoUrl(id: string, value: string | null | undefined) {
  const image = inlineOrderLogo(value);
  if (!image) return value ?? null;
  const version = createHash("sha256").update(image.bytes).digest("hex").slice(0,16);
  return `/api/admin/orders/${encodeURIComponent(id)}/artwork/logo.${image.extension}?v=${version}`;
}
