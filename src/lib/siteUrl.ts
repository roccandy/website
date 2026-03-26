const DEFAULT_SITE_URL = "https://roccandy.com.au";

function ensureBaseUrl(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, "");
  return `https://${trimmed.replace(/\/+$/, "")}`;
}

function isTruthyEnv(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function isPreviewCrawlModeEnabled() {
  return isTruthyEnv(process.env.ALLOW_PREVIEW_CRAWL);
}

export function getPreviewCrawlBaseUrl() {
  return (
    ensureBaseUrl(process.env.PREVIEW_SITE_URL) ??
    ensureBaseUrl(process.env.NEXT_PUBLIC_PREVIEW_SITE_URL) ??
    ensureBaseUrl(process.env.VERCEL_URL) ??
    ensureBaseUrl(process.env.NEXT_PUBLIC_VERCEL_URL)
  );
}

export function getSiteBaseUrl() {
  const previewBaseUrl = isPreviewCrawlModeEnabled() ? getPreviewCrawlBaseUrl() : null;
  if (previewBaseUrl) {
    return previewBaseUrl;
  }

  return (
    ensureBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ??
    ensureBaseUrl(process.env.SITE_URL) ??
    DEFAULT_SITE_URL
  );
}
