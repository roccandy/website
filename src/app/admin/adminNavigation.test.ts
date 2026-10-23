import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import {
  buildAdminNavSections,
  getAdminPrimaryNavigation,
} from "./adminNavigation";
const user = (role: Session["user"]["role"]): Session["user"] => ({
  id: "test",
  role,
  canWrite: role === "admin",
  canWriteSeo: role === "seo" || role === "admin",
  canManageUsers: role === "admin",
});
describe("Compact admin navigation", () => {
  it("keeps daily tasks in the primary navigation and infrequent tools in the directory", () => {
    expect(
      getAdminPrimaryNavigation(user("admin")).map((item) => item.label),
    ).toEqual([
      "Today",
      "Production",
      "Orders",
      "Customers",
      "Invoices",
      "Insights",
    ]);
    const links = buildAdminNavSections(user("admin")).flatMap((section) =>
      section.items.map((item) => item.href),
    );
    for (const href of [
      "/admin/packaging",
      "/admin/pricing",
      "/admin/settings/users",
      "/admin/activity",
      "/admin/stats",
      "/admin/stats-v2",
    ])
      expect(links).toContain(href);
  });
  it("does not offer financial or customer navigation to production-only users", () => {
    expect(
      getAdminPrimaryNavigation(user("production")).map((item) => item.href),
    ).toEqual(["/admin/production"]);
    expect(
      buildAdminNavSections(user("production")).flatMap((section) =>
        section.items.map((item) => item.href),
      ),
    ).toEqual(["/admin/production"]);
  });
  it("gives SEO users a content-focused primary navigation", () => {
    expect(
      getAdminPrimaryNavigation(user("seo")).map((item) => item.href),
    ).toEqual([
      "/admin",
      "/admin/settings/pages",
      "/admin/settings/blog-posts",
      "/admin/settings/faqs",
    ]);
  });
});
