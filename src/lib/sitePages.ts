import { supabaseServerClient } from "@/lib/supabase/server";

const SITE_PAGES_TABLE = "site_pages";

export type ManagedSitePage = {
  slug: string;
  title: string;
  bodyHtml: string;
};

type SitePageRow = {
  slug: string;
  title: string;
  body_html: string;
};

const DEFAULT_SITE_PAGES: Record<string, ManagedSitePage> = {
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    bodyHtml: "<p>Add privacy policy content in admin.</p>",
  },
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\r\n/g, "\n").trim();
}

function isMissingTableError(message: string) {
  return (
    message.includes("site_pages") ||
    message.includes("relation") ||
    message.includes("schema cache")
  );
}

export async function getManagedSitePage(slug: string): Promise<ManagedSitePage> {
  const { data, error } = await supabaseServerClient
    .from(SITE_PAGES_TABLE)
    .select("slug,title,body_html")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    const message = error.message.toLowerCase();
    if (!isMissingTableError(message)) {
      throw new Error(error.message);
    }
    return DEFAULT_SITE_PAGES[slug] ?? { slug, title: slug, bodyHtml: "" };
  }

  if (data) {
    const row = data as SitePageRow;
    return {
      slug: row.slug,
      title: normalizeText(row.title),
      bodyHtml: normalizeText(row.body_html),
    };
  }

  const fallback = DEFAULT_SITE_PAGES[slug] ?? { slug, title: slug, bodyHtml: "" };
  await saveManagedSitePage(fallback);
  return fallback;
}

export async function saveManagedSitePage(page: ManagedSitePage) {
  const payload = {
    slug: page.slug,
    title: normalizeText(page.title),
    body_html: normalizeText(page.bodyHtml),
  };

  const { error } = await supabaseServerClient.from(SITE_PAGES_TABLE).upsert(payload, {
    onConflict: "slug",
  });

  if (error) {
    throw new Error(error.message);
  }
}
