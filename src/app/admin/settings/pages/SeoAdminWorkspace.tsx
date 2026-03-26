"use client";

import { useState, type ReactNode } from "react";

type TabId = "pages" | "productPages";

type Props = {
  pageCount: number;
  productCount: number;
  pages: ReactNode;
  productPages: ReactNode;
};

const TAB_ORDER: Array<{ id: TabId; label: string }> = [
  { id: "pages", label: "Site Pages" },
  { id: "productPages", label: "Product SEO" },
];

export function SeoAdminWorkspace({
  pageCount,
  productCount,
  pages,
  productPages,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("pages");

  const metaByTab: Record<TabId, string> = {
    pages: `${pageCount} pages`,
    productPages: `${productCount} products`,
  };

  const panelByTab: Record<TabId, ReactNode> = {
    pages,
    productPages,
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">SEO Workspace</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {TAB_ORDER.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  isActive
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                <div className="text-sm font-semibold">{tab.label}</div>
                <div className={`text-xs ${isActive ? "text-white/75" : "text-zinc-500"}`}>{metaByTab[tab.id]}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-w-0">{panelByTab[activeTab]}</div>
    </div>
  );
}
