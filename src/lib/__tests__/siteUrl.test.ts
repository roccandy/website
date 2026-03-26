import { afterEach, describe, expect, it, vi } from "vitest";
import { getPreviewCrawlBaseUrl, getSiteBaseUrl, isPreviewCrawlModeEnabled } from "@/lib/siteUrl";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("siteUrl", () => {
  it("defaults to the live domain", () => {
    expect(getSiteBaseUrl()).toBe("https://roccandy.com.au");
    expect(isPreviewCrawlModeEnabled()).toBe(false);
  });

  it("uses the preview base url only when preview crawl mode is enabled", () => {
    vi.stubEnv("PREVIEW_SITE_URL", "https://roccandy.vercel.app");
    expect(getPreviewCrawlBaseUrl()).toBe("https://roccandy.vercel.app");
    expect(getSiteBaseUrl()).toBe("https://roccandy.com.au");

    vi.stubEnv("ALLOW_PREVIEW_CRAWL", "true");
    expect(isPreviewCrawlModeEnabled()).toBe(true);
    expect(getSiteBaseUrl()).toBe("https://roccandy.vercel.app");
  });
});
