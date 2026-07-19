import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMail } = vi.hoisted(() => ({
  sendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail,
    })),
  },
}));

import { sendWebsiteEnquiryEmails } from "@/lib/email";

describe("sendWebsiteEnquiryEmails", () => {
  const originalEnv = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_FROM: process.env.SMTP_FROM,
    SMTP_ENABLED: process.env.SMTP_ENABLED,
    ENQUIRIES_EMAIL: process.env.ENQUIRIES_EMAIL,
  };

  beforeAll(() => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "mailer@example.com";
    process.env.SMTP_PASS = "test-password";
    process.env.SMTP_FROM = "Roc Candy <mailer@example.com>";
    process.env.SMTP_ENABLED = "true";
    process.env.ENQUIRIES_EMAIL = "enquiries@roccandy.com.au";
  });

  beforeEach(() => {
    sendMail.mockReset();
    sendMail.mockResolvedValue({ messageId: "message-1" });
  });

  afterAll(() => {
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  });

  it("delivers the inbox email with customer Reply-To and sends a customer copy", async () => {
    await sendWebsiteEnquiryEmails({
      reference: "RCQ-ABC12345",
      receivedAt: "2026-07-19T04:00:00.000Z",
      enquiry: {
        name: "Jane Smith",
        email: "jane@example.com",
        phone: "0412 345 678",
        organisation: "Example Co",
        interest: "branded",
        requiredDate: "2026-09-10",
        quantity: "200 bags",
        message: "We would like branded candy for our event.",
        productContext: "Branded logo candy",
        sourcePage: "/design/branded-logo-candy",
      },
    });

    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(sendMail).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        from: "Roc Candy Enquiries <enquiries@roccandy.com.au>",
        to: ["enquiries@roccandy.com.au"],
        replyTo: "jane@example.com",
        subject: expect.stringContaining("RCQ-ABC12345"),
        text: expect.stringContaining("Product or page context: Branded logo candy"),
      }),
    );
    expect(sendMail).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        from: "Roc Candy Enquiries <enquiries@roccandy.com.au>",
        to: ["jane@example.com"],
        replyTo: "enquiries@roccandy.com.au",
        subject: expect.stringContaining("RCQ-ABC12345"),
      }),
    );
  });
});
