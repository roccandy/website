import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/emailArchive", () => ({
  getInvoiceOriginals: async () => new Map(),
}));
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  range: vi.fn(),
  fail: false,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdminClient: { from: mocks.from },
}));
import { getInvoices } from "./invoiceData";
beforeEach(() => {
  mocks.fail = false;
  mocks.range.mockClear();
  mocks.from.mockImplementation(() => ({
    select: () => ({
      lte: () => ({
        order: () => ({
          range: (from: number, to: number) => {
            mocks.range(from, to);
            return {
              error:
                mocks.fail && from > 0 ? { message: "Private detail" } : null,
              data: Array.from(
                { length: Math.max(0, Math.min(1001, to + 1) - from) },
                (_, index) => ({
                  id: String(from + index),
                  created_at: "2026-01-01",
                  status: "pending",
                  total_price: 10,
                  square_invoice_id: `invoice-${from + index}`,
                  square_invoice_status: "DRAFT",
                }),
              ),
            };
          },
        }),
      }),
    }),
  }));
});
it("paginates all invoices beyond the database row limit", async () => {
  expect((await getInvoices()).invoices).toHaveLength(1001);
  expect(mocks.range.mock.calls).toEqual([
    [0, 499],
    [500, 999],
    [1000, 1499],
  ]);
});
it("rejects incomplete invoice totals if a later page fails", async () => {
  mocks.fail = true;
  await expect(getInvoices()).rejects.toThrow(
    "Invoices could not be loaded. Refresh and try again.",
  );
});
