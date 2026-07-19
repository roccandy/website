import { describe, expect, it } from "vitest";
import { parseEnquiryRequest } from "@/lib/enquiry";

const now = Date.parse("2026-07-19T05:00:00.000Z");

describe("parseEnquiryRequest", () => {
  it("normalizes a valid website enquiry and keeps optional context", () => {
    const result = parseEnquiryRequest(
      {
        name: "  Jane   Smith ",
        email: " JANE@example.com ",
        phone: " 0412 345 678 ",
        organisation: " Example Co ",
        interest: "branded",
        requiredDate: "2026-09-10",
        quantity: "Approx. 200 bags",
        message: "We would like logo candy for our September event.",
        productContext: "Branded logo candy",
        sourcePage: "https://roccandy.com.au/design/branded-logo-candy?campaign=spring",
        website: "",
        startedAt: now - 30_000,
      },
      now,
    );

    expect(result).toEqual({
      ok: true,
      isSpam: false,
      enquiry: {
        name: "Jane Smith",
        email: "jane@example.com",
        phone: "0412 345 678",
        organisation: "Example Co",
        interest: "branded",
        requiredDate: "2026-09-10",
        quantity: "Approx. 200 bags",
        message: "We would like logo candy for our September event.",
        productContext: "Branded logo candy",
        sourcePage: "/design/branded-logo-candy?campaign=spring",
      },
    });
  });

  it("rejects invalid required fields", () => {
    expect(
      parseEnquiryRequest(
        {
          name: "J",
          email: "not-an-email",
          message: "Short",
        },
        now,
      ),
    ).toEqual({ ok: false, error: "Please enter your name." });
  });

  it("silently accepts honeypot submissions without creating an enquiry", () => {
    expect(
      parseEnquiryRequest(
        {
          name: "Spam Bot",
          email: "spam@example.com",
          message: "This is an automated submission.",
          website: "https://spam.example",
        },
        now,
      ),
    ).toEqual({ ok: true, enquiry: null, isSpam: true });
  });

  it("does not include external source URLs", () => {
    const result = parseEnquiryRequest(
      {
        name: "Jane Smith",
        email: "jane@example.com",
        message: "Please send some information about wedding candy.",
        sourcePage: "https://example.com/not-roccandy",
      },
      now,
    );

    expect(result.ok && !result.isSpam ? result.enquiry.sourcePage : "invalid").toBeNull();
  });
});
