import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type QuoteRedirectPageProps = {
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
};

export default async function QuoteRedirectPage({ searchParams }: QuoteRedirectPageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const query = new URLSearchParams();

  if (resolvedSearchParams) {
    Object.entries(resolvedSearchParams).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry) query.append(key, entry);
        });
        return;
      }
      if (value) query.set(key, value);
    });
  }

  const queryString = query.toString();
  redirect(queryString ? `/design?${queryString}` : "/design");
}
