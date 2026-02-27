import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

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
