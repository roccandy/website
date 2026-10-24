import { archiveHeaders, authenticatedEmail } from "@/lib/emailArchiveHttp";
import { readArchivedFile } from "@/lib/emailArchive";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const email = await authenticatedEmail((await params).id);
  if (email instanceof Response) return email;
  try {
    const bytes = await readArchivedFile(email.raw_path, email.raw_sha256);
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...archiveHeaders,
        "Content-Type": "message/rfc822",
        "Content-Disposition": `attachment; filename="roc-candy-email-${email.id}.eml"`,
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response("Original email unavailable", {
      status: 503,
      headers: archiveHeaders,
    });
  }
}
