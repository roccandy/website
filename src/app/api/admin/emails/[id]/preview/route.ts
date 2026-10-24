import {
  archiveHeaders,
  authenticatedEmail,
  originalEmailPreview,
} from "@/lib/emailArchiveHttp";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const email = await authenticatedEmail((await params).id);
  if (email instanceof Response) return email;
  try {
    return new Response(await originalEmailPreview(email), {
      headers: {
        ...archiveHeaders,
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy":
          "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'; sandbox",
      },
    });
  } catch {
    return new Response(
      "Original preview unavailable. Try downloading the original email.",
      { status: 503, headers: archiveHeaders },
    );
  }
}
