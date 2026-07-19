import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendWebsiteEnquiryEmails } = vi.hoisted(() => ({
  sendWebsiteEnquiryEmails: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendWebsiteEnquiryEmails,
}));

import { POST } from "@/app/api/enquiries/route";

function makeRequest(body: Record<string, unknown>, ip = "203.0.113.10") {
  return new Request("https://roccandy.com.au/api/enquiries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://roccandy.com.au",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

function makeMultipartRequest(
  fields: Record<string, string>,
  files: File[],
  ip = "203.0.113.20",
) {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => formData.set(key, value));
  files.forEach((file) => formData.append("attachments", file));
  return new Request("https://roccandy.com.au/api/enquiries", {
    method: "POST",
    headers: {
      Origin: "https://roccandy.com.au",
      "x-forwarded-for": ip,
    },
    body: formData,
  });
}

describe("POST /api/enquiries", () => {
  beforeEach(() => {
    sendWebsiteEnquiryEmails.mockReset();
    sendWebsiteEnquiryEmails.mockResolvedValue({ reference: "RCQ-TEST1234" });
  });

  it("sends a valid enquiry to the email handler", async () => {
    const response = await POST(
      makeRequest({
        name: "Jane Smith",
        email: "jane@example.com",
        phone: "0412 345 678",
        interest: "wedding",
        message: "Please help us choose candy for our wedding.",
        sourcePage: "/contact?interest=wedding",
        startedAt: Date.now() - 30_000,
        website: "",
      }),
    );
    const payload = (await response.json()) as { ok: boolean; reference: string };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.reference).toMatch(/^RCQ-[A-Z0-9]{8}$/);
    expect(sendWebsiteEnquiryEmails).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: payload.reference,
        enquiry: expect.objectContaining({
          name: "Jane Smith",
          email: "jane@example.com",
          interest: "wedding",
          sourcePage: "/contact?interest=wedding",
        }),
      }),
    );
  });

  it("rejects invalid enquiries before sending email", async () => {
    const response = await POST(
      makeRequest(
        {
          name: "J",
          email: "invalid",
          message: "Short",
        },
        "203.0.113.11",
      ),
    );

    expect(response.status).toBe(400);
    expect(sendWebsiteEnquiryEmails).not.toHaveBeenCalled();
  });

  it("returns a useful retry message if inbox delivery fails", async () => {
    sendWebsiteEnquiryEmails.mockRejectedValueOnce(new Error("SMTP unavailable"));
    const response = await POST(
      makeRequest(
        {
          name: "Jane Smith",
          email: "jane@example.com",
          interest: "general",
          message: "Please send some information about your custom candy.",
        },
        "203.0.113.12",
      ),
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(payload.error).toContain("enquiries@roccandy.com.au");
  });

  it("rejects cross-site submissions", async () => {
    const request = new Request("https://roccandy.com.au/api/enquiries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://example.com",
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(sendWebsiteEnquiryEmails).not.toHaveBeenCalled();
  });

  it("validates and sends uploaded attachments to the email handler", async () => {
    const response = await POST(
      makeMultipartRequest(
        {
          name: "Jane Smith",
          email: "jane@example.com",
          interest: "branded",
          message: "Please use our attached logo for the candy.",
        },
        [
          new File(
            [Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.from("logo")])],
            "our-logo.png",
            { type: "image/png" },
          ),
        ],
      ),
    );

    expect(response.status).toBe(200);
    expect(sendWebsiteEnquiryEmails).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            filename: "our-logo.png",
            contentType: "image/png",
          }),
        ],
      }),
    );
  });

  it("rejects a renamed file whose contents do not match its extension", async () => {
    const response = await POST(
      makeMultipartRequest(
        {
          name: "Jane Smith",
          email: "jane@example.com",
          message: "Please review the attached design file.",
        },
        [new File(["not really a PDF"], "design.pdf", { type: "application/pdf" })],
        "203.0.113.21",
      ),
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("does not appear to be a valid PDF");
    expect(sendWebsiteEnquiryEmails).not.toHaveBeenCalled();
  });
});
