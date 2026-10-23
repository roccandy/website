import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  ranges: vi.fn(),
  failTable: "",
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdminClient: { from: mocks.from },
}));
import { getTodayHub } from "./todayData";

beforeEach(() => {
  mocks.failTable = "";
  mocks.ranges.mockClear();
  mocks.from.mockImplementation((table: string) => ({
    select: () => ({
      lte: () => ({
        order: () => ({
          range: (from: number, to: number) => {
            mocks.ranges(table, from, to);
            return {
              error:
                table === mocks.failTable
                  ? { message: "Private database detail" }
                  : null,
              data:
                table === "orders"
                  ? Array.from(
                      { length: Math.max(0, Math.min(1001, to + 1) - from) },
                      (_, index) => ({
                        id: `row-${from + index}`,
                        order_number: String(from + index),
                        status: "pending",
                        design_type: "premade",
                        paid_at: "2026-10-01T00:00:00Z",
                        total_weight_kg: 1,
                      }),
                    )
                  : [],
            };
          },
        }),
      }),
    }),
  }));
});

describe("Today hub data loading", () => {
  it("paginates beyond the database row cap instead of undercounting work", async () => {
    const data = await getTodayHub();
    expect(data.counts.dispatch).toBe(1001);
    expect(
      mocks.ranges.mock.calls.filter(([table]) => table === "orders"),
    ).toEqual([
      ["orders", 0, 499],
      ["orders", 500, 999],
      ["orders", 1000, 1499],
    ]);
  });
  it("fails clearly if any core dataset is unavailable, never presenting incomplete counts", async () => {
    for (const table of [
      "orders",
      "production_slots",
      "order_slots",
      "production_day_notes",
    ]) {
      mocks.failTable = table;
      await expect(getTodayHub()).rejects.toThrow(
        "Unable to load the Today hub. Please try again.",
      );
    }
  });
});
