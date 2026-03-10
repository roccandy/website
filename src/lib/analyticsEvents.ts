"use client";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  item_category?: string;
  item_variant?: string;
  item_brand?: string;
  price?: number;
  quantity?: number;
};

type EcommercePayload = {
  currency?: string;
  value?: number;
  transaction_id?: string;
  items?: AnalyticsItem[];
};

const PURCHASE_TRACKED_STORAGE_KEY = "roccandy-tracked-purchases";

function roundMoney(value: number | undefined) {
  if (!Number.isFinite(value)) return undefined;
  return Math.round((value ?? 0) * 100) / 100;
}

function normalizeEcommercePayload(payload: EcommercePayload) {
  return {
    ...payload,
    value: roundMoney(payload.value),
    items: payload.items?.map((item) => ({
      ...item,
      price: roundMoney(item.price),
      quantity: item.quantity ?? 1,
    })),
  };
}

function dispatchEvent(name: string, payload: EcommercePayload) {
  if (typeof window === "undefined") return;
  const normalized = normalizeEcommercePayload(payload);

  if (typeof window.gtag === "function") {
    window.gtag("event", name, normalized);
    return;
  }

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({
      event: name,
      ecommerce: normalized,
    });
  }
}

function readTrackedPurchases() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.sessionStorage.getItem(PURCHASE_TRACKED_STORAGE_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<string>();
  }
}

function writeTrackedPurchases(values: Set<string>) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PURCHASE_TRACKED_STORAGE_KEY, JSON.stringify(Array.from(values)));
}

export function trackAddToCart(payload: { currency?: string; value?: number; items: AnalyticsItem[] }) {
  dispatchEvent("add_to_cart", payload);
}

export function trackBeginCheckout(payload: { currency?: string; value?: number; items: AnalyticsItem[] }) {
  dispatchEvent("begin_checkout", payload);
}

export function trackPurchaseOnce(payload: {
  transactionId: string;
  currency?: string;
  value?: number;
  items: AnalyticsItem[];
}) {
  const tracked = readTrackedPurchases();
  if (tracked.has(payload.transactionId)) return;

  dispatchEvent("purchase", {
    transaction_id: payload.transactionId,
    currency: payload.currency,
    value: payload.value,
    items: payload.items,
  });

  tracked.add(payload.transactionId);
  writeTrackedPurchases(tracked);
}
