import type { MetadataRoute } from "next";
import { getPremadeCandies } from "@/lib/data";
import { buildManagedPageHref, getManagedPages } from "@/lib/managedPages";
import { buildPremadeItemPath } from "@/lib/premadeCatalog";
import { getSiteBaseUrl } from "@/lib/siteUrl";

const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/design", changeFrequency: "weekly", priority: 0.9 },
  { path: "/pre-made-candy", changeFrequency: "daily", priority: 0.9 },
  { path: "/about", changeFrequency: "monthly", priority: 0.7 },
  { path: "/faq", changeFrequency: "weekly", priority: 0.7 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms-and-conditions", changeFrequency: "yearly", priority: 0.3 },
];

function toDate(value: string | null | undefined) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteBaseUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${baseUrl}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  try {
    const [premadeItems, managedPages] = await Promise.all([getPremadeCandies(), getManagedPages()]);
    const premadeEntries: MetadataRoute.Sitemap = premadeItems
      .filter((item) => item.is_active)
      .map((item) => ({
        url: `${baseUrl}${buildPremadeItemPath(item)}`,
        lastModified: toDate(item.created_at) ?? now,
        changeFrequency: "weekly",
        priority: 0.8,
      }));
    const managedEntries: MetadataRoute.Sitemap = managedPages
      .filter((page) => page.isPublished && page.isIndexable)
      .map((page) => ({
        url: `${baseUrl}${buildManagedPageHref(page.slugPath)}`,
        lastModified: toDate(page.updatedAt) ?? now,
        changeFrequency: "monthly",
        priority: page.slugPath.startsWith("design/") ? 0.8 : 0.7,
      }));

    return [...staticEntries, ...managedEntries, ...premadeEntries];
  } catch {
    return staticEntries;
  }
}
