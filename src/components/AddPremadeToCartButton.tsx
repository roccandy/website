"use client";

import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/CartProvider";
import { trackAddToCart } from "@/lib/analyticsEvents";

type PremadeInput = {
  premadeId: string;
  name: string;
  flavor?: string;
  price: number;
  weight_g: number;
  imageUrl?: string;
};

type Props = {
  item: PremadeInput;
  className?: string;
};

function formatWeight(weight_g: number) {
  if (!Number.isFinite(weight_g)) return "";
  if (weight_g >= 1000) {
    const kg = weight_g / 1000;
    return `${kg % 1 === 0 ? kg.toFixed(0) : kg.toFixed(1)}kg`;
  }
  return `${weight_g}g`;
}

export function AddPremadeToCartButton({ item, className = "" }: Props) {
  const { addPremadeItem } = useCart();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastKey, setToastKey] = useState(0);
  const timeoutRef = useRef<number | null>(null);
  const clearRef = useRef<number | null>(null);

  const handleClick = () => {
    addPremadeItem({ ...item, quantity: 1 });
    trackAddToCart({
      currency: "AUD",
      value: item.price,
      items: [
        {
          item_id: item.premadeId,
          item_name: item.name,
          item_category: "pre-made-candy",
          item_variant: item.flavor,
          item_brand: "Roc Candy",
          price: item.price,
          quantity: 1,
        },
      ],
    });
    const weightLabel = formatWeight(item.weight_g);
    const message = `${weightLabel ? `${weightLabel} ` : ""}${item.name} added to cart`;
    setToastMessage(message);
    setToastVisible(true);
    setToastKey((prev) => prev + 1);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    if (clearRef.current) window.clearTimeout(clearRef.current);
    timeoutRef.current = window.setTimeout(() => setToastVisible(false), 4200);
    clearRef.current = window.setTimeout(() => setToastMessage(null), 5200);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      if (clearRef.current) window.clearTimeout(clearRef.current);
    };
  }, []);

  return (
    <>
      <button
        type="button"
        data-plain-button
        onClick={handleClick}
        aria-label={`Add ${item.name} to cart`}
        className={className}
      >
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#ff6f95] bg-[#ff6f95] text-white shadow-sm">
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
            <path
              fill="currentColor"
              d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2Zm10 0c-1.1 0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2ZM7.17 14h9.95c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 21.58 5H6.21l-.94-2H2v2h1.73l3.6 7.59-1.35 2.45A2 2 0 0 0 7.7 18H20v-2H7.7l1.1-2ZM13 4h-2v3H8l4 4 4-4h-3V4Z"
            />
          </svg>
        </span>
      </button>
      {toastMessage ? (
        <span
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2"
        >
          <span
            key={toastKey}
            className={`toast-pop block rounded-full bg-emerald-500 px-6 py-3 text-base font-semibold text-white shadow-lg transition-opacity duration-[1500ms] ease-out ${
              toastVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            {toastMessage}
          </span>
        </span>
      ) : null}
    </>
  );
}
