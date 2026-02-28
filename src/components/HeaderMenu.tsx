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

const ORDER_TYPE_LABELS: Record<string, string> = {
  weddings: "Weddings",
  "weddings-initials": "Weddings (initials)",
  "weddings-both-names": "Weddings (both names)",
  text: "Custom text",
  "custom-1-6": "Custom text (1-6 letters)",
  "custom-7-14": "Custom text (7-14 letters)",
  branded: "Branded",
};

function formatPackagingLabel(label?: string | null) {
  if (!label) return "Packaging";
  const parts = label.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) return parts.join(" ");
  return label.replace(/\s+/g, " ").trim();
}

function getOrderTypeLabel(value?: string | null) {
  if (!value) return "Order";
  return ORDER_TYPE_LABELS[value] ?? value;
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
                className={`absolute inset-0 bg-zinc-900/30 transition-opacity duration-300 ${
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
                          const customSummary = !isPremade
                            ? `${getOrderTypeLabel(item.categoryId || item.designType)}: ${item.quantity} x ${formatPackagingLabel(
                                item.packagingLabel
                              )}${title ? ` (${title})` : ""}`
                            : "";
                          return (
                            <li
                              key={item.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-zinc-100 p-2"
                            >
                              <span className="flex-1 text-xs font-semibold text-zinc-800">
                                {isPremade ? (
                                  <>
                                    {weightLabel ? `${weightLabel} ` : ""}
                                    {title}
                                  </>
                                ) : (
                                  customSummary
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
