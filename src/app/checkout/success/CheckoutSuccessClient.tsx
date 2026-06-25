"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/components/CartProvider";
import { readCheckoutSuccessSummary, type CheckoutSuccessSummary } from "./successSummary";

function formatMoney(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) return "-";
  return `$${Number(value).toFixed(2)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function CheckoutSuccessClient() {
  const { clearCart } = useCart();
  const [summary] = useState<CheckoutSuccessSummary | null>(() => readCheckoutSuccessSummary());

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  if (!summary) {
    return (
      <div className="rounded-3xl border border-zinc-200 bg-white/90 p-8 text-center shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Payment received</p>
        <h1 className="site-page-title mt-3 text-zinc-900">Thank you for your order!</h1>
        <p className="mt-3 text-sm text-zinc-600">
          We&apos;ve received your payment. Please check your email for your full order details and confirmation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-emerald-200 bg-white/95 p-8 shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">Payment received</p>
        <h1 className="site-page-title mt-3 text-zinc-900">Thank you for your order!</h1>
        <p className="mt-3 text-sm text-zinc-600">
          Your order has been confirmed. Please check your email for your confirmation and tax invoice.
        </p>
        {summary.orderNumber ? (
          <p className="mt-4 text-sm font-semibold text-zinc-900">Order number: #{summary.orderNumber}</p>
        ) : null}
        {summary.adminEmailWarning ? (
          <p className="mt-3 text-sm text-rose-600">{summary.adminEmailWarning}</p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
        <section className="rounded-3xl border border-zinc-200 bg-white/95 p-6 shadow-lg">
          <h2 className="site-small-title text-zinc-900">Products ordered</h2>
          <div className="mt-5 space-y-4">
            {summary.items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-zinc-900">{item.title}</p>
                    {item.subtitle ? <p className="text-sm text-zinc-600">{item.subtitle}</p> : null}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-zinc-900">Qty {item.quantity}</p>
                    <p className="text-sm text-zinc-600">{formatMoney(item.lineTotal)}</p>
                  </div>
                </div>
                {item.details && item.details.length > 0 ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {item.details.map((detail) => (
                      <div key={`${item.id}-${detail.label}`} className="text-sm">
                        <span className="font-semibold text-zinc-700">{detail.label}:</span>{" "}
                        <span className="text-zinc-600">{detail.value}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-zinc-200 bg-white/95 p-6 shadow-lg">
            <h2 className="site-small-title text-zinc-900">Order information</h2>
            <div className="mt-4 space-y-2 text-sm text-zinc-700">
              <p><span className="font-semibold">Date ordered:</span> {formatDate(summary.orderDateIso)}</p>
              <p><span className="font-semibold">Requested date:</span> {formatDate(summary.requestedDate)}</p>
              <p><span className="font-semibold">Payment method:</span> {summary.paymentMethod}</p>
              <p><span className="font-semibold">Customer:</span> {summary.customer.name || "-"}</p>
              <p><span className="font-semibold">Email:</span> {summary.customer.email || "-"}</p>
              <p><span className="font-semibold">Phone:</span> {summary.customer.phone || "-"}</p>
              {summary.customer.organizationName ? (
                <p><span className="font-semibold">Organisation:</span> {summary.customer.organizationName}</p>
              ) : null}
              <p><span className="font-semibold">{summary.pickup ? "Pickup" : "Delivery address"}:</span> {summary.deliveryAddress}</p>
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white/95 p-6 shadow-lg">
            <h2 className="site-small-title text-zinc-900">Payment summary</h2>
            <div className="mt-4 space-y-2 text-sm text-zinc-700">
              <div className="flex items-center justify-between gap-3">
                <span>Subtotal</span>
                <span>{formatMoney(summary.subtotal)}</span>
              </div>
              {summary.urgencyTotal > 0 ? (
                <div className="flex items-center justify-between gap-3">
                  <span>Urgency surcharge</span>
                  <span>{formatMoney(summary.urgencyTotal)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3 border-t border-zinc-200 pt-2 text-base font-semibold text-zinc-900">
                <span>Total paid</span>
                <span>{formatMoney(summary.total)}</span>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white/95 p-6 shadow-lg">
            <h2 className="site-small-title text-zinc-900">What happens next</h2>
            <div className="mt-4 space-y-3 text-sm text-zinc-700">
              <p>We&apos;ve emailed your order confirmation and tax invoice to {summary.customer.email || "your email address"}.</p>
              <p>If anything looks incorrect, reply to that email and we&apos;ll help sort it out.</p>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/pre-made-candy"
                className="rounded-full border border-zinc-900 bg-zinc-900 px-5 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-zinc-800"
              >
                Continue shopping
              </Link>
              <Link
                href="/design"
                className="rounded-full border border-zinc-200 bg-white px-5 py-2 text-center text-sm font-semibold text-zinc-700 hover:border-zinc-300"
              >
                Start a new design
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
