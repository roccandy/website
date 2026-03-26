import { beforeEach, describe, expect, it, vi } from "vitest";

const syncManagedSitePages = vi.fn();
const syncManagedFaqItems = vi.fn();
const syncManagedTermsItems = vi.fn();

vi.mock("@/lib/sitePages", () => ({
  syncManagedSitePages,
}));

vi.mock("@/lib/faqs", () => ({
  syncManagedFaqItems,
}));

vi.mock("@/lib/terms", () => ({
  syncManagedTermsItems,
}));

describe("syncManagedContent", () => {
  beforeEach(() => {
    syncManagedSitePages.mockReset();
    syncManagedFaqItems.mockReset();
    syncManagedTermsItems.mockReset();
  });

  it("runs the explicit site-pages/faq/terms sync path and returns counts", async () => {
    syncManagedSitePages.mockResolvedValue([{ slug: "home" }, { slug: "blog" }]);
    syncManagedFaqItems.mockResolvedValue([{ id: "faq-1" }]);
    syncManagedTermsItems.mockResolvedValue([{ id: "terms-1" }, { id: "terms-2" }, { id: "terms-3" }]);

    const { syncManagedContent } = await import("@/lib/managedContentSync");
    await expect(syncManagedContent()).resolves.toEqual({
      pagesSynced: 2,
      faqItemsSynced: 1,
      termsItemsSynced: 3,
    });

    expect(syncManagedSitePages).toHaveBeenCalledTimes(1);
    expect(syncManagedFaqItems).toHaveBeenCalledTimes(1);
    expect(syncManagedTermsItems).toHaveBeenCalledTimes(1);
  });
});
