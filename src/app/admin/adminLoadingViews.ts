export type AdminLoadingView = {
  title: string;
  description: string;
  layout: "table" | "form" | "schedule" | "dashboard";
};

export function getAdminLoadingView(pathname: string): AdminLoadingView {
  if (pathname === "/admin/orders")
    return {
      title: "Production Schedule",
      description: "Loading orders and production slots…",
      layout: "schedule",
    };
  if (/^\/admin\/stats(?:-v2)?$/.test(pathname))
    return {
      title: pathname.endsWith("stats-v2") ? "Stats v2 (demo)" : "Stats",
      description: "Loading order insights…",
      layout: "dashboard",
    };
  if (
    /^\/admin\/orders\/(?:new|[^/]+(?:\/invoice|\/print)?)$/.test(pathname) &&
    !["archived", "invoices", "additional-items"].includes(
      pathname.split("/")[3],
    )
  )
    return {
      title: pathname.endsWith("/new")
        ? "Create Order"
        : pathname.endsWith("/invoice")
          ? "Invoice Review"
          : pathname.endsWith("/print")
            ? "Print Order"
            : "Order Details",
      description: "Loading order details…",
      layout: "form",
    };
  if (/^\/admin\/customers\/[^/]+$/.test(pathname))
    return {
      title: "Customer Details",
      description: "Loading customer history…",
      layout: "form",
    };
  const titles: Record<string, string> = {
    "/admin": "Today",
    "/admin/orders/archived": "All Orders / Refunds",
    "/admin/orders/invoices": "Invoices",
    "/admin/orders/additional-items": "Pre-made Orders",
    "/admin/production": "Production Orders",
    "/admin/customers": "Customers",
    "/admin/premade": "Pre-made Candy",
    "/admin/flavors": "Candy Flavours",
    "/admin/pricing": "Base Pricing",
    "/admin/labels": "Label Pricing",
    "/admin/packaging": "Packaging Options",
    "/admin/packaging/labels": "Label Types",
    "/admin/activity": "Recent Changes",
    "/admin/settings/production": "Production Settings",
    "/admin/settings/blocked-dates": "Blocked Dates",
    "/admin/settings/extras": "Extras Pricing",
    "/admin/settings/pages": "Site Pages & SEO",
    "/admin/settings/blog-posts": "Blog Posts",
    "/admin/settings/faqs": "FAQs",
    "/admin/settings/privacy": "Privacy Policy",
    "/admin/settings/terms": "Terms and Conditions",
    "/admin/settings/palette": "Colour Palette",
    "/admin/settings/password": "My Password",
    "/admin/settings/users": "Admin Users",
  };
  return {
    title: titles[pathname] ?? "Admin Page",
    description: "Opening page…",
    layout:
      pathname === "/admin"
        ? "dashboard"
        : pathname.startsWith("/admin/settings")
          ? "form"
          : "table",
  };
}
