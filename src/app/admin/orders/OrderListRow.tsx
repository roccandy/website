"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAdminNavigation } from "../AdminNavigationFeedback";

/** Keep native links and action controls independent of the row shortcut. */
export function OrderListRow({ orderId, children }: { orderId: string; children: ReactNode }) {
  const navigation = useAdminNavigation();
  const router = useRouter();
  return (
    <tr
      className="admin-order-history-row cursor-pointer bg-white hover:bg-emerald-50/40 focus-within:bg-emerald-50/40"
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const target = event.target;
        // Portalled menus bubble through React, but are not part of this row.
        if (!(target instanceof Element) || !event.currentTarget.contains(target)) return;
        if (target.closest("a,button,input,select,textarea,label,summary,[role='button'],[role='menu'],[data-row-actions]")) return;
        if (window.getSelection()?.toString()) return;
        const href = `/admin/orders/${encodeURIComponent(orderId)}`;
        if (navigation) navigation.navigate(href);
        else router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
