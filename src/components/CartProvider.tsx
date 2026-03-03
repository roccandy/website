"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "roccandy-cart-v1";

export type PremadeCartItem = {
  id: string;
  type: "premade";
  premadeId: string;
  name: string;
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
  updateQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function createCartId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readStoredCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(readStoredCart());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addPremadeItem = useCallback(
    (item: Omit<PremadeCartItem, "id" | "type" | "quantity"> & { quantity?: number }) => {
      setItems((prev) => {
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
          price: item.price,
          weight_g: item.weight_g,
          imageUrl: item.imageUrl,
          quantity: item.quantity ?? 1,
        };
        return [...prev, next];
      });
    },
    []
  );

  const addCustomItem = useCallback((item: Omit<CustomCartItem, "id" | "type">) => {
    setItems((prev) => [
      ...prev,
      {
        id: item.orderId || createCartId("custom"),
        type: "custom",
        ...item,
      },
    ]);
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item))
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({ items, addPremadeItem, addCustomItem, updateQuantity, removeItem, clearCart }),
    [items, addPremadeItem, addCustomItem, updateQuantity, removeItem, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider.");
  }
  return ctx;
}
