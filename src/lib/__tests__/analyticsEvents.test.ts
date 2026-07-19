import { afterEach, describe, expect, it, vi } from "vitest";

type WindowStub = {
  dataLayer: unknown[];
  sessionStorage: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
  };
};

function stubWindow() {
  const storage = new Map<string, string>();
  const windowStub: WindowStub = {
    dataLayer: [],
    sessionStorage: {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
    },
  };
  vi.stubGlobal("window", windowStub);
  return windowStub;
}

describe("analyticsEvents", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clears ecommerce before pushing standard GA4 ecommerce events", async () => {
    const windowStub = stubWindow();
    const { trackAddToCart } = await import("@/lib/analyticsEvents");

    trackAddToCart({
      currency: "AUD",
      value: 12,
      items: [
        {
          item_id: "premade-1",
          item_name: "Premade Candy",
          price: 12,
          quantity: 1,
        },
      ],
    });

    expect(windowStub.dataLayer).toEqual([
      { ecommerce: null },
      {
        event: "add_to_cart",
        ecommerce: {
          currency: "AUD",
          value: 12,
          items: [
            {
              item_id: "premade-1",
              item_name: "Premade Candy",
              price: 12,
              quantity: 1,
            },
          ],
        },
      },
    ]);
  });

  it("creates the data layer so events are queued before GTM finishes loading", async () => {
    const windowStub = stubWindow();
    delete (windowStub as Partial<WindowStub>).dataLayer;
    const { trackBeginCheckout } = await import("@/lib/analyticsEvents");

    trackBeginCheckout({
      currency: "AUD",
      value: 43,
      items: [{ item_id: "premade-1", item_name: "Premade Candy", price: 43, quantity: 1 }],
    });

    expect(windowStub.dataLayer).toEqual([
      { ecommerce: null },
      {
        event: "begin_checkout",
        ecommerce: {
          currency: "AUD",
          value: 43,
          items: [{ item_id: "premade-1", item_name: "Premade Candy", price: 43, quantity: 1 }],
        },
      },
    ]);
  });

  it("pushes purchase once with transaction id, GST, shipping, and rounded item values", async () => {
    const windowStub = stubWindow();
    const { trackPurchaseOnce } = await import("@/lib/analyticsEvents");

    const payload = {
      transactionId: "000123-txn_123",
      currency: "AUD",
      value: 149.499,
      tax: 13.5901,
      shipping: 0,
      items: [
        {
          item_id: "custom",
          item_name: "Custom candy order",
          price: 149.499,
          quantity: 1,
        },
      ],
    };

    trackPurchaseOnce(payload);
    trackPurchaseOnce(payload);

    expect(windowStub.dataLayer).toEqual([
      { ecommerce: null },
      {
        event: "purchase",
        ecommerce: {
          transaction_id: "000123-txn_123",
          currency: "AUD",
          value: 149.5,
          tax: 13.59,
          shipping: 0,
          items: [
            {
              item_id: "custom",
              item_name: "Custom candy order",
              price: 149.5,
              quantity: 1,
            },
          ],
        },
      },
    ]);
  });

  it("pushes lead events without customer-identifying information", async () => {
    const windowStub = stubWindow();
    const { trackEnquiryFormStart, trackGenerateLead } = await import("@/lib/analyticsEvents");

    trackEnquiryFormStart({ leadType: "wedding", sourcePage: "/contact" });
    trackGenerateLead({ leadType: "wedding", sourcePage: "/contact" });

    expect(windowStub.dataLayer).toEqual([
      {
        event: "enquiry_form_start",
        lead_type: "wedding",
        source_page: "/contact",
      },
      {
        event: "generate_lead",
        lead_type: "wedding",
        source_page: "/contact",
      },
    ]);
  });
});
