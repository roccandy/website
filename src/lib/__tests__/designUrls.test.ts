import { describe, expect, it } from "vitest";
import {
  buildDesignerEditPath,
  buildDesignerPath,
  getDesignerCanonicalTarget,
  isLegacyDesignerQuery,
  resolveDesignerState,
} from "@/lib/designUrls";

describe("designUrls", () => {
  it("normalizes legacy wedding subtype URLs", () => {
    expect(
      resolveDesignerState({
        type: "weddings",
        subtype: "weddings-initials",
      }),
    ).toMatchObject({
      orderType: "weddings",
      categoryId: "weddings-initials",
      publicType: "wedding",
      publicVariant: "initials",
      landingPath: "/design/wedding-candy",
    });
  });

  it("builds the clean public designer query path", () => {
    expect(
      buildDesignerPath({
        orderType: "text",
        categoryId: "custom-7-14",
      }),
    ).toBe("/design?type=text&variant=long");
  });

  it("keeps non-designer query params when rebuilding a designer path", () => {
    const extraParams = new URLSearchParams("edit=123&foo=bar&type=ignore-me");
    expect(
      buildDesignerPath({
        orderType: "branded",
        categoryId: "branded",
        extraParams,
      }),
    ).toBe("/design?type=branded&edit=123&foo=bar");
  });

  it("builds edit URLs with the saved custom order type and variant", () => {
    expect(
      buildDesignerEditPath({
        itemId: "custom-123",
        categoryId: "custom-7-14",
        designType: "text",
      }),
    ).toBe("/design?type=text&variant=long&edit=custom-123");
  });

  it("points utility designer URLs at the clean canonical target", () => {
    expect(getDesignerCanonicalTarget({ type: "wedding", variant: "names" })).toBe("/design/wedding-candy");
    expect(getDesignerCanonicalTarget({ type: "text", variant: "short" })).toBe("/design/custom-text-candy");
    expect(getDesignerCanonicalTarget({ type: "branded" })).toBe("/design/branded-logo-candy");
    expect(getDesignerCanonicalTarget({})).toBe("/design");
  });

  it("detects legacy query patterns", () => {
    expect(isLegacyDesignerQuery({ type: "weddings" })).toBe(true);
    expect(isLegacyDesignerQuery({ subtype: "custom-1-6" })).toBe(true);
    expect(isLegacyDesignerQuery({ type: "wedding", variant: "initials" })).toBe(false);
  });
});
