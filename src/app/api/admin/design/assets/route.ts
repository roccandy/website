import { getAdminSession } from "@/lib/adminAuth";
import {
  MAX_STUDIO_ASSET_BYTES,
  storeDesignImage,
} from "@/lib/candyDesignAssets";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session || session.user.role === "seo" || !session.user.canWrite)
    return new Response("Unauthorised", { status: 403 });
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const input = await request.json();
      const { supabaseAdminClient } = await import("@/lib/supabase/admin");
      const bucket = supabaseAdminClient.storage.from("candy-design-assets");
      if (input.action === "prepare") {
        if (
          !["image/png", "image/jpeg", "image/webp"].includes(input.type) ||
          !Number.isFinite(input.size) ||
          input.size <= 0 ||
          input.size > MAX_STUDIO_ASSET_BYTES
        )
          throw new Error("Choose a PNG, JPEG or WebP up to 20MB.");
        const extension =
          input.type === "image/jpeg" ? "jpg" : input.type.split("/")[1];
        const path = `pending/${crypto.randomUUID()}.${extension}`;
        const { data, error } = await bucket.createSignedUploadUrl(path);
        if (error || !data)
          throw new Error("Unable to prepare artwork upload.");
        return Response.json({ path, signedUrl: data.signedUrl });
      }
      if (
        input.action === "finish" &&
        typeof input.path === "string" &&
        /^pending\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(input.path)
      ) {
        const { data, error } = await bucket.download(input.path);
        if (error || !data)
          throw new Error("Artwork upload could not be loaded. Please retry.");
        try {
          return Response.json(
            await storeDesignImage(Buffer.from(await data.arrayBuffer())),
          );
        } finally {
          await bucket.remove([input.path]);
        }
      }
      throw new Error("Invalid artwork upload request.");
    }
    const length = Number(request.headers.get("content-length") || 0);
    if (length > MAX_STUDIO_ASSET_BYTES)
      throw new Error("Choose artwork up to 20MB.");
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Choose an image to upload.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_STUDIO_ASSET_BYTES) {
        await reader.cancel();
        throw new Error("Choose artwork up to 20MB.");
      }
      chunks.push(value);
    }
    return Response.json(await storeDesignImage(Buffer.concat(chunks)));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to save artwork.",
      },
      { status: 400 },
    );
  }
}
