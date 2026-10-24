import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: { user: { role: "admin" } } as { user: { role: string } } | null,
  get: vi.fn(),
  read: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next-auth", () => ({ getServerSession: async () => mocks.session }));
vi.mock("../auth", () => ({ authOptions: {} }));
vi.mock("../emailArchive", () => ({
  getArchivedEmail: mocks.get,
  readArchivedFile: mocks.read,
}));
import { GET as preview } from "@/app/api/admin/emails/[id]/preview/route";
import { GET as original } from "@/app/api/admin/emails/[id]/original/route";
import { GET as attachment } from "@/app/api/admin/emails/[id]/attachment/[index]/route";
const id = "11111111-1111-4111-8111-111111111111";
const params = { params: Promise.resolve({ id }) };
beforeEach(() => {
  mocks.session = { user: { role: "admin" } };
  mocks.get.mockReset();
  mocks.read.mockReset();
  mocks.get.mockResolvedValue({
    id,
    raw_path: `${id}/original.eml`,
    raw_sha256: "hash",
    html_body:
      '<style>.test{color:red}</style><h1>Original</h1><img src="cid:logo"><script>window.parent.hacked=1</script><img src="https://tracker.example.test/pixel"><meta http-equiv="refresh" content="0;url=https://tracker.example.test"><form action="https://tracker.example.test"><input></form><a href="https://tracker.example.test">Link</a>',
    attachments: [
      {
        filename: 'invoice"\r\nUnsafe.pdf',
        contentType: "application/pdf",
        cid: null,
        path: `${id}/attachments/0`,
        sha256: "hash",
      },
      {
        filename: "logo.png",
        contentType: "image/png",
        cid: "logo",
        path: `${id}/attachments/1`,
        sha256: "hash",
      },
    ],
  });
  mocks.read.mockResolvedValue(Buffer.from("%PDF-original"));
});
describe("Private original-email endpoints", () => {
  it("never queries private mail for unauthenticated requests", async () => {
    mocks.session = null;
    for (const handler of [preview, original])
      expect(
        (await handler(new Request("https://example.test"), params)).status,
      ).toBe(401);
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("keeps production-only accounts out of customer correspondence", async () => {
    mocks.session = { user: { role: "production" } };
    expect(
      (await original(new Request("https://example.test"), params)).status,
    ).toBe(403);
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("allows read-only admin access without any send actions", async () => {
    mocks.session = { user: { role: "viewer" } };
    const response = await original(
      new Request("https://example.test"),
      params,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      Buffer.from("%PDF-original"),
    );
  });
  it("renders an inert preview with saved inline images, CSP, no scripts/refresh/forms/external resources", async () => {
    const response = await preview(new Request("https://example.test"), params),
      html = await response.text();
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "sandbox",
    );
    expect(response.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(html).toContain("data:image/png;base64,");
    expect(html).toContain(".test{color:red}");
    for (const unsafe of [
      "<script",
      "http-equiv",
      "<form",
      "href=",
      "https://tracker",
    ])
      expect(html).not.toContain(unsafe);
  });
  it("returns exact PDF bytes and safely encodes download filenames", async () => {
    const response = await attachment(
      new Request("https://example.test?inline=1"),
      { params: Promise.resolve({ id, index: "0" }) },
    );
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("inline");
    expect(response.headers.get("Content-Disposition")).not.toContain("\r");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      Buffer.from("%PDF-original"),
    );
  });
  it("forces non-PDF content to download, even when inline was requested", async () => {
    mocks.read.mockResolvedValue(Buffer.from("<script>alert(1)</script>"));
    const response = await attachment(
      new Request("https://example.test?inline=1"),
      { params: Promise.resolve({ id, index: "0" }) },
    );
    expect(response.headers.get("Content-Type")).toBe(
      "application/octet-stream",
    );
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
  });
  it("rejects missing/path-traversal attachment indices", async () => {
    for (const index of ["../original.eml", "-1", "99", "0.1"])
      expect(
        (
          await attachment(new Request("https://example.test"), {
            params: Promise.resolve({ id, index }),
          })
        ).status,
      ).toBe(404);
  });
  it("returns an unavailable response instead of corrupt/tampered bytes", async () => {
    mocks.read.mockRejectedValue(new Error("Integrity failure"));
    expect(
      (await original(new Request("https://example.test"), params)).status,
    ).toBe(503);
  });
});
