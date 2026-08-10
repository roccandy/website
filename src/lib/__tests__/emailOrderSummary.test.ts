import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMail } = vi.hoisted(() => ({
  sendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail })),
  },
}));

import { sendCustomerOrderSummaryEmail } from "@/lib/email";

describe("sendCustomerOrderSummaryEmail", () => {
  const originalEnv = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_FROM: process.env.SMTP_FROM,
    SMTP_ENABLED: process.env.SMTP_ENABLED,
  };

  beforeAll(() => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "mailer@example.com";
    process.env.SMTP_PASS = "test-password";
    process.env.SMTP_FROM = "Roc Candy <mailer@example.com>";
    process.env.SMTP_ENABLED = "true";
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

  it("embeds a mail-safe PNG candy preview", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="#ff5f99"/></svg>';
    const imageDataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

    await sendCustomerOrderSummaryEmail(["customer@example.com"], {
      orderNumber: "0135",
      dateOrderedIso: "2026-08-10T00:00:00.000Z",
      customerName: "Customer",
      customerEmail: "customer@example.com",
      customerPhone: null,
      requestedDate: null,
      deliveryAddress: "Pickup",
      paymentMethod: "Square invoice",
      paymentAmount: 100,
      items: [{ title: "Custom candy", quantity: 1, flavor: "Raspberry", labelsCount: null, totalPrice: 100 }],
      customDetails: null,
      customDetailsList: [
        {
          imageUrl: null,
          imageDataUrl,
          fallbackImageUrl: null,
          orderNumber: "0135",
          weightKg: null,
          outerColours: "Pink",
          pinstripe: "No",
          flavor: "Raspberry",
          textColour: "White",
          heartColour: null,
          packaging: "1 x Bag 100g",
          labels: "No",
          labelImageUrl: null,
          ingredientLabels: "No",
        },
      ],
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('src="cid:candy-design-0@roccandy"'),
        attachments: [
          expect.objectContaining({
            filename: "candy-design-1.png",
            contentType: "image/png",
            cid: "candy-design-0@roccandy",
            contentDisposition: "inline",
          }),
        ],
      }),
    );
  });

  it("uses the saved public designer preview instead of a regenerated attachment", async () => {
    const previewUrl = "https://storage.example.com/email-previews/order-0135.png";

    await sendCustomerOrderSummaryEmail(["customer@example.com"], {
      orderNumber: "0135",
      dateOrderedIso: "2026-08-10T00:00:00.000Z",
      customerName: "Customer",
      customerEmail: "customer@example.com",
      customerPhone: null,
      requestedDate: null,
      deliveryAddress: "Pickup",
      paymentMethod: "Square invoice",
      paymentAmount: 100,
      items: [{ title: "Custom candy", quantity: 1, flavor: "Raspberry", labelsCount: null, totalPrice: 100 }],
      customDetails: null,
      customDetailsList: [
        {
          imageUrl: previewUrl,
          imageDataUrl: "data:image/png;base64,AAAA",
          fallbackImageUrl: "https://roccandy.com.au/api/preview/candy-image",
          orderNumber: "0135",
          weightKg: null,
          outerColours: "Pink",
          pinstripe: "No",
          flavor: "Raspberry",
          textColour: "White",
          heartColour: null,
          packaging: "1 x Bag 100g",
          labels: "No",
          labelImageUrl: null,
          ingredientLabels: "No",
        },
      ],
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining(`src="${previewUrl}"`),
        attachments: undefined,
      }),
    );
  });
});
