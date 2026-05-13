import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { getProductionBlocks, getSettings } = vi.hoisted(() => ({
  getProductionBlocks: vi.fn(),
  getSettings: vi.fn(),
}));

vi.mock("@/lib/data", () => ({
  getProductionBlocks,
  getSettings,
}));

import {
  FREE_DELIVERY_BANNER_MESSAGE,
  getActiveProductionBlockoutMessage,
  getSiteBannerMessage,
} from "@/lib/productionBlockout";

describe("productionBlockout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 13));
    getSettings.mockResolvedValue({ quote_blockout_months: 3 });
    getProductionBlocks.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the delivery resume message for an active production blockout", async () => {
    getProductionBlocks.mockResolvedValue([
      {
        id: "block-1",
        start_date: "2026-05-10",
        end_date: "2026-05-20",
        reason: "Limited production",
        created_at: "2026-04-01T00:00:00Z",
      },
    ]);

    await expect(getActiveProductionBlockoutMessage()).resolves.toBe(
      "Deliveries resume 21st May 2026 due to limited production"
    );
  });

  it("falls back to the free delivery banner when there is no active blockout", async () => {
    await expect(getActiveProductionBlockoutMessage()).resolves.toBeNull();
    await expect(getSiteBannerMessage()).resolves.toBe(FREE_DELIVERY_BANNER_MESSAGE);
  });
});
