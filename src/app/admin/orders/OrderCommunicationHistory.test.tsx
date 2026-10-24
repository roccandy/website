import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ history: vi.fn() }));
vi.mock("@/lib/emailArchive", () => ({ getOrderEmailHistory: mocks.history }));
vi.mock("../AdminNavigationFeedback", () => ({
  AdminLink: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));
import { OrderCommunicationHistory } from "./OrderCommunicationHistory";
const order = {
  id: "order",
  order_number: "100",
  square_invoice_id: null,
  square_invoice_sent_at: null,
};
beforeEach(() =>
  mocks.history.mockResolvedValue({ available: true, emails: [] }),
);
it("never fabricates historical emails when the archive is empty", async () => {
  const html = renderToStaticMarkup(await OrderCommunicationHistory({ order }));
  expect(html).toContain("Historical emails have not been reconstructed");
  expect(html).not.toContain("View original email");
});
it("distinguishes failed history loading from an empty archive", async () => {
  mocks.history.mockResolvedValue({ available: false, emails: [] });
  const html = renderToStaticMarkup(await OrderCommunicationHistory({ order }));
  expect(html).toContain("temporarily unavailable");
  expect(html).not.toContain("No archived customer emails");
});
it("links the saved combined message and original PDF without rebuilding them", async () => {
  mocks.history.mockResolvedValue({
    available: true,
    emails: [
      {
        id: "original",
        kind: "invoice-pdf",
        subject: "Original invoice title",
        created_at: "2026-10-24T00:00:00Z",
        to_addresses: ["customer@example.test"],
        order_numbers: ["100-a", "100-b"],
        status: "accepted",
        attachments: [{ contentType: "application/pdf" }],
      },
    ],
  });
  const html = renderToStaticMarkup(await OrderCommunicationHistory({ order }));
  expect(html).toContain("/admin/emails/original");
  expect(html).toContain("/api/admin/emails/original/attachment/0?inline=1");
  expect(html).toContain("Combined message");
  expect(html).toContain("#100-a, #100-b");
  expect(html).toContain("Accepted by mail server");
});
it("labels an uncaptured invoice send instead of pretending it has the Square original", async () => {
  const html = renderToStaticMarkup(
    await OrderCommunicationHistory({
      order: {
        ...order,
        square_invoice_id: "square",
        square_invoice_sent_at: "2026-10-24",
      },
    }),
  );
  expect(html).toContain("its original email is not in this archive");
});
