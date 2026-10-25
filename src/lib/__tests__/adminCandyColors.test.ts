import { describe, expect, it } from "vitest";
import { adminCandyColor } from "../adminCandyColors";

describe("adminCandyColor", () => {
  it("defaults old orders to white and preserves saved colours when fields are absent", () => {
    expect(adminCandyColor(null)).toBe("#ffffff");
    expect(adminCandyColor(undefined, "#112233")).toBe("#112233");
    expect(adminCandyColor("")).toBe("#ffffff");
  });
  it("normalises palette and custom six-digit colours", () => {
    expect(adminCandyColor(" #AaBB00 ")).toBe("#aabb00");
    expect(adminCandyColor("123456")).toBe("#123456");
  });
  it.each(["red", "#abc", "#12345678", "url(https://example.com)", "<script>", {}, 123])("rejects invalid colour %s", value => {
    expect(() => adminCandyColor(value)).toThrow("six-digit hex");
  });
});
