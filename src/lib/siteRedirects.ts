import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabasePublicClient } from "@/lib/supabase/public";
import {
  normalizeRedirectDestinationPath,
  normalizeRedirectSourcePath,
  parseRedirectStatusCode,
  type SiteRedirect,
} from "@/lib/siteRedirectsShared";

export type { SiteRedirect } from "@/lib/siteRedirectsShared";

const SITE_REDIRECTS_TABLE = "site_redirects";

type SiteRedirectRow = {
  source_path: string;
  destination_path: string;
  status_code: number;
  is_active: boolean;
  updated_at?: string | null;
};

function isMissingTableError(message: string) {
  return message.includes("site_redirects") || message.includes("relation") || message.includes("schema cache");
}

function mapRow(row: SiteRedirectRow): SiteRedirect {
  return {
    sourcePath: normalizeRedirectSourcePath(row.source_path),
    destinationPath: normalizeRedirectDestinationPath(row.destination_path),
    statusCode: parseRedirectStatusCode(row.status_code),
    isActive: row.is_active !== false,
    updatedAt: row.updated_at ?? null,
  };
}

function isInternalDestinationPath(value: string) {
  return value.startsWith("/") || value.startsWith("?") || value.startsWith("#");
}

function resolveRedirectLoopIssue(redirects: SiteRedirect[], nextRedirect: Pick<SiteRedirect, "sourcePath" | "destinationPath">) {
  if (!isInternalDestinationPath(nextRedirect.destinationPath)) {
    return null;
  }

  const lookup = new Map<string, string>();
  for (const redirect of redirects) {
    if (!redirect.isActive) continue;
    if (!isInternalDestinationPath(redirect.destinationPath)) continue;
    lookup.set(redirect.sourcePath, redirect.destinationPath);
  }
  lookup.set(nextRedirect.sourcePath, nextRedirect.destinationPath);

  const visited = new Set<string>([nextRedirect.sourcePath]);
  let cursor = nextRedirect.destinationPath;

  while (cursor) {
    const normalizedCursor = normalizeRedirectSourcePath(cursor);
    if (!normalizedCursor) return null;
    if (visited.has(normalizedCursor)) {
      return `This redirect creates a loop through ${normalizedCursor}.`;
    }
    visited.add(normalizedCursor);
    cursor = lookup.get(normalizedCursor) ?? "";
  }

  return null;
}

export async function listSiteRedirects(): Promise<SiteRedirect[]> {
  const { data, error } = await supabasePublicClient
    .from(SITE_REDIRECTS_TABLE)
    .select("source_path,destination_path,status_code,is_active,updated_at")
    .order("source_path", { ascending: true });

  if (error) {
    const message = error.message.toLowerCase();
    if (isMissingTableError(message)) return [];
    throw new Error(error.message);
  }

  return ((data ?? []) as SiteRedirectRow[]).map(mapRow);
}

export async function saveSiteRedirect(input: {
  sourcePath: string;
  destinationPath: string;
  statusCode?: number | string | null;
  isActive?: boolean;
}) {
  const sourcePath = normalizeRedirectSourcePath(input.sourcePath);
  const destinationPath = normalizeRedirectDestinationPath(input.destinationPath);
  const statusCode = parseRedirectStatusCode(input.statusCode);

  if (!sourcePath) {
    throw new Error("Source path is required.");
  }
  if (!destinationPath) {
    throw new Error("Destination path is required.");
  }
  if (sourcePath === destinationPath) {
    throw new Error("Source and destination cannot be the same.");
  }
  if (sourcePath.startsWith("/admin")) {
    throw new Error("Admin paths cannot be redirected from this tool.");
  }

  const existingRedirects = await listSiteRedirects();
  const duplicateSource = existingRedirects.find(
    (item) => item.sourcePath === sourcePath && item.destinationPath === destinationPath && item.statusCode === statusCode,
  );
  if (duplicateSource && duplicateSource.isActive === (input.isActive !== false)) {
    return;
  }

  const loopIssue = resolveRedirectLoopIssue(
    existingRedirects.filter((item) => item.sourcePath !== sourcePath),
    { sourcePath, destinationPath },
  );
  if (loopIssue) {
    throw new Error(loopIssue);
  }

  const { error } = await supabaseAdminClient.from(SITE_REDIRECTS_TABLE).upsert(
    {
      source_path: sourcePath,
      destination_path: destinationPath,
      status_code: statusCode,
      is_active: input.isActive !== false,
    },
    { onConflict: "source_path" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteSiteRedirect(sourcePath: string) {
  const normalizedSource = normalizeRedirectSourcePath(sourcePath);
  if (!normalizedSource) {
    throw new Error("Source path is required.");
  }

  const { error } = await supabaseAdminClient.from(SITE_REDIRECTS_TABLE).delete().eq("source_path", normalizedSource);
  if (error) {
    throw new Error(error.message);
  }
}
