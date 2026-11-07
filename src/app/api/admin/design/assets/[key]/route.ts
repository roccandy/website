import { getAdminSession } from "@/lib/adminAuth";
import { supabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  const session = await getAdminSession();
  if (!session || session.user.role === "seo") return new Response("Unauthorised", { status: 403 });
  const { key } = await context.params;
  if (!/^[a-f0-9]{64}\.png$/.test(key)) return new Response("Not found", { status: 404 });
  const { data, error } = await supabaseAdminClient.storage.from("candy-design-assets").download(key);
  if (error || !data) return new Response("Not found", { status: 404 });
  return new Response(data, { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
