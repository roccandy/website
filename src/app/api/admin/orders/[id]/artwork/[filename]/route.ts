import { getAdminSession } from "@/lib/adminAuth";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { inlineOrderLogo } from "@/lib/inlineOrderLogo";

export async function GET(_request: Request, { params }: { params: Promise<{id:string;filename:string}> }) {
  const session = await getAdminSession();
  if (!session) return new Response("Not authorised", {status:401,headers:{"Cache-Control":"no-store"}});
  const { id, filename } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^logo\.(png|jpg|webp|gif|svg)$/.test(filename)) return new Response("Not found", {status:404});
  const { data, error } = await supabaseAdminClient.from("orders").select("logo_url").eq("id",id).maybeSingle();
  const image = error ? null : inlineOrderLogo(data?.logo_url);
  if (!image || filename !== `logo.${image.extension}`) return new Response("Not found", {status:404,headers:{"Cache-Control":"no-store"}});
  return new Response(new Uint8Array(image.bytes), {headers:{
    "Content-Type":image.contentType,
    "Content-Disposition":`inline; filename="${filename}"`,
    "Content-Security-Policy":"default-src 'none'; sandbox",
    "X-Content-Type-Options":"nosniff",
    "Cache-Control":"private, max-age=30",
    "Vary":"Cookie",
  }});
}
