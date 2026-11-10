import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { studioCandyDesign } from "@/lib/candyDesign";
const { session } = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({ getAdminSession: session }));
import { POST } from "./route";
const request = (body: unknown) =>
  new Request("http://localhost/api/admin/design/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("admin Studio exports", () => {
  beforeEach(() => {
    session.mockResolvedValue({ user: { role: "admin" } });
  });
  it("requires a permitted admin session before reading or rendering the supplied design", async () => {
    for (const value of [null, { user: { role: "seo" } }]) {
      session.mockResolvedValue(value);
      expect((await POST(request({ design: "invalid" }))).status).toBe(403);
    }
  });
  it("produces a customer proof PDF with both views from an advanced snapshot", async () => {
    const design = studioCandyDesign("Client proof");
    design.jacket.mode = "segments";
    design.jacket.advanced!.segments = 12;
    design.productionNotes = "Internal recipe";
    design.source = { id: "77777777-7777-4777-8777-777777777777", revision: 3 };
    const response = await POST(request({ design, format: "proof" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain(
      "Client-proof-proof.pdf",
    );
    const pdf = await PDFDocument.load(await response.arrayBuffer());
    expect(pdf.getPages()).toHaveLength(1);
    const resources = pdf
      .getPage(0)
      .node.Resources()
      ?.get(pdf.context.obj("XObject"));
    expect(resources).toBeDefined();
  });
  it("respects the flat view and transparent presentation option for PNG downloads", async () => {
    const design = studioCandyDesign();
    design.presentation = { background: "#ff0000", transparent: true };
    const response = await POST(
      request({ design, format: "png", view: "face", presentation: true }),
    );
    expect(response.status).toBe(200);
    const { data, info } = await sharp(
      Buffer.from(await response.arrayBuffer()),
    )
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(1040);
    expect(info.height).toBe(1040);
    expect(info.channels).toBe(4);
    expect(data[3]).toBe(0);
  });
  it("returns a validation error without rewriting unsupported saved versions", async () => {
    const response = await POST(
      request({
        design: { ...studioCandyDesign(), schemaVersion: 999 },
        format: "svg",
      }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("Unsupported");
  });
});
