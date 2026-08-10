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
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
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
});
