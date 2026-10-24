import { describe, expect, it } from "vitest";
import { draftFingerprint } from "./adminFormDraft";

describe("admin draft detection", () => {
  it("does not treat live quote results as a user edit", () => {
    expect(draftFingerprint([["notes", "hello"], ["total_price", "100"]]))
      .toBe(draftFingerprint([["notes", "hello"], ["total_price", "110"]]));
  });
  it("does detect edited notes, customer fields, price overrides and batch allocations", () => {
    for (const name of ["notes", "customer_email", "admin_price_override", "batch_weight_kg", "total_weight_kg", "logo_url"]) {
      expect(draftFingerprint([[name, "before"]])).not.toBe(draftFingerprint([[name, "after"]]));
    }
  });
  it("does not make an untouched empty upload dirty when the browser changes its timestamp", () => {
    const empty = (time: number) => new File([], "", { lastModified: time });
    expect(draftFingerprint([["artwork", empty(1)]])).toBe(draftFingerprint([["artwork", empty(2)]]));
  });
  it("detects a different uploaded image without storing the image bytes", () => {
    const file = new File(["image"], "logo.png", { lastModified: 1 });
    expect(draftFingerprint([["artwork", file]])).toContain("logo.png:5:1");
    expect(draftFingerprint([["artwork", file]])).not.toContain("image");
  });
});
