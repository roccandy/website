import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMail } = vi.hoisted(() => ({
  sendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail })),
  },
}));

import { sendCustomerOrderSummaryEmail } from "@/lib/email";
import sharp from "sharp";

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

  afterEach(() => {
    vi.unstubAllGlobals();
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
        subject: "Roc Candy Tax Invoice #0135",
        html: expect.stringMatching(/Tax Invoice #0135[\s\S]*src="cid:candy-design-0@roccandy"/),
        attachments: expect.arrayContaining([
          expect.objectContaining({
            filename: "roc-candy-logo.png",
            contentType: "image/png",
            cid: "roc-candy-logo@roccandy",
            contentDisposition: "inline",
          }),
          expect.objectContaining({
            filename: "candy-design-1.png",
            contentType: "image/png",
            cid: "candy-design-0@roccandy",
            contentDisposition: "inline",
          }),
        ]),
      }),
    );
  });

  it("embeds the saved public designer preview instead of leaving it as a remote image", async () => {
    const previewUrl = "https://storage.example.com/email-previews/order-0135.png";
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="#ff5f99"/></svg>';
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(svg, { headers: { "content-type": "image/svg+xml" } })));

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
          imageDataUrl: null,
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
        html: expect.stringContaining('src="cid:candy-design-0@roccandy"'),
        attachments: expect.arrayContaining([
          expect.objectContaining({
            filename: "roc-candy-logo.png",
            cid: "roc-candy-logo@roccandy",
          }),
          expect.objectContaining({
            filename: "candy-design-1.png",
            cid: "candy-design-0@roccandy",
          }),
        ]),
      }),
    );
  });

  it("renders the tax invoice company header and removes the launch feedback note", async () => {
    await sendCustomerOrderSummaryEmail(["customer@example.com"], {
      orderNumber: "0165",
      dateOrderedIso: "2026-08-19T00:00:00.000Z",
      customerName: "Customer",
      customerEmail: "customer@example.com",
      customerPhone: null,
      requestedDate: null,
      deliveryAddress: "Pickup",
      paymentMethod: "Card",
      paymentAmount: 110,
      items: [{ title: "Custom candy", quantity: 1, flavor: null, labelsCount: null, totalPrice: 110 }],
      customDetails: null,
      customDetailsList: [],
    });

    const message = sendMail.mock.calls[0]?.[0];
    expect(message?.html).toContain("Roc Candy Pty Ltd");
    expect(message?.html).toContain("admin@roccandy.com.au");
    expect(message?.html).toContain("0411 810 538");
    expect(message?.html).toContain("ABN 61 076 609 035");
    expect(message?.html).toContain("Tax Invoice #0165");
    expect(message?.html).toContain("Subtotal (ex GST)");
    expect(message?.html).toContain("Total paid");
    expect(message?.html).not.toContain("Our website is new");
    expect(message?.text).not.toContain("Our website is new");
  });

  it("stacks the candy preview above details and constrains uploaded label artwork", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#ffd54f"/></svg>';
    const imageDataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    await sendCustomerOrderSummaryEmail(["customer@example.com"], {
      orderNumber: "0167",
      dateOrderedIso: "2026-08-19T00:00:00.000Z",
      customerName: "Customer",
      customerEmail: "customer@example.com",
      customerPhone: null,
      requestedDate: null,
      deliveryAddress: "Pickup",
      paymentMethod: "Card",
      paymentAmount: 110,
      items: [{ title: "Custom candy", quantity: 1, flavor: null, labelsCount: 1, totalPrice: 110 }],
      customDetails: null,
      customDetailsList: [{
        imageUrl: null,
        imageDataUrl,
        fallbackImageUrl: null,
        orderNumber: "0167",
        weightKg: null,
        outerColours: "Yellow",
        pinstripe: "No",
        flavor: null,
        textColour: "Black",
        heartColour: null,
        packaging: "1 x Jar",
        labels: "Circle 35mm",
        labelImageUrl: imageDataUrl,
        ingredientLabels: "No",
      }],
    });

    const message = sendMail.mock.calls[0]?.[0];
    const html = String(message?.html);
    expect(html.indexOf('src="cid:candy-design-0@roccandy"')).toBeLessThan(html.indexOf("Candy design"));
    expect(html).toContain('width="72"');
    expect(html).toContain("max-width:72px");
    expect(html).toContain("background:#ffffff");
    expect(html).not.toContain('class="rc-card" style="width:100%;border-collapse:separate');

    const labelAttachment = message?.attachments?.find((attachment: { cid?: string }) => attachment.cid === "label-design-0@roccandy");
    const metadata = await sharp(labelAttachment?.content as Buffer).metadata();
    expect(metadata.width).toBeLessThanOrEqual(144);
    expect(metadata.height).toBeLessThanOrEqual(144);
  });
});
