"use client";

export const CHECKOUT_SUCCESS_STORAGE_KEY = "roccandy-checkout-success-v1";

export type CheckoutSuccessSummaryItem = {
  id: string;
  title: string;
  quantity: number;
  lineTotal: number | null;
  subtitle?: string | null;
  details?: Array<{ label: string; value: string }>;
};

export type CheckoutSuccessSummary = {
  orderNumber?: string | null;
  orderDateIso: string;
  paymentMethod: string;
  requestedDate?: string | null;
  pickup: boolean;
  deliveryAddress: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    organizationName?: string | null;
  };
  items: CheckoutSuccessSummaryItem[];
  subtotal: number;
  urgencyTotal: number;
  total: number;
  adminEmailWarning?: string | null;
};

export function storeCheckoutSuccessSummary(summary: CheckoutSuccessSummary) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(CHECKOUT_SUCCESS_STORAGE_KEY, JSON.stringify(summary));
}

export function readCheckoutSuccessSummary(): CheckoutSuccessSummary | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(CHECKOUT_SUCCESS_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CheckoutSuccessSummary;
  } catch {
    return null;
  }
}
