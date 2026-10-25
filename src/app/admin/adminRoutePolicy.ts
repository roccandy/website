const roots = ["/admin", "/admin/orders", "/admin/orders/archived", "/admin/orders/invoices", "/admin/orders/additional-items", "/admin/customers", "/admin/stats", "/admin/stats-v2", "/admin/production"];

// Hydrated React server-action forms can report method="get" in the DOM.
export function isAdminWriteForm(method: string, action: string|null, hasActionFields = false) {
  return method.toLowerCase() === "post" || Boolean(action?.trim().toLowerCase().startsWith("javascript:")) || hasActionFields;
}

/** Read views can be preloaded; entry/edit/password forms always fetch on entry. */
export function isAdminReadView(href: string) {
  try {
    const url = new URL(href, "https://admin.local");
    return url.origin === "https://admin.local" && /^\/admin(?:\/|$)/.test(url.pathname) &&
      !/(?:\/new|\/edit|\/login|\/password|\/print|\/settings\/users)$/.test(url.pathname) && !url.searchParams.has("edit");
  } catch { return false; }
}

export function adminTabKey(href: string) {
  const url = new URL(href, "https://admin.local");
  if(url.origin!=="https://admin.local") return null;
  return roots.includes(url.pathname) || /^\/admin\/(settings\/[^/]+|pricing|labels|packaging|flavors|premade|activity)$/.test(url.pathname) ? url.pathname : null;
}

export function cleanAdminLocation(href: string) {
  const url = new URL(href, "https://admin.local");
  url.searchParams.delete("toast"); url.searchParams.delete("message");
  url.searchParams.sort();
  return url.pathname + (url.searchParams.size ? `?${url.searchParams}` : "");
}
