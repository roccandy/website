import { describe, expect, it } from "vitest";
import {
  normalizeRedirectDestinationPath,
  normalizeRedirectSourcePath,
  parseRedirectStatusCode,
} from "@/lib/siteRedirectsShared";

describe("siteRedirectsShared", () => {
  it("normalizes source paths from raw paths and absolute URLs", () => {
    expect(normalizeRedirectSourcePath("contact")).toBe("/contact");
    expect(normalizeRedirectSourcePath("/contact/")).toBe("/contact");
    expect(normalizeRedirectSourcePath("https://www.roccandy.com.au/faqs?x=1")).toBe("/faqs?x=1");
  });

  it("normalizes destination paths while preserving absolute external URLs", () => {
    expect(normalizeRedirectDestinationPath("about/")).toBe("/about");
    expect(normalizeRedirectDestinationPath("/pre-made-candy/?sort=new")).toBe("/pre-made-candy?sort=new");
    expect(normalizeRedirectDestinationPath("https://example.com/path")).toBe("https://example.com/path");
  });

  it("limits redirect status codes to 301 or 302", () => {
    expect(parseRedirectStatusCode(undefined)).toBe(301);
    expect(parseRedirectStatusCode(null)).toBe(301);
    expect(parseRedirectStatusCode(301)).toBe(301);
    expect(parseRedirectStatusCode("302")).toBe(302);
    expect(parseRedirectStatusCode(307)).toBe(301);
  });
});
