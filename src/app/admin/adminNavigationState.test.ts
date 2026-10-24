import { describe, expect, it } from "vitest";
import { adminLocationKey } from "./AdminScrollRestoration";
import { isOrderReturnPath } from "./orders/OrderReturnLink";

describe("admin view locations", () => {
  it("keeps filters and sorting while ignoring transient toast messages", () => {
    expect(adminLocationKey("/admin/orders/archived", "sort=title&q=Wedding&toast=success&message=Saved&dir=asc"))
      .toBe("/admin/orders/archived?dir=asc&q=Wedding&sort=title");
  });
  it("does not share scroll positions between different searches", () => {
    expect(adminLocationKey("/admin/orders/archived", "q=one"))
      .not.toBe(adminLocationKey("/admin/orders/archived", "q=two"));
  });
  it.each(["/admin/orders", "/admin/orders?selected=123", "/admin/orders/archived?q=wedding&dir=asc", "/admin/orders/invoices?page=2&view=unpaid"])("accepts an internal order-list return path: %s", (path) => {
    expect(isOrderReturnPath(path)).toBe(true);
  });
  it.each(["https://example.com", "//example.com", "javascript:alert(1)", "/admin/orders/123", "/admin/orders/new", "/admin/orders/archived/../../settings", "/admin/orders-evil"])("rejects unexpected return paths: %s", (path) => {
    expect(isOrderReturnPath(path)).toBe(false);
  });
});
