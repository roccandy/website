import { describe, expect, it } from "vitest";
import type { OrderRow } from "@/lib/data";
import {
  compactKg,
  productionPaymentStrip,
  requiredDateUrgency,
} from "./productionRowPresentation";
const row = (values: Partial<OrderRow> = {}) =>
  ({ id: "order", design_type: "branded", ...values }) as OrderRow;
describe("Compact production rows", () => {
  it("uses red for past required dates, orange for today/under seven days, grey otherwise", () => {
    expect(requiredDateUrgency("2026-10-23", "2026-10-24")).toEqual({
      days: -1,
      label: "1 day ago",
      tone: "text-red-600",
    });
    expect(requiredDateUrgency("2026-10-24", "2026-10-24")?.tone).toBe(
      "text-orange-600",
    );
    expect(requiredDateUrgency("2026-10-30", "2026-10-24")?.tone).toBe(
      "text-orange-600",
    );
    expect(requiredDateUrgency("2026-10-31", "2026-10-24")?.tone).toBe(
      "text-zinc-400",
    );
    expect(requiredDateUrgency(null, "2026-10-24")).toBeNull();
  });
  it("shows equal and unequal planned batch sizes in kg without concealing the split", () => {
    expect(
      compactKg(
        row({ total_weight_kg: 24, admin_batch_weights_kg: [8, 8, 8] }),
      ),
    ).toBe("3 × 8");
    expect(
      compactKg(
        row({ total_weight_kg: 20, admin_batch_weights_kg: [8, 8, 4] }),
      ),
    ).toBe("2 × 8 + 4");
    expect(compactKg(row({ total_weight_kg: 2.5 }))).toBe("2.5");
  });
  it("makes website orders blue even if paid and links to order details", () => {
    const result = productionPaymentStrip(
      row({ payment_provider: "square", paid_at: "2026-10-01" }),
    );
    expect(result.colour).toBe("bg-blue-500");
    expect(result.label).toBe("Website order");
    expect(result.href).toBe("/admin/orders/order");
  });
  it("links paid/unpaid invoice strips to invoice details without text banners", () => {
    expect(
      productionPaymentStrip(
        row({ square_invoice_id: "invoice", paid_at: "2026-10-01" }),
      ).colour,
    ).toBe("bg-emerald-500");
    const result = productionPaymentStrip(
      row({ square_invoice_id: "invoice" }),
    );
    expect(result.colour).toBe("bg-red-500");
    expect(result.href).toBe("/admin/orders/order/invoice");
  });
  it("does not falsely label internal stock as unpaid", () => {
    const result = productionPaymentStrip(
      row({ design_type: "premade", notes: "[admin-premade-stock]" }),
    );
    expect(result.colour).toBe("bg-zinc-300");
    expect(result.label).toBe("Internal stock");
  });
});
