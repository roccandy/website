import { redirect } from "next/navigation";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  title: "Pre-Made Rock Candy | Roc Candy",
  description: "Redirecting to Roc Candy pre-made rock candy collection.",
  path: "/pre-made-candy",
  noIndex: true,
});

type PremadeRedirectPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function PremadeRedirectPage({ searchParams }: PremadeRedirectPageProps) {
  const params = new URLSearchParams();
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item != null) params.append(key, item);
        }
      } else if (value != null) {
        params.set(key, value);
      }
    }
  }
  const query = params.toString();
  redirect(query ? `/pre-made-candy?${query}` : "/pre-made-candy");
}
