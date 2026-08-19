import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("admin Square invoice removal", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = {
      ...originalEnv,
      SQUARE_ACCESS_TOKEN: "square-token",
      SQUARE_LOCATION_ID: "square-location",
      SQUARE_API_BASE: "https://square.test",
      SQUARE_API_VERSION: "2026-05-20",
      NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
      SUPABASE_SERVICE_ROLE_KEY: "supabase-service-role-key",
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("sets a new invoice due date from the configured number of Perth calendar days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T20:00:00.000Z")); // 20 Aug in Perth
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ customer: { id: "customer_123" } }))
      .mockResolvedValueOnce(jsonResponse({ order: { id: "square_order_123" } }))
      .mockResolvedValueOnce(
        jsonResponse({ invoice: { id: "inv_123", version: 0, status: "DRAFT", created_at: "2026-08-19T20:00:00.000Z" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { createAdminSquareInvoiceDraft } = await import("@/lib/adminOrderIntegrations");
    await createAdminSquareInvoiceDraft({
      id: "order_123",
      order_number: "0165",
      title: "Custom candy order",
      customer_name: "Example Customer",
      customer_email: "customer@example.com",
      total_price: 110,
      invoiceDueDays: 7,
    } as never);

    const invoiceRequest = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));
    expect(invoiceRequest.invoice.payment_requests[0].due_date).toBe("2026-08-27");
  });

  it("calculates PDF due dates from the current Perth date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T20:00:00.000Z")); // 20 Aug in Perth
    const { adminInvoiceDueDateFromToday } = await import("@/lib/adminOrderIntegrations");

    expect(adminInvoiceDueDateFromToday(7)).toBe("2026-08-27");
  });

  it("cancels a sent invoice with Square's top-level version payload", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ invoice: { id: "inv_123", version: 7, status: "UNPAID" } }))
      .mockResolvedValueOnce(jsonResponse({ invoice: { id: "inv_123", version: 8, status: "CANCELED" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { removeAdminSquareInvoice } = await import("@/lib/adminOrderIntegrations");

    await expect(
      removeAdminSquareInvoice({
        id: "order_123",
        square_invoice_id: "inv_123",
        square_invoice_version: 6,
      }),
    ).resolves.toMatchObject({ action: "canceled", invoiceStatus: "CANCELED" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://square.test/v2/invoices/inv_123/cancel",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ version: 7 });
  });

  it("attaches a direct-deposit PDF to the Square draft without publishing it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ invoice: { id: "inv_123", version: 1, status: "DRAFT" } }))
      .mockResolvedValueOnce(jsonResponse({ invoice: { id: "inv_123", version: 2, status: "DRAFT" } }))
      .mockResolvedValueOnce(jsonResponse({ attachment: { id: "inva_123", filename: "tax-invoice.pdf" } }, 201))
      .mockResolvedValueOnce(jsonResponse({ invoice: { id: "inv_123", version: 3, status: "DRAFT" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { updateAdminSquareInvoiceDraftAndAttachPdf } = await import("@/lib/adminOrderIntegrations");

    await expect(
      updateAdminSquareInvoiceDraftAndAttachPdf(
        {
          id: "order_123",
          order_number: "RC-123",
          title: "Custom candy order",
          customer_name: "Example Customer",
          customer_email: "customer@example.com",
          due_date: "2026-08-25",
          square_invoice_id: "inv_123",
          square_invoice_version: 1,
        } as never,
        { filename: "tax-invoice.pdf", pdf: new Uint8Array([37, 80, 68, 70]) },
      ),
    ).resolves.toMatchObject({ invoiceStatus: "DRAFT", attachmentId: "inva_123" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://square.test/v2/invoices/inv_123/attachments",
      expect.objectContaining({ method: "POST" }),
    );
    const attachmentForm = fetchMock.mock.calls[2]?.[1]?.body as FormData;
    expect(JSON.parse(String(attachmentForm.get("request")))).toMatchObject({ description: "Roc Candy tax invoice" });
    expect(attachmentForm.get("file")).toMatchObject({ type: "application/pdf" });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).not.toHaveProperty("invoice.invoice_number");
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/publish"))).toBe(false);
  });

  it("publishes an emailed Square invoice with the customer recipient and hosted payment link", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ customer: { id: "customer_123" } }))
      .mockResolvedValueOnce(jsonResponse({ invoice: { id: "inv_123", version: 2, status: "DRAFT" } }))
      .mockResolvedValueOnce(jsonResponse({ invoice: { id: "inv_123", version: 3, status: "DRAFT" } }))
      .mockResolvedValueOnce(
        jsonResponse({
          invoice: {
            id: "inv_123",
            version: 4,
            status: "UNPAID",
            public_url: "https://square.test/invoice/inv_123",
            updated_at: "2026-08-14T03:36:45.000Z",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { updateAndPublishAdminSquareInvoice } = await import("@/lib/adminOrderIntegrations");

    await expect(
      updateAndPublishAdminSquareInvoice({
        id: "order_123",
        order_number: "0151",
        title: "Custom candy order",
        customer_name: "Example Customer",
        customer_email: "customer@example.com",
        due_date: "2026-08-25",
        total_price: 110,
        square_customer_id: "customer_123",
        square_invoice_id: "inv_123",
        square_invoice_version: 1,
      } as never),
    ).resolves.toMatchObject({
      invoiceStatus: "UNPAID",
      invoiceUrl: "https://square.test/invoice/inv_123",
      invoiceSentAt: "2026-08-14T03:36:45.000Z",
    });

    const invoiceUpdate = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));
    expect(invoiceUpdate.invoice).toMatchObject({
      delivery_method: "EMAIL",
      primary_recipient: { customer_id: "customer_123" },
      accepted_payment_methods: { card: true, square_gift_card: false, bank_account: false, buy_now_pay_later: false },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://square.test/v2/invoices/inv_123/publish",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
