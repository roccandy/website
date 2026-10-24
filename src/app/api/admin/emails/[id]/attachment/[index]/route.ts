import {
  archiveHeaders,
  attachmentFilename,
  authenticatedEmail,
} from "@/lib/emailArchiveHttp";
import { readArchivedFile } from "@/lib/emailArchive";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const { id, index } = await params;
  const email = await authenticatedEmail(id);
  if (email instanceof Response) return email;
  if (!/^\d+$/.test(index) || !email.attachments[Number(index)])
    return new Response("Not found", { status: 404, headers: archiveHeaders });
  const file = email.attachments[Number(index)];
  try {
    const bytes = await readArchivedFile(file.path, file.sha256);
    const pdf =
      file.contentType === "application/pdf" &&
      bytes.subarray(0, 5).toString() === "%PDF-";
    const inline =
      pdf && new URL(request.url).searchParams.get("inline") === "1";
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...archiveHeaders,
        "Content-Type": pdf ? "application/pdf" : "application/octet-stream",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${attachmentFilename(file.filename)}"`,
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response("Original attachment unavailable", {
      status: 503,
      headers: archiveHeaders,
    });
  }
}
