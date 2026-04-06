"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "roccandy-cart-v1";
const EMPTY_CART: CartItem[] = [];

export type PremadeCartItem = {
  id: string;
  type: "premade";
  premadeId: string;
  name: string;
  flavor?: string;
  price: number;
  weight_g: number;
  imageUrl?: string;
  quantity: number;
};

export type CustomCartItem = {
  id: string;
  type: "custom";
  orderId?: string;
  title: string;
  description?: string;
  categoryId?: string;
  packagingOptionId?: string;
  totalPrice?: number | null;
  totalWeightKg?: number | null;
  quantity: number;
  packagingLabel?: string | null;
  dueDate?: string;
  flavor?: string;
  pickup?: boolean;
  jarLidColor?: string | null;
  labelsCount?: number | null;
  labelImageUrl?: string | null;
  labelTypeId?: string | null;
  ingredientLabelsOptIn?: boolean;
  jacket?: string | null;
  jacketType?: string | null;
  jacketColorOne?: string | null;
  jacketColorTwo?: string | null;
  textColor?: string | null;
  heartColor?: string | null;
  logoUrl?: string | null;
  previewSvg?: string | null;
  previewPngDataUrl?: string | null;
  designType?: string | null;
  designText?: string | null;
  maxPackages?: number | null;
  jacketExtras?: { jacket: "rainbow" | "two_colour" | "pinstripe" }[];
};

export type CartItem = PremadeCartItem | CustomCartItem;

type CartContextValue = {
  items: CartItem[];
  addPremadeItem: (item: Omit<PremadeCartItem, "id" | "type" | "quantity"> & { quantity?: number }) => void;
  addCustomItem: (item: Omit<CustomCartItem, "id" | "type">) => void;
  updateCustomItem: (id: string, updates: Partial<Omit<CustomCartItem, "id" | "type">>) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
};

type CartListener = () => void;

const listeners = new Set<CartListener>();

function createCartId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readStoredCart(): CartItem[] {
  if (typeof window === "undefined") return EMPTY_CART;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return EMPTY_CART;
  try {
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : EMPTY_CART;
  } catch {
    return EMPTY_CART;
  }
}

let itemsState: CartItem[] = typeof window === "undefined" ? EMPTY_CART : readStoredCart();
let storageListenerAttached = false;

function notify() {
  listeners.forEach((listener) => listener());
}

function persist(items: CartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function setItems(next: CartItem[]) {
  itemsState = next;
  persist(next);
  notify();
}

function updateItems(updater: (items: CartItem[]) => CartItem[]) {
  setItems(updater(itemsState));
}

function attachStorageListener() {
  if (storageListenerAttached || typeof window === "undefined") return;
  storageListenerAttached = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    itemsState = readStoredCart();
    notify();
  });
}

function subscribe(listener: CartListener) {
  attachStorageListener();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return itemsState;
}

function getServerSnapshot() {
  return EMPTY_CART;
}

const addPremadeItem: CartContextValue["addPremadeItem"] = (item) => {
  updateItems((prev) => {
    const existing = prev.find(
      (entry) => entry.type === "premade" && entry.premadeId === item.premadeId
    ) as PremadeCartItem | undefined;
    if (existing) {
      return prev.map((entry) =>
        entry.id === existing.id
          ? { ...existing, quantity: existing.quantity + (item.quantity ?? 1) }
          : entry
      );
    }

    const next: PremadeCartItem = {
      id: createCartId("premade"),
      type: "premade",
      premadeId: item.premadeId,
      name: item.name,
      flavor: item.flavor,
      price: item.price,
      weight_g: item.weight_g,
      imageUrl: item.imageUrl,
      quantity: item.quantity ?? 1,
    };

    return [...prev, next];
  });
};

const addCustomItem: CartContextValue["addCustomItem"] = (item) => {
  updateItems((prev) => [
    ...prev,
    {
      id: item.orderId || createCartId("custom"),
      type: "custom",
      ...item,
    },
  ]);
};

const updateCustomItem: CartContextValue["updateCustomItem"] = (id, updates) => {
  updateItems((prev) =>
    prev.map((item) => {
      if (item.id !== id || item.type !== "custom") return item;
      return {
        ...item,
        ...updates,
      };
    })
  );
};

const updateQuantity: CartContextValue["updateQuantity"] = (id, quantity) => {
  updateItems((prev) =>
    prev.map((item) => (item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item))
  );
};

const removeItem: CartContextValue["removeItem"] = (id) => {
  updateItems((prev) => prev.filter((item) => item.id !== id));
};

const clearCart: CartContextValue["clearCart"] = () => {
  setItems(EMPTY_CART);
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useCart(): CartContextValue {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    items,
    addPremadeItem,
    addCustomItem,
    updateCustomItem,
    updateQuantity,
    removeItem,
    clearCart,
  };
}
