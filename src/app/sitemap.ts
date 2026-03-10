import type { MetadataRoute } from "next";
import { getPremadeCandies } from "@/lib/data";
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
  { path: "/contact", changeFrequency: "monthly", priority: 0.7 },
  { path: "/shipping-and-returns", changeFrequency: "yearly", priority: 0.4 },
  { path: "/design/wedding-candy", changeFrequency: "monthly", priority: 0.8 },
  { path: "/design/custom-text-candy", changeFrequency: "monthly", priority: 0.8 },
  { path: "/design/branded-logo-candy", changeFrequency: "monthly", priority: 0.8 },
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
    const premadeItems = await getPremadeCandies();
    const premadeEntries: MetadataRoute.Sitemap = premadeItems
      .filter((item) => item.is_active)
      .map((item) => ({
        url: `${baseUrl}${buildPremadeItemPath(item)}`,
        lastModified: toDate(item.created_at) ?? now,
        changeFrequency: "weekly",
        priority: 0.8,
      }));

    return [...staticEntries, ...premadeEntries];
  } catch {
    return staticEntries;
  }
}
