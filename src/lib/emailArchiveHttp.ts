import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { getArchivedEmail, readArchivedFile } from "./emailArchive";
import type { ArchivedEmail } from "./emailArchiveTypes";
import sanitizeHtml from "sanitize-html";

export const archiveHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};
export async function authenticatedEmail(
  id: string,
): Promise<ArchivedEmail | Response> {
  const session = await getServerSession(authOptions);
  if (!session)
    return new Response("Unauthorised", {
      status: 401,
      headers: archiveHeaders,
    });
  if (session.user.role === "production")
    return new Response("Forbidden", { status: 403, headers: archiveHeaders });
  try {
    return (
      (await getArchivedEmail(id)) ??
      new Response("Not found", { status: 404, headers: archiveHeaders })
    );
  } catch {
    return new Response("Email archive unavailable", {
      status: 503,
      headers: archiveHeaders,
    });
  }
}
export const attachmentFilename = (name: string) =>
  name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 160) || "attachment";
export async function originalEmailPreview(email: ArchivedEmail) {
  let html = email.html_body || "";
  for (const file of email.attachments) {
    if (
      !file.cid ||
      !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(
        file.contentType,
      )
    )
      continue;
    const bytes = await readArchivedFile(file.path, file.sha256);
    html = html
      .split(`cid:${file.cid}`)
      .join(`data:${file.contentType};base64,${bytes.toString("base64")}`);
  }
  // The stored source and .eml remain untouched. This isolated *preview* is
  // intentionally inert: no scripts, forms, navigation, refresh or tracking.
  return sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "html",
      "head",
      "body",
      "style",
      "img",
      "col",
      "colgroup",
    ],
    allowedAttributes: {
      "*": [
        "style",
        "class",
        "id",
        "lang",
        "dir",
        "role",
        "align",
        "valign",
        "width",
        "height",
        "bgcolor",
      ],
      img: ["src", "alt", "width", "height", "style", "class"],
      table: [
        "cellpadding",
        "cellspacing",
        "border",
        "width",
        "height",
        "style",
        "class",
        "role",
        "align",
        "bgcolor",
      ],
      td: [
        "colspan",
        "rowspan",
        "width",
        "height",
        "style",
        "class",
        "align",
        "valign",
        "bgcolor",
      ],
      th: [
        "colspan",
        "rowspan",
        "width",
        "height",
        "style",
        "class",
        "align",
        "valign",
      ],
      style: ["type"],
    },
    allowedSchemes: ["data"],
    allowedSchemesByTag: { img: ["data"] },
    allowProtocolRelative: false,
    allowVulnerableTags: true, // Original email <style> is retained; CSP blocks all external resources.
    parseStyleAttributes: false,
  });
}
