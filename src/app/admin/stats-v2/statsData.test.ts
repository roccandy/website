import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  ranges: vi.fn(),
  fail: false,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdminClient: { from: mocks.from },
}));
import { getStatsDataset } from "./statsData";

beforeEach(() => {
  mocks.fail = false;
  mocks.ranges.mockImplementation((from: number, to: number) => ({
    error: mocks.fail ? { message: "Database internal detail" } : null,
    data: Array.from(
      { length: Math.max(0, Math.min(1001, to + 1) - from) },
      (_, index) => ({
        id: `id-${from + index}`,
        order_number: String(from + index + 1),
        created_at: "2026-10-01T00:00:00Z",
        total_price: 10,
        total_weight_kg: 1,
        status: "pending",
        design_type: "premade",
      }),
    ),
  }));
  mocks.from.mockImplementation((table: string) => {
    if (table === "orders")
      return {
        select: () => ({
          lte: () => ({ order: () => ({ range: mocks.ranges }) }),
        }),
      };
    return { select: async () => ({ data: [], error: null }) };
  });
});

describe("stats data loading", () => {
  it("loads every page beyond the database default row cap", async () => {
    const result = await getStatsDataset();
    expect(mocks.ranges.mock.calls).toEqual([
      [0, 499],
      [500, 999],
      [1000, 1499],
    ]);
    expect(result.orders).toHaveLength(1001);
    expect(result.orders.reduce((sum, order) => sum + order.net, 0)).toBe(
      1_001_000,
    );
  });

  it("fails explicitly rather than silently showing partial totals", async () => {
    mocks.fail = true;
    await expect(getStatsDataset()).rejects.toThrow(
      "Unable to load order reporting data.",
    );
  });
});
