import { supabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await supabaseAdminClient.from("premade_candies").select("id").limit(1);
  if (error) {
    return new Response("Supabase keep-alive failed.", { status: 500 });
  }
  return new Response(null, { status: 204 });
}
