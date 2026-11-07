import sharp from "sharp";

/** Rasterise existing artwork without exposing SVGs or following unrestricted URLs. */
export async function importLegacyCandyImage(raw: string, allowedOrigins: string[]) {
  let input: Buffer;
  if (raw.startsWith("data:")) {
    const match = raw.match(/^data:image\/(?:png|jpeg|webp|gif|svg\+xml|x-icon|vnd.microsoft.icon);base64,([a-zA-Z0-9+/=\s]+)$/);
    if (!match || raw.length > 5_400_000) throw new Error("Legacy artwork must be an image under 4MB.");
    input = Buffer.from(match[1], "base64");
  } else {
    let url = new URL(raw);
    let response: Response | undefined;
    for (let redirects=0; redirects<=3; redirects++) {
      if (!['https:', 'http:'].includes(url.protocol) || !allowedOrigins.includes(url.origin) || url.username || url.password) throw new Error("Legacy artwork host is not approved for import.");
      response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10000) });
      if ([301,302,303,307,308].includes(response.status)) { const location=response.headers.get('location'); if(!location) throw new Error("Artwork redirect is missing a destination."); url = new URL(location,url); continue; }
      break;
    }
    if (!response?.ok || !response.headers.get('content-type')?.startsWith('image/') || Number(response.headers.get('content-length'))>4_000_000) throw new Error(`Artwork download failed (${response?.status || 'no response'}).`);
    const reader=response.body?.getReader(); if(!reader) throw new Error("Artwork is empty.");
    const chunks: Uint8Array[]=[]; let size=0;
    try { for (;;) { const {done,value}=await reader.read(); if(done) break; size+=value.length; if(size>4_000_000) throw new Error("Artwork exceeds 4MB."); chunks.push(value); } } finally { await reader.cancel(); }
    input=Buffer.concat(chunks);
  }
  // Some historical uploads are ICO containers with a PNG image inside.
  // Read only a bounded directory entry; never execute or retain the container.
  if (input.length >= 6 && input.readUInt32LE(0) === 65536) {
    const count = input.readUInt16LE(4);
    const candidates: Array<{size: number; bytes: Buffer}> = [];
    if (count > 256 || 6 + count * 16 > input.length) throw new Error("Invalid icon artwork.");
    for (let index = 0; index < count; index++) {
      const entry = 6 + index * 16, length = input.readUInt32LE(entry + 8), offset = input.readUInt32LE(entry + 12);
      if (offset < 6 + count * 16 || offset + length > input.length) continue;
      const bytes = input.subarray(offset, offset + length);
      if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) candidates.push({size: (input[entry] || 256) * (input[entry + 1] || 256), bytes});
    }
    candidates.sort((a,b) => b.size-a.size);
    if (!candidates.length) throw new Error("This icon has no supported PNG artwork.");
    input = candidates[0].bytes;
  }
  const bytes=await sharp(input,{limitInputPixels:16_000_000}).rotate().resize(1200,1200,{fit:'inside',withoutEnlargement:true}).webp({quality:95}).toBuffer();
  return `data:image/webp;base64,${bytes.toString('base64')}`;
}
