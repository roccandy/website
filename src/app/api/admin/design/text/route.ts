import { getAdminSession } from "@/lib/adminAuth";
import { parseCandyDesign } from "@/lib/candyDesign";
import { candyTextGeometry } from "@/lib/candyDesignText";
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session || session.user.role === "seo")
    return new Response("Unauthorised", { status: 403 });
  try {
    const design = parseCandyDesign((await request.json()).design);
    if (!design) throw new Error("A design is required.");
    return Response.json(await candyTextGeometry(design), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unable to render lettering." },
      { status: 400 },
    );
  }
}
