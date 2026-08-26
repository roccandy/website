import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckoutOrderPayload } from "@/lib/checkoutTypes";

const calculatePricing = vi.fn();
const buildCustomPricingInput = vi.fn();
const getSettings = vi.fn();
const getQuoteBlocks = vi.fn();
const getPackagingOptions = vi.fn();
const getFlavors = vi.fn();
const from = vi.fn();

let premadeRows: Array<{
  id: string;
  name: string;
  price: number;
  weight_g: number;
  description: string;
  flavors?: string[] | null;
}> = [];

vi.mock("@/lib/pricing", () => ({
  buildCustomPricingInput,
  calculatePricing,
}));

vi.mock("@/lib/data", () => ({
  getSettings,
  getQuoteBlocks,
  getPackagingOptions,
  getFlavors,
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
  flavor: "Lemon",
  designType: "text",
  designText: title,
});

const buildOrder = (input: Partial<CheckoutOrderPayload>): CheckoutOrderPayload => ({
  dueDate: "2099-05-20",
  pickup: false,
  customer,
  customItems: [],
  premadeItems: [],
  ...input,
});

describe("buildCheckoutOrderContext", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    premadeRows = [];

    buildCustomPricingInput.mockReturnValue({ categoryId: "custom-1-6" });
    calculatePricing.mockResolvedValue({ total: 100, totalWeightKg: 1 });
    getSettings.mockResolvedValue({ max_total_kg: 100 });
    getQuoteBlocks.mockResolvedValue([]);
    getPackagingOptions.mockResolvedValue([
      {
        id: "pack-1",
        allowed_categories: ["custom-1-6"],
        lid_colors: [],
        label_type_ids: ["label-1"],
      },
    ]);
    getFlavors.mockResolvedValue([{ name: "Lemon", is_active: true }]);
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
    const { buildCheckoutOrderContext } = await import("@/lib/checkoutOrder");

    const context = await buildCheckoutOrderContext(
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
        description: "Premade",
      },
    ];
    const { buildCheckoutOrderContext } = await import("@/lib/checkoutOrder");

    const context = await buildCheckoutOrderContext(
      buildOrder({
        customItems: [customItem("ONE")],
        premadeItems: [{ premadeId: "premade-1", quantity: 2 }],
      })
    );

    expect(context.orderPayloads.map((payload) => payload.order_number)).toEqual(["0008-a", "0008-b"]);
  });

  it("keeps different premade products under one order number", async () => {
    premadeRows = [
      {
        id: "passionfruit",
        name: "Passionfruit",
        price: 43,
        weight_g: 100,
        description: "Passionfruit premade candy",
        flavors: ["Passionfruit"],
      },
      {
        id: "watermelon",
        name: "Watermelon",
        price: 43,
        weight_g: 100,
        description: "Watermelon premade candy",
        flavors: ["Watermelon"],
      },
    ];
    const { buildCheckoutOrderContext } = await import("@/lib/checkoutOrder");

    const context = await buildCheckoutOrderContext(
      buildOrder({
        customItems: [],
        premadeItems: [
          { premadeId: "passionfruit", quantity: 1 },
          { premadeId: "watermelon", quantity: 1 },
        ],
      }),
    );

    expect(context.orderPayloads.map((payload) => payload.order_number)).toEqual(["0008", "0008"]);
    expect(context.orderPayloads.map((payload) => payload.title)).toEqual(["Passionfruit", "Watermelon"]);
    expect(context.orderPayloads.map((payload) => payload.flavor)).toEqual(["Passionfruit", "Watermelon"]);
    expect(context.totalAmount).toBe(86);
  });

  it("allows multiple order lines when each line stays under the weight cap", async () => {
    premadeRows = [
      {
        id: "premade-1",
        name: "Premade Candy",
        price: 12,
        weight_g: 200,
        description: "Premade",
      },
    ];
    calculatePricing.mockResolvedValue({ total: 100, totalWeightKg: 8.1 });
    getSettings.mockResolvedValue({ max_total_kg: 8.2 });

    const { buildCheckoutOrderContext } = await import("@/lib/checkoutOrder");

    const context = await buildCheckoutOrderContext(
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
        description: "Premade",
      },
    ];
    getSettings.mockResolvedValue({ max_total_kg: 8.2 });
    const { buildCheckoutOrderContext } = await import("@/lib/checkoutOrder");

    await expect(
      buildCheckoutOrderContext(
        buildOrder({
          customItems: [],
          premadeItems: [{ premadeId: "premade-1", quantity: 1 }],
        })
      )
    ).rejects.toThrow("Max total kg is 8.2.");
  });

  it("rejects premade-only checkout without a requested date", async () => {
    premadeRows = [
      {
        id: "premade-1",
        name: "Premade Candy",
        price: 12,
        weight_g: 200,
        description: "Premade",
      },
    ];
    const { buildCheckoutOrderContext } = await import("@/lib/checkoutOrder");

    await expect(
      buildCheckoutOrderContext(
        buildOrder({
          customItems: [],
          premadeItems: [{ premadeId: "premade-1", quantity: 1 }],
          dueDate: undefined,
        })
      )
    ).rejects.toThrow("Requested date is required.");
  });

  it("assigns premade orders after multiple custom order suffixes", async () => {
    premadeRows = [
      {
        id: "premade-1",
        name: "Premade Candy",
        price: 12,
        weight_g: 100,
        description: "Premade",
      },
    ];
    const { buildCheckoutOrderContext } = await import("@/lib/checkoutOrder");

    const context = await buildCheckoutOrderContext(
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

  it("rejects custom label artwork with a zero label count", async () => {
    const { buildCheckoutOrderContext } = await import("@/lib/checkoutOrder");

    await expect(
      buildCheckoutOrderContext(
        buildOrder({
          customItems: [
            {
              ...customItem("ONE"),
              labelsCount: 0,
              labelTypeId: "label-1",
              labelImageUrl: "https://cdn.test/label.png",
            },
          ],
        })
      )
    ).rejects.toThrow("Custom label count must be at least 1");
  });

  it("does not persist a second jacket colour for a single-colour jacket", async () => {
    const { buildCheckoutOrderContext } = await import("@/lib/checkoutOrder");

    const context = await buildCheckoutOrderContext(
      buildOrder({
        customItems: [
          {
            ...customItem("ONE"),
            jacket: "pinstripe",
            jacketColorOne: "#ff0000",
            jacketColorTwo: "#ffffff",
          },
        ],
      })
    );

    expect(context.orderPayloads[0]?.jacket_color_two).toBeNull();
  });

  it("rejects a past requested date and fractional quantities", async () => {
    const { buildCheckoutOrderContext } = await import("@/lib/checkoutOrder");

    await expect(
      buildCheckoutOrderContext(buildOrder({ dueDate: "2020-01-01", customItems: [customItem("ONE")] })),
    ).rejects.toThrow("Requested date must be after today");

    await expect(
      buildCheckoutOrderContext(buildOrder({ customItems: [customItem("ONE", 1.5)] })),
    ).rejects.toThrow("Custom item quantity must be a whole number");
  });

  it("rejects zero-count ingredient labels and retired custom selections", async () => {
    const { buildCheckoutOrderContext } = await import("@/lib/checkoutOrder");

    await expect(
      buildCheckoutOrderContext(
        buildOrder({
          customItems: [{ ...customItem("ONE"), ingredientLabelsOptIn: true, ingredientLabelsCount: 0 }],
        }),
      ),
    ).rejects.toThrow("Ingredient label count must be at least 1");

    await expect(
      buildCheckoutOrderContext(
        buildOrder({ customItems: [{ ...customItem("ONE"), flavor: "Retired flavour" }] }),
      ),
    ).rejects.toThrow("Selected flavor is no longer available");
  });

  it("rejects a disabled packaging option at checkout", async () => {
    getPackagingOptions.mockResolvedValue([
      {
        id: "pack-1",
        is_active: false,
        allowed_categories: ["custom-1-6"],
        lid_colors: [],
        label_type_ids: ["label-1"],
      },
    ]);
    const { buildCheckoutOrderContext } = await import("@/lib/checkoutOrder");

    await expect(
      buildCheckoutOrderContext(buildOrder({ customItems: [customItem("ONE")] })),
    ).rejects.toThrow("Custom packaging is no longer available");
  });
});
