"use client";

import { useCart } from "@/components/CartProvider";
import { trackAddToCart } from "@/lib/analyticsEvents";
import { requestCartDrawerOpen } from "@/lib/cartDrawer";

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
  variant?: "icon" | "labelled";
};

export function AddPremadeToCartButton({ item, className = "", variant = "icon" }: Props) {
  const { addPremadeItem } = useCart();

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
    requestCartDrawerOpen();
  };

  return (
    <button
      type="button"
      data-plain-button
      onClick={handleClick}
      aria-label={`Add ${item.name} to cart`}
      className={className}
    >
      <span
        className={
          variant === "labelled"
            ? "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[#ff6f95] bg-[#ff6f95] px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:border-[#ff4f80] hover:bg-[#ff4f80]"
            : "inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#ff6f95] bg-[#ff6f95] text-white shadow-sm transition hover:border-[#ff4f80] hover:bg-[#ff4f80]"
        }
      >
        <svg
          viewBox="0 0 24 24"
          className={variant === "labelled" ? "h-5 w-5" : "h-6 w-6"}
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2Zm10 0c-1.1 0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2ZM7.17 14h9.95c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 21.58 5H6.21l-.94-2H2v2h1.73l3.6 7.59-1.35 2.45A2 2 0 0 0 7.7 18H20v-2H7.7l1.1-2ZM13 4h-2v3H8l4 4 4-4h-3V4Z"
          />
        </svg>
        {variant === "labelled" ? <span>Add to cart</span> : null}
      </span>
    </button>
  );
}
