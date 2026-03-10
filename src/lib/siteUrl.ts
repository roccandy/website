const DEFAULT_SITE_URL = "https://roccandy.com.au";

function ensureBaseUrl(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, "");
  return `https://${trimmed.replace(/\/+$/, "")}`;
}

export function getSiteBaseUrl() {
  return (
    ensureBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ??
    ensureBaseUrl(process.env.SITE_URL) ??
    ensureBaseUrl(process.env.VERCEL_URL) ??
    DEFAULT_SITE_URL
  );
}
