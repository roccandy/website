import { describe, expect, it } from "vitest";
import { removesActiveAdmin } from "../adminUserGuards";

describe("removesActiveAdmin", () => {
  const admin = { role: "admin" as const, is_active: true };

  it("identifies demotion, deactivation, and deletion of an active admin", () => {
    expect(removesActiveAdmin(admin, { role: "editor", is_active: true })).toBe(true);
    expect(removesActiveAdmin(admin, { role: "admin", is_active: false })).toBe(true);
    expect(removesActiveAdmin(admin, null)).toBe(true);
  });

  it("allows changes that preserve an active admin", () => {
    expect(removesActiveAdmin(admin, admin)).toBe(false);
    expect(removesActiveAdmin({ role: "editor", is_active: true }, null)).toBe(false);
  });
});
