import { normalizePremadeSlugInput } from "@/lib/premadeCatalog";
import { supabaseAdminClient } from "@/lib/supabase/admin";

export async function resolveUniquePremadeSlug(
  value: string,
  excludeId?: string | null,
  autoAdjust = false,
) {
  const baseSlug = normalizePremadeSlugInput(value);
  let nextSlug = baseSlug;
  let suffix = 2;

  while (true) {
    let query = supabaseAdminClient.from("premade_candies").select("id").eq("slug", nextSlug);
    if (excludeId) {
      query = query.neq("id", excludeId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return nextSlug;
    if (!autoAdjust) {
      throw new Error("This product URL is already in use.");
    }
    nextSlug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}
