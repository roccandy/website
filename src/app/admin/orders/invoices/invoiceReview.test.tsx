import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  order: {} as Record<string, unknown>,
  canWrite: true,
}));
vi.mock("next-auth", () => ({
  getServerSession: async () => ({ user: { canWrite: mocks.canWrite } }),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdminClient: {
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: mocks.order }),
        then: (resolve: (value: unknown) => void) =>
          resolve({ data: [mocks.order] }),
      };
      return query;
    },
  },
}));
vi.mock("@/lib/adminOrderIntegrations", () => ({
  defaultAdminSquareInvoiceTitle: () => "Test invoice",
}));
vi.mock("../../AdminNavigationFeedback", () => ({
  AdminLink: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("../actions", () => ({ sendAdminSquareInvoice: vi.fn() }));
vi.mock("../OrderPaymentConfirmation", () => ({
  OrderPaymentConfirmation: () => <button>Record payment received</button>,
}));
vi.mock("../[id]/invoice/SendInvoiceButton", () => ({
  SendInvoiceButton: ({ delivery }: { delivery: string }) => (
    <button>{delivery === "pdf" ? "Send PDF" : "Send invoice"}</button>
  ),
}));
import AdminInvoiceReviewPage from "../[id]/invoice/page";
beforeEach(() => {
  mocks.canWrite = true;
  mocks.order = {
    id: "order",
    order_number: "100",
    design_type: "branded",
    status: "pending",
    created_at: "2026-10-01T00:00:00Z",
    total_price: 110,
    square_invoice_id: "invoice",
    square_invoice_status: "DRAFT",
    payment_provider: "square_invoice",
    customer_name: "Test customer",
    customer_email: "test@example.test",
  };
});
const render = async (edit?: string) =>
  renderToStaticMarkup(
    await AdminInvoiceReviewPage({
      params: { id: "order" },
      searchParams: { edit },
    }),
  );
it("opens drafts as a readable summary with an explicit review/send step", async () => {
  const html = await render();
  expect(html).toContain("Invoice summary");
  expect(html).toContain("Review &amp; send draft");
  expect(html).not.toContain('name="customer_email"');
});
it("keeps the original send form available for an eligible draft", async () => {
  const html = await render("1");
  expect(html).toContain('name="customer_email"');
  expect(html).toContain("Send PDF");
  expect(html).toContain("Send invoice");
  expect(html).toContain("Cancel editing");
});
it.each(["PAID", "UNPAID", "PARTIALLY_PAID", "PAYMENT_PENDING", "CANCELED"])(
  "does not expose draft editing for %s",
  async (state) => {
    mocks.order.square_invoice_status = state;
    const html = await render("1");
    expect(html).toContain("Invoice summary");
    expect(html).not.toContain('name="customer_email"');
    expect(html).not.toContain("Send PDF");
  },
);
it("recognises a sent PDF and offers verified bank-payment recording, not resending", async () => {
  mocks.order.square_invoice_sent_at = "2026-10-02";
  mocks.order.payment_method = "Direct deposit";
  const html = await render("1");
  expect(html).toContain("Record payment received");
  expect(html).not.toContain("Send PDF");
});
it("prevents read-only viewers from opening send or recording-payment controls", async () => {
  mocks.canWrite = false;
  const html = await render("1");
  expect(html).not.toContain('name="customer_email"');
  expect(html).not.toContain("Review &amp; send draft");
});
