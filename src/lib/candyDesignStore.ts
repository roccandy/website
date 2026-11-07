import { supabaseAdminClient } from "@/lib/supabase/admin";
import { parseCandyDesign, type CandyDesign } from "@/lib/candyDesign";

export async function loadCandyDesign(
  id: string,
  revision?: number,
): Promise<CandyDesign | null> {
  if (!/^[a-f0-9-]{36}$/i.test(id)) return null;
  const query = revision
    ? supabaseAdminClient
        .from("candy_design_revisions")
        .select("document,revision")
        .eq("design_id", id)
        .eq("revision", revision)
    : supabaseAdminClient
        .from("candy_designs")
        .select("document,revision")
        .eq("id", id);
  const { data, error } = await query.maybeSingle();
  if (error)
    throw new Error(
      "Unable to load saved designs. Check the Design Studio migration has been applied.",
    );
  const design = data ? parseCandyDesign(data.document) : null;
  return design && data
    ? { ...design, source: { id, revision: data.revision } }
    : null;
}
