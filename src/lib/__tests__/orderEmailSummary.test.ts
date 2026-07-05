import { beforeEach, describe, expect, it, vi } from "vitest";

const getColorPalette = vi.fn();
const getPackagingOptions = vi.fn();
const getLabelTypes = vi.fn();

vi.mock("@/lib/data", () => ({
  getColorPalette,
  getPackagingOptions,
  getLabelTypes,
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdminClient: {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
      })),
    },
  },
}));

describe("buildAdminOrderSummaryEmailPayload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.VERCEL_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.SITE_URL;

    getColorPalette.mockResolvedValue([
      { hex: "#ff0000", category: "red", shade: "main" },
      { hex: "#000000", category: "black", shade: "main" },
      { hex: "#ffffff", category: "white", shade: "main" },
    ]);
    getPackagingOptions.mockResolvedValue([
      { id: "pack-1", type: "bag", size: "100g" },
      { id: "pack-2", type: "jar", size: "250g" },
    ]);
    getLabelTypes.mockResolvedValue([{ id: "label-1", shape: "circle", dimensions: "30mm" }]);
  });

  it("builds separate custom detail blocks for multiple custom order rows", async () => {
    const { buildAdminOrderSummaryEmailPayload } = await import("@/lib/orderEmailSummary");

    const summary = await buildAdminOrderSummaryEmailPayload({
      orderPayloads: [
        {
          order_number: "0008-a",
          title: "ONE",
          quantity: 10,
          flavor: "Passionfruit",
          packaging_option_id: "pack-1",
          total_weight_kg: 1,
          total_price: 100,
          jacket_color_one: "#ff0000",
          text_color: "#000000",
          label_type_id: "label-1",
          ingredient_labels_count: 24,
          notes: "Ingredient labels requested.",
        },
        {
          order_number: "0008-b",
          title: "TWO",
          quantity: 4,
          flavor: "Lemon",
          packaging_option_id: "pack-2",
          total_weight_kg: 2,
          total_price: 150,
          jacket_color_one: "#ffffff",
          text_color: "#ff0000",
        },
      ],
      orderNumber: "0008",
      requestedDate: "2026-05-20",
      billing: {
        address_1: "1 Test Street",
        city: "Perth",
        state: "WA",
        postcode: "6000",
      },
      pickup: false,
      paymentMethod: "Credit Card",
      paymentAmount: 250,
      customPreviews: [
        { orderNumber: "0008-a", previewPngDataUrl: "data:image/png;base64,AAAA" },
        { orderNumber: "0008-b", previewPngDataUrl: "data:image/png;base64,BBBB" },
      ],
    });

    expect(summary.customDetailsList).toHaveLength(2);
    expect(summary.customDetailsList.map((detail) => detail.orderNumber)).toEqual(["0008-a", "0008-b"]);
    expect(summary.items.map((item) => item.flavor)).toEqual(["Passionfruit", "Lemon"]);
    expect(summary.customDetailsList.map((detail) => detail.flavor)).toEqual(["Passionfruit", "Lemon"]);
    expect(summary.customDetailsList.map((detail) => detail.packaging)).toEqual(["10 x Bag 100g", "4 x Jar 250g"]);
    expect(summary.customDetailsList.map((detail) => detail.ingredientLabels)).toEqual(["24", "No"]);
    expect(summary.customDetailsList.map((detail) => detail.imageDataUrl)).toEqual([
      "data:image/png;base64,AAAA",
      "data:image/png;base64,BBBB",
    ]);
    expect(summary.customDetails?.orderNumber).toBe("0008-a");
  });

  it("builds admin fallback candy previews with branded and wedding display inputs", async () => {
    process.env.SITE_URL = "https://roccandy.test";
    const { buildAdminOrderSummaryEmailPayload } = await import("@/lib/orderEmailSummary");

    const summary = await buildAdminOrderSummaryEmailPayload({
      orderPayloads: [
        {
          order_number: "0010",
          title: "Team logo",
          quantity: 50,
          packaging_option_id: "pack-1",
          total_weight_kg: 1,
          total_price: 100,
          category_id: "branded",
          design_type: "branded",
          logo_url: "https://cdn.test/logo.png",
          jacket_type: "two_colour_pinstripe",
          jacket_color_one: "#ff0000",
          jacket_color_two: "#ffffff",
        },
        {
          order_number: "0011",
          title: "Wedding",
          quantity: 10,
          packaging_option_id: "pack-2",
          total_weight_kg: 1,
          total_price: 80,
          category_id: "weddings-initials",
          design_type: "weddings-initials",
          design_text: "A + B",
          heart_color: "#ff0000",
        },
      ],
      orderNumber: "0010",
      requestedDate: "2026-05-20",
      billing: {},
      pickup: true,
      paymentMethod: "Square invoice",
      paymentAmount: 180,
    });

    const [brandedPreview, weddingPreview] = summary.customDetailsList.map((detail) => new URL(detail.imageUrl ?? ""));

    expect(brandedPreview.pathname).toBe("/api/preview/candy-image");
    expect(brandedPreview.searchParams.get("logoUrl")).toBe("https://cdn.test/logo.png");
    expect(brandedPreview.searchParams.get("mode")).toBe("two_colour");
    expect(brandedPreview.searchParams.get("showPinstripe")).toBe("1");
    expect(weddingPreview.searchParams.get("showHeart")).toBe("1");
    expect(weddingPreview.searchParams.get("isInitials")).toBe("1");
    expect(weddingPreview.searchParams.get("lineOne")).toBe("A");
    expect(weddingPreview.searchParams.get("lineTwo")).toBe("B");
  });

  it("does not prefer shell-only captured SVG previews for branded logo orders", async () => {
    process.env.SITE_URL = "https://roccandy.test";
    const { buildAdminOrderSummaryEmailPayload } = await import("@/lib/orderEmailSummary");

    const summary = await buildAdminOrderSummaryEmailPayload({
      orderPayloads: [
        {
          order_number: "0012",
          title: "Team logo",
          quantity: 50,
          packaging_option_id: "pack-1",
          total_weight_kg: 1,
          total_price: 100,
          category_id: "branded",
          design_type: "branded",
          logo_url: "https://cdn.test/logo.png",
          jacket_color_one: "#ff0000",
        },
      ],
      orderNumber: "0012",
      requestedDate: "2026-05-20",
      billing: {},
      pickup: true,
      paymentMethod: "Credit Card",
      paymentAmount: 100,
      customPreviews: [{ orderNumber: "0012", previewSvg: "<svg viewBox=\"0 0 10 10\"></svg>" }],
    });

    const brandedPreview = new URL(summary.customDetails?.imageUrl ?? "");

    expect(brandedPreview.pathname).toBe("/api/preview/candy-image");
    expect(brandedPreview.searchParams.get("logoUrl")).toBe("https://cdn.test/logo.png");
    expect(summary.customDetails?.imageDataUrl).toBeNull();
  });
});
