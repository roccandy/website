"use client";

import { useEffect } from "react";
import { trackViewItem } from "@/lib/analyticsEvents";

type Props = {
  itemId: string;
  itemName: string;
  itemVariant?: string;
  price: number;
};

export function PremadeItemAnalytics({ itemId, itemName, itemVariant, price }: Props) {
  useEffect(() => {
    trackViewItem({
      currency: "AUD",
      value: price,
      items: [
        {
          item_id: itemId,
          item_name: itemName,
          item_category: "pre-made-candy",
          item_variant: itemVariant,
          item_brand: "Roc Candy",
          price,
          quantity: 1,
        },
      ],
    });
  }, [itemId, itemName, itemVariant, price]);

  return null;
}
