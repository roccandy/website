import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckoutOrderPayload } from "@/lib/checkoutTypes";

const calculatePricing = vi.fn();
const buildCustomPricingInput = vi.fn();
const getSettings = vi.fn();
const getQuoteBlocks = vi.fn();
const from = vi.fn();

let premadeRows: Array<{
  id: string;
  name: string;
  price: number;
  weight_g: number;
  woo_product_id: string | null;
  description: string;
}> = [];

vi.mock("@/lib/pricing", () => ({
  buildCustomPricingInput,
  calculatePricing,
}));

vi.mock("@/lib/data", () => ({
  getSettings,
  getQuoteBlocks,
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdminClient: {
    from,
  },
}));

const customer = {
  firstName: "Test",
  lastName: "Customer",
  email: "customer@example.com",
  phone: "0400000000",
  addressLine1: "1 Test Street",
  suburb: "Perth",
  postcode: "6000",
  state: "WA",
};

const customItem = (title: string, quantity = 10) => ({
  title,
  categoryId: "custom-1-6",
  packagingOptionId: "pack-1",
  quantity,
  designType: "text",
  designText: title,
});

const buildOrder = (input: Partial<CheckoutOrderPayload>): CheckoutOrderPayload => ({
  dueDate: "2026-05-20",
  pickup: false,
  customer,
  customItems: [],
  premadeItems: [],
  ...input,
});

describe("buildWooOrderContext", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.WOO_CUSTOM_PRODUCT_ID = "999";
    premadeRows = [];

    buildCustomPricingInput.mockReturnValue({ categoryId: "custom-1-6" });
    calculatePricing.mockResolvedValue({ total: 100, totalWeightKg: 1 });
    getSettings.mockResolvedValue({ max_total_kg: 100 });
    getQuoteBlocks.mockResolvedValue([]);
    from.mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn().mockResolvedValue({
            data: [{ order_number: "0007" }],
            error: null,
          }),
        };
      }
      if (table === "premade_candies") {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({
              data: premadeRows,
              error: null,
            }),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
  });

  it("splits multiple custom orders under the same base order number", async () => {
    const { buildWooOrderContext } = await import("@/lib/checkoutOrder");

    const context = await buildWooOrderContext(
      buildOrder({
        customItems: [customItem("ONE"), customItem("TWO")],
      })
    );

    expect(context.orderNumbers.baseOrderNumber).toBe("0008");
    expect(context.orderNumbers.customOrderNumbers).toEqual(["0008-a", "0008-b"]);
    expect(context.orderPayloads.map((payload) => payload.order_number)).toEqual(["0008-a", "0008-b"]);
  });

  it("preserves custom plus premade a/b split behavior", async () => {
    premadeRows = [
      {
        id: "premade-1",
        name: "Premade Candy",
        price: 12,
        weight_g: 100,
        woo_product_id: "123",
        description: "Premade",
      },
    ];
    const { buildWooOrderContext } = await import("@/lib/checkoutOrder");

    const context = await buildWooOrderContext(
      buildOrder({
        customItems: [customItem("ONE")],
        premadeItems: [{ premadeId: "premade-1", quantity: 2 }],
      })
    );

    expect(context.orderPayloads.map((payload) => payload.order_number)).toEqual(["0008-a", "0008-b"]);
  });

  it("allows multiple order lines when each line stays under the weight cap", async () => {
    premadeRows = [
      {
        id: "premade-1",
        name: "Premade Candy",
        price: 12,
        weight_g: 200,
        woo_product_id: "123",
        description: "Premade",
      },
    ];
    calculatePricing.mockResolvedValue({ total: 100, totalWeightKg: 8.1 });
    getSettings.mockResolvedValue({ max_total_kg: 8.2 });

    const { buildWooOrderContext } = await import("@/lib/checkoutOrder");

    const context = await buildWooOrderContext(
      buildOrder({
        customItems: [customItem("ONE")],
        premadeItems: [{ premadeId: "premade-1", quantity: 1 }],
      })
    );

    expect(context.orderNumbers.customOrderNumbers).toEqual(["0008-a"]);
    expect(context.orderPayloads.map((payload) => payload.order_number)).toEqual(["0008-a", "0008-b"]);
  });

  it("rejects a premade line that exceeds the weight cap on its own", async () => {
    premadeRows = [
      {
        id: "premade-1",
        name: "Premade Candy",
        price: 12,
        weight_g: 9000,
        woo_product_id: "123",
        description: "Premade",
      },
    ];
    getSettings.mockResolvedValue({ max_total_kg: 8.2 });
    const { buildWooOrderContext } = await import("@/lib/checkoutOrder");

    await expect(
      buildWooOrderContext(
        buildOrder({
          customItems: [],
          premadeItems: [{ premadeId: "premade-1", quantity: 1 }],
          dueDate: undefined,
        })
      )
    ).rejects.toThrow("Max total kg is 8.2.");
  });

  it("assigns premade orders after multiple custom order suffixes", async () => {
    premadeRows = [
      {
        id: "premade-1",
        name: "Premade Candy",
        price: 12,
        weight_g: 100,
        woo_product_id: "123",
        description: "Premade",
      },
    ];
    const { buildWooOrderContext } = await import("@/lib/checkoutOrder");

    const context = await buildWooOrderContext(
      buildOrder({
        customItems: [customItem("ONE"), customItem("TWO")],
        premadeItems: [{ premadeId: "premade-1", quantity: 2 }],
      })
    );

    expect(context.orderPayloads.map((payload) => payload.order_number)).toEqual([
      "0008-a",
      "0008-b",
      "0008-c",
    ]);
  });
});
