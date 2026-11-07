import { getAdminSession } from "@/lib/adminAuth";
import { importLegacyCandyImage } from "@/lib/candyDesignImport";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session?.user.canWrite) return new Response("Unauthorised", { status: 403 });
  try {
    const { url } = await request.json();
    if (typeof url !== "string") throw new Error("Artwork is required.");
    const origins = [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SITE_URL, process.env.SITE_URL]
      .filter(Boolean).map(value => new URL(value!).origin);
    return Response.json({ image: await importLegacyCandyImage(url, origins) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to import artwork." }, { status: 400 });
  }
}
