import { describe, expect, it } from "vitest";
import { orderSource } from "./orderSource";
import type { OrderRow } from "@/lib/data";
const row = (changes: Partial<OrderRow>) =>
  ({ id: "order", design_type: "branded", ...changes }) as OrderRow;
describe("Production source badges", () => {
  it.each(["square", "paypal", "woocommerce"])(
    "labels %s checkout as website",
    (provider) =>
      expect(orderSource(row({ payment_provider: provider })).label).toBe(
        "Website order",
      ),
  );
  it("links invoice orders directly to their invoice", () =>
    expect(orderSource(row({ square_invoice_id: "inv" })).invoiceHref).toBe(
      "/admin/orders/order/invoice",
    ));
  it("does not invent a web source for legacy records", () =>
    expect(orderSource(row({})).label).toBe("Manual / legacy"));
});
