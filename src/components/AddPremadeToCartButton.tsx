"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@mdi/react";
import { mdiCartArrowDown } from "@mdi/js";
import { useCart } from "@/components/CartProvider";

type PremadeInput = {
  premadeId: string;
  name: string;
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
          <Icon path={mdiCartArrowDown} size={1.4} color="#ffffff" aria-hidden="true" />
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
