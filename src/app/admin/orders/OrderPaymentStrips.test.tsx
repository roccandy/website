import type { AnchorHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { OrderRow } from "@/lib/data";
import { OrderPaymentStrips } from "./OrderPaymentStrips";

vi.mock("../AdminNavigationFeedback", () => ({ AdminLink: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
const row = (values: Partial<OrderRow>) => ({ id: "order", order_number: "100", design_type: "branded", ...values }) as OrderRow;

describe("all-orders payment strips", () => {
  it("uses the same paid, unpaid, website and internal-stock colours as production", () => {
    for (const [order, colour] of [
      [row({ square_invoice_id: "invoice", paid_at: "2026-10-01" }), "bg-emerald-500"],
      [row({ square_invoice_id: "invoice" }), "bg-red-500"],
      [row({ payment_provider: "paypal", paid_at: "2026-10-01" }), "bg-blue-500"],
      [row({ design_type: "premade", notes: "[admin-premade-stock]" }), "bg-zinc-300"],
    ] as const) expect(renderToStaticMarkup(<OrderPaymentStrips orders={[order]}/>)).toContain(colour);
  });
  it("does not misrepresent a mixed group as all paid", () => {
    const html = renderToStaticMarkup(<OrderPaymentStrips orders={[
      row({ id: "paid", order_number: "100-a", square_invoice_id: "one", paid_at: "2026-10-01" }),
      row({ id: "unpaid", order_number: "100-b", square_invoice_id: "two" }),
    ]}/>);
    expect(html).toContain("bg-emerald-500");
    expect(html).toContain("bg-red-500");
    expect(html).toContain('href="/admin/orders/paid/invoice"');
    expect(html).toContain('href="/admin/orders/unpaid/invoice"');
    expect(html).toContain("#100-a · Invoice order · paid");
    expect(html).toContain("#100-b · Invoice order · payment not recorded");
  });
  it("links website strips to the order summary, with an accessible label", () => {
    const html = renderToStaticMarkup(<OrderPaymentStrips orders={[row({ payment_provider: "square" })]}/>);
    expect(html).toContain('href="/admin/orders/order"');
    expect(html).toContain('aria-label="#100 · Website order"');
  });
  it("renders one continuous invoice link for matching split items", () => {
    const html = renderToStaticMarkup(<OrderPaymentStrips orders={[
      row({ id: "a", order_number: "100-a", square_invoice_id: "same", paid_at: "2026-10-01" }),
      row({ id: "b", order_number: "100-b", square_invoice_id: "same", paid_at: "2026-10-01" }),
    ]}/>);
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain("#100-a, #100-b · Invoice order · paid");
    expect(html).toContain('href="/admin/orders/a/invoice"');
  });
});
