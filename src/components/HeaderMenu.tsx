"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Icon from "@mdi/react";
import { mdiCartOutline, mdiTrashCanOutline, mdiClose } from "@mdi/js";
import { useCart } from "./CartProvider";

function formatWeight(weight_g: number) {
  if (!Number.isFinite(weight_g) || weight_g <= 0) return "";
  if (weight_g >= 1000) {
    const kg = weight_g / 1000;
    const label = Number.isInteger(kg) ? String(kg) : kg.toFixed(2).replace(/\.0+$/, "").replace(/(\.[1-9])0$/, "$1");
    return `${label}kg`;
  }
  return `${weight_g}g`;
}

function formatPackagingLabel(label?: string | null) {
  if (!label) return "Packaging";
  const parts = label.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) return parts.join(" ");
  return label.replace(/\s+/g, " ").trim();
}

function getOrderTypeLine(value?: string | null) {
  if (!value) return "Order";
  if (value === "weddings-initials") return "Weddings | Initials";
  if (value === "weddings-both-names") return "Weddings | Both Names";
  if (value === "weddings") return "Weddings";
  if (value === "custom-1-6") return "Custom Text | 1-6 Letters";
  if (value === "custom-7-14") return "Custom Text | 7-14 Letters";
  if (value === "text") return "Custom Text";
  if (value === "branded") return "Branded";
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function HeaderMenu() {
  const { items, clearCart, updateQuantity, removeItem } = useCart();
  const [open, setOpen] = useState(false);
  const [renderDrawer, setRenderDrawer] = useState(false);
  const [mounted, setMounted] = useState(false);
  const hasItems = items.length > 0;
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const openDrawer = () => {
    setRenderDrawer(true);
    requestAnimationFrame(() => setOpen(true));
  };

  const closeDrawer = () => {
    setOpen(false);
    window.setTimeout(() => setRenderDrawer(false), 300);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    items.forEach((item) => {
      if (item.type !== "custom") return;
      const maxPackages = Number(item.maxPackages);
      if (!Number.isFinite(maxPackages) || maxPackages <= 0) return;
      const maxInt = Math.floor(maxPackages);
      if (item.quantity > maxInt) {
        updateQuantity(item.id, maxInt);
      }
    });
  }, [items, updateQuantity]);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="View cart"
        aria-expanded={open}
        onClick={openDrawer}
        className="inline-flex h-10 w-10 items-center justify-center text-[#ff6f95] transition-colors hover:text-[#ff4f80]"
      >
        <Icon path={mdiCartOutline} size={1.6} aria-hidden="true" />
        {hasItems ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#ff6f95] px-1 text-[10px] font-semibold text-white">
            {itemCount}
          </span>
        ) : null}
      </button>

      {renderDrawer && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[60]">
              <button
                type="button"
                aria-label="Close cart preview"
                className={`absolute inset-0 bg-zinc-900/45 transition-opacity duration-300 ${
                  open ? "opacity-100" : "opacity-0"
                }`}
                onClick={closeDrawer}
              />
              <div
                className={`absolute right-0 top-0 h-full w-[360px] max-w-[92vw] border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-300 ${
                  open ? "translate-x-0" : "translate-x-full"
                }`}
              >
                <div className="flex h-full flex-col p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold text-[#ff6f95]">Cart Preview</p>
                    <button
                      type="button"
                      onClick={closeDrawer}
                      className="inline-flex h-7 w-7 items-center justify-center text-[#ff6f95] hover:text-[#ff4f80]"
                    >
                      <Icon path={mdiClose} size={0.7} aria-hidden="true" />
                    </button>
                  </div>

                  <div className="mt-3 flex-1 overflow-auto">
                    {hasItems ? (
                      <ul className="space-y-3 text-sm text-zinc-700">
                        {items.map((item) => {
                          const isPremade = item.type === "premade";
                          const title = isPremade ? item.name : item.title;
                          const weightLabel =
                            isPremade
                              ? formatWeight(item.weight_g)
                              : item.totalWeightKg
                                ? formatWeight(item.totalWeightKg * 1000)
                                : "";
                          const customLineOne = !isPremade ? getOrderTypeLine(item.categoryId || item.designType) : "";
                          const customLineTwo = !isPremade
                            ? `${item.quantity} x ${formatPackagingLabel(item.packagingLabel)}`
                            : "";
                          const customLineThree = !isPremade
                            ? `${title || "Custom Order"}${item.flavor ? ` | ${item.flavor}` : ""}`
                            : "";
                          const customMaxPackages = !isPremade
                            ? (() => {
                                const raw = Number(item.maxPackages);
                                return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : null;
                              })()
                            : null;
                          const clampCustomQty = (next: number) => {
                            const safeNext = Math.max(1, next);
                            if (!customMaxPackages) return safeNext;
                            return Math.min(safeNext, customMaxPackages);
                          };
                          const itemTypeLabel = isPremade ? "Premade" : "Custom order";
                          return (
                            <li
                              key={item.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-zinc-100 p-2"
                            >
                              <span className={`flex-1 text-xs font-semibold ${isPremade ? "text-[#ff6f95]" : "text-zinc-800"}`}>
                                <span
                                  className={`mb-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold normal-case tracking-[0.06em] ${
                                    isPremade ? "bg-[#fde4ec] text-[#ff6f95]" : "bg-zinc-100 text-zinc-600"
                                  }`}
                                >
                                  {itemTypeLabel}
                                </span>
                                {isPremade ? (
                                  <>
                                    {weightLabel ? `${weightLabel} ` : ""}
                                    {title}
                                  </>
                                ) : (
                                  <span className="mx-auto inline-flex w-fit max-w-full flex-col items-center gap-0.5 overflow-x-auto rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-center text-[11px] leading-tight">
                                    <span className="whitespace-nowrap">{customLineOne}</span>
                                    <span className="whitespace-nowrap">{customLineTwo}</span>
                                    <span className="whitespace-nowrap">{customLineThree}</span>
                                  </span>
                                )}
                              </span>
                              <div className="flex items-center gap-2">
                                {isPremade ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                      className="h-7 w-7 rounded border border-zinc-200 text-xs font-semibold text-zinc-600 hover:border-zinc-300"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min={1}
                                      value={item.quantity}
                                      onChange={(event) => {
                                        const next = Number(event.target.value);
                                        if (Number.isNaN(next)) return;
                                        updateQuantity(item.id, Math.max(1, next));
                                      }}
                                      className="h-7 w-12 rounded border border-zinc-200 text-center text-xs font-semibold text-zinc-700"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                      className="h-7 w-7 rounded border border-zinc-200 text-xs font-semibold text-zinc-600 hover:border-zinc-300"
                                    >
                                      +
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => updateQuantity(item.id, clampCustomQty(item.quantity - 1))}
                                      className="h-7 w-7 rounded border border-zinc-200 text-xs font-semibold text-zinc-600 hover:border-zinc-300"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min={1}
                                      max={customMaxPackages ?? undefined}
                                      value={item.quantity}
                                      onChange={(event) => {
                                        const next = Number(event.target.value);
                                        if (Number.isNaN(next)) return;
                                        updateQuantity(item.id, clampCustomQty(next));
                                      }}
                                      className="h-7 w-14 rounded border border-zinc-200 text-center text-xs font-semibold text-zinc-700"
                                      aria-label={`Package quantity for ${title || "custom order"}`}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => updateQuantity(item.id, clampCustomQty(item.quantity + 1))}
                                      disabled={Boolean(customMaxPackages && item.quantity >= customMaxPackages)}
                                      className="h-7 w-7 rounded border border-zinc-200 text-xs font-semibold text-zinc-600 hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      +
                                    </button>
                                  </>
                                )}
                                {!isPremade ? (
                                  <a
                                    href={`/design?edit=${encodeURIComponent(item.id)}`}
                                    onClick={closeDrawer}
                                    className="rounded border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:border-zinc-300 hover:text-zinc-800"
                                  >
                                    Edit
                                  </a>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!isPremade) {
                                      const confirmed = window.confirm("Remove this custom order from the cart?");
                                      if (!confirmed) return;
                                    }
                                    removeItem(item.id);
                                  }}
                                  aria-label="Remove item"
                                  className="inline-flex h-7 w-7 items-center justify-center text-zinc-400 hover:text-zinc-600"
                                >
                                  <Icon path={mdiTrashCanOutline} size={0.7} aria-hidden="true" />
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-sm text-zinc-500">Your cart is empty.</p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={clearCart}
                      className="flex-1 rounded-md border border-[#ff6f95] px-3 py-2 text-xs font-semibold text-[#ff6f95] hover:border-[#ff4f80] hover:text-[#ff4f80]"
                    >
                      Empty cart
                    </button>
                    <Link
                      href="/checkout"
                      onClick={closeDrawer}
                      className="flex-1 rounded-md border border-[#ff6f95] bg-[#ff6f95] px-3 py-2 text-center text-xs font-semibold text-white hover:border-[#ff4f80] hover:bg-[#ff4f80]"
                    >
                      Checkout
                    </Link>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
