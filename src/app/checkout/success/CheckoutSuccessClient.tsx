"use client";

import { useEffect } from "react";
import { useCart } from "@/components/CartProvider";

export function CheckoutSuccessClient() {
  const { clearCart } = useCart();

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return null;
}
