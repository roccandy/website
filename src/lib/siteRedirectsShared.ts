export type SiteRedirect = {
  sourcePath: string;
  destinationPath: string;
  statusCode: 301 | 302;
  isActive: boolean;
  updatedAt?: string | null;
};

export function normalizeRedirectSourcePath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      return normalizeRedirectSourcePath(`${url.pathname}${url.search}`);
    } catch {
      return "";
    }
  }
  const [pathname, search = ""] = trimmed.split("?");
  const normalizedPath = `/${pathname.replace(/^\/+/, "").replace(/\/{2,}/g, "/")}`.replace(/\/+$/, "") || "/";
  return search ? `${normalizedPath}?${search}` : normalizedPath;
}

export function normalizeRedirectDestinationPath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const [pathname, search = ""] = trimmed.split("?");
  const normalizedPath = `/${pathname.replace(/^\/+/, "").replace(/\/{2,}/g, "/")}`.replace(/\/+$/, "") || "/";
  return search ? `${normalizedPath}?${search}` : normalizedPath;
}

export function parseRedirectStatusCode(value: string | number | null | undefined): 301 | 302 {
  return Number(value) === 302 ? 302 : 301;
}
