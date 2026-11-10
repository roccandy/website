import { getAdminSession } from "@/lib/adminAuth";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { readCandyDesign } from "@/lib/candyDesign";

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (
    !session ||
    session.user.role === "seo" ||
    session.user.role === "production"
  )
    return new Response("Unauthorised", { status: 403 });
  const params = new URL(request.url).searchParams,
    search = (params.get("q") || "").trim().slice(0, 100),
    page = Math.max(
      0,
      Math.min(10000, Math.floor(Number(params.get("page")) || 0)),
    );
  let query = supabaseAdminClient
    .from("candy_designs")
    .select("id,name,document,revision,updated_at", { count: "exact" });
  if (search)
    query = query.ilike("name", `%${search.replace(/[%_]/g, "\\$&")}%`);
  const library = await query
    .order("updated_at", { ascending: false })
    .range(page * 24, page * 24 + 23);
  if (library.error)
    return Response.json(
      { error: "The design library could not be loaded. Please retry." },
      { status: 503 },
    );
  const id = params.get("design");
  const revisions =
    id && /^[a-f0-9-]{36}$/i.test(id)
      ? await supabaseAdminClient
          .from("candy_design_revisions")
          .select("revision,created_at")
          .eq("design_id", id)
          .order("revision", { ascending: false })
          .limit(30)
      : null;
  return Response.json(
    {
      designs: (library.data || []).map((row) => ({
        id: row.id,
        name: row.name,
        revision: row.revision,
        updatedAt: row.updated_at,
        design: readCandyDesign(row.document),
      })),
      count: library.count || 0,
      page,
      revisions: revisions?.data || [],
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
