import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyCandyDesign } from "@/lib/candyDesign";
const { order } = vi.hoisted(() => ({
  order: { current: {} as Record<string, unknown> },
}));
vi.mock("next-auth", () => ({
  getServerSession: async () => ({ user: { role: "admin" } }),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdminClient: {
    from: (table: string) => ({
      select: () => {
        if (table === "orders")
          return {
            eq: () => ({
              maybeSingle: async () => ({ data: order.current, error: null }),
            }),
          };
        if (table === "order_slots")
          return { eq: async () => ({ data: [], error: null }) };
        return Promise.resolve({ data: [], error: null });
      },
    }),
  },
}));
import PrintOrderPage from "./page";
describe("production design printout", () => {
  it("prints the immutable design, layer settings and internal notes without a branded logo", async () => {
    const design = emptyCandyDesign("Special wedding mockup");
    design.layers[0].text = "ALICE & BOB";
    design.productionNotes = "Use a wider red jacket panel";
    design.jacket.mode = "segments";
    order.current = {
      id: "77777777-7777-4777-8777-777777777777",
      order_number: "test-print",
      candy_design: design,
      category_id: "weddings-both-names",
      total_weight_kg: 10,
      admin_batch_weights_kg: [10],
      quantity: 100,
      created_at: "2026-11-07T00:00:00Z",
      pickup: true,
    };
    const markup = renderToStaticMarkup(
      await PrintOrderPage({
        params: Promise.resolve({ id: String(order.current.id) }),
      }),
    );
    expect(markup).toContain("Special wedding mockup");
    expect(markup).toContain("Design specification");
    expect(markup).toContain("Custom segments");
    expect(markup).toContain("Site default (Helvetica / Arial)");
    expect(markup).toContain("position 50,50%");
    expect(markup).toContain("Use a wider red jacket panel");
    expect(markup).toContain("ALICE &amp; BOB");
  });
});
