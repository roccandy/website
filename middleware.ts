import { NextResponse, type NextRequest } from "next/server";
import {
  normalizeRedirectDestinationPath,
  normalizeRedirectSourcePath,
  type SiteRedirect,
} from "@/lib/siteRedirectsShared";

const REDIRECT_CACHE_TTL_MS = 60_000;
const SITE_REDIRECTS_TABLE = "site_redirects";

type RedirectRow = {
  source_path: string;
  destination_path: string;
  status_code: number;
  is_active: boolean;
  updated_at?: string | null;
};

let redirectCache: {
  expiresAt: number;
  redirects: SiteRedirect[];
} | null = null;

function shouldSkipRedirectLookup(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/admin") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.webmanifest"
  );
}

function mapRow(row: RedirectRow): SiteRedirect {
  return {
    sourcePath: normalizeRedirectSourcePath(row.source_path),
    destinationPath: normalizeRedirectDestinationPath(row.destination_path),
    statusCode: row.status_code === 302 ? 302 : 301,
    isActive: row.is_active !== false,
    updatedAt: row.updated_at ?? null,
  };
}

async function loadRedirects() {
  const now = Date.now();
  if (redirectCache && redirectCache.expiresAt > now) {
    return redirectCache.redirects;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return [];
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/${SITE_REDIRECTS_TABLE}?select=source_path,destination_path,status_code,is_active,updated_at&is_active=eq.true`,
    {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      next: { revalidate: 60 },
    },
  );

  if (!response.ok) {
    return [];
  }

  const rows = ((await response.json()) as RedirectRow[]).map(mapRow);
  redirectCache = {
    expiresAt: now + REDIRECT_CACHE_TTL_MS,
    redirects: rows,
  };
  return rows;
}

function resolveDestinationUrl(request: NextRequest, redirect: SiteRedirect) {
  const destination = redirect.destinationPath;
  const target = /^https?:\/\//i.test(destination)
    ? new URL(destination)
    : new URL(destination, request.url);

  request.nextUrl.searchParams.forEach((value, key) => {
    if (!target.searchParams.has(key)) {
      target.searchParams.set(key, value);
    }
  });

  return target;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (shouldSkipRedirectLookup(pathname)) {
    return NextResponse.next();
  }

  const redirects = await loadRedirects();
  if (redirects.length === 0) {
    return NextResponse.next();
  }

  const requestPath = normalizeRedirectSourcePath(pathname);
  const requestPathWithSearch = normalizeRedirectSourcePath(`${pathname}${search}`);
  const redirect =
    redirects.find((item) => item.sourcePath === requestPathWithSearch) ??
    redirects.find((item) => item.sourcePath === requestPath);

  if (!redirect || !redirect.isActive) {
    return NextResponse.next();
  }

  const destinationUrl = resolveDestinationUrl(request, redirect);
  const currentUrl = new URL(request.url);
  if (destinationUrl.toString() === currentUrl.toString()) {
    return NextResponse.next();
  }

  return NextResponse.redirect(destinationUrl, redirect.statusCode);
}

export const config = {
  matcher: ["/((?!api|admin|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest).*)"],
};
