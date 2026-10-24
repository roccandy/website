"use client";
import { AdminLink } from "../AdminNavigationFeedback";
import { useAdminViewState } from "../useAdminViewState";

export function isOrderReturnPath(value: string) {
  return /^\/admin\/orders(?:\/(?:archived|invoices))?(?:\?[^#]*)?$/.test(value);
}
export function OrderReturnLink() {
  const [href] = useAdminViewState("orders-return", "/admin/orders/archived", isOrderReturnPath);
  const label = href.split("?")[0] === "/admin/orders" ? "Back to production" : href.startsWith("/admin/orders/invoices") ? "Back to invoices" : "Back to orders";
  return <AdminLink href={href} className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300">{label}</AdminLink>;
}

export function InvoiceReturnLink() {
  const [href] = useAdminViewState("orders-return", "/admin/orders/invoices", (value) => /^\/admin\/orders\/invoices(?:\?[^#]*)?$/.test(value));
  return <AdminLink href={href} className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300">All invoices</AdminLink>;
}
