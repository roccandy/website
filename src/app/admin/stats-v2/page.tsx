import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/adminAuth";
import { getCachedStatsDataset } from "../adminReadModels";
import StatsHub from "./StatsHub";
import { parseFilters } from "./statsModel";

export const metadata: Metadata = {
  title: "Stats v2 (demo) | Roc Candy Admin",
};
export const dynamic = "force-dynamic";

export default async function StatsDemoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAdminSession();
  if (session.user.role === "production") redirect("/admin/production");
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (typeof value === "string") query.set(key, value);
  const dataset = await getCachedStatsDataset();
  return (
    <StatsHub
      dataset={dataset}
      initialFilters={parseFilters(query)}
      canViewCustomers={session.user.role !== "seo"}
    />
  );
}
