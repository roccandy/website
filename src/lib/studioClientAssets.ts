"use client";

export async function uploadStudioImage(file: Blob) {
  const prepare = await fetch("/api/admin/design/assets", {
    method: "POST",
    body: JSON.stringify({
      action: "prepare",
      size: file.size,
      type: file.type,
    }),
    headers: { "Content-Type": "application/json" },
  });
  const ticket = await prepare.json();
  if (!prepare.ok)
    throw new Error(ticket.error || "Unable to prepare artwork upload.");
  const uploaded = await fetch(ticket.signedUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type, "x-upsert": "false" },
  });
  if (!uploaded.ok) throw new Error("Artwork upload failed. Please try again.");
  const response = await fetch("/api/admin/design/assets", {
    method: "POST",
    body: JSON.stringify({ action: "finish", path: ticket.path }),
    headers: { "Content-Type": "application/json" },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to save artwork.");
  return result as { image: string; imageWidth: number; imageHeight: number };
}
export async function uploadStudioDataUrl(value: string) {
  return uploadStudioImage(await (await fetch(value)).blob());
}
