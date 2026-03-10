import { supabaseServerClient } from "@/lib/supabase/server";
import {
  normalizeRedirectDestinationPath,
  normalizeRedirectSourcePath,
  parseRedirectStatusCode,
  type SiteRedirect,
} from "@/lib/siteRedirectsShared";

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

export async function listSiteRedirects(): Promise<SiteRedirect[]> {
  const { data, error } = await supabaseServerClient
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

  const { error } = await supabaseServerClient.from(SITE_REDIRECTS_TABLE).upsert(
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

  const { error } = await supabaseServerClient.from(SITE_REDIRECTS_TABLE).delete().eq("source_path", normalizedSource);
  if (error) {
    throw new Error(error.message);
  }
}
