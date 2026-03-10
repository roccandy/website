"use client";

import { useState, type ReactNode } from "react";

type TabId = "overview" | "pages" | "redirects" | "mediaLibrary";

type Props = {
  pageCount: number;
  redirectCount: number;
  imageCount: number;
  overview: ReactNode;
  pages: ReactNode;
  redirects: ReactNode;
  mediaLibrary: ReactNode;
};

const TAB_ORDER: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "pages", label: "Site Pages" },
  { id: "redirects", label: "Redirects" },
  { id: "mediaLibrary", label: "Media Library" },
];

export function SeoAdminWorkspace({
  pageCount,
  redirectCount,
  imageCount,
  overview,
  pages,
  redirects,
  mediaLibrary,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("pages");

  const metaByTab: Record<TabId, string> = {
    overview: "Guide",
    pages: `${pageCount} pages`,
    redirects: `${redirectCount} rules`,
    mediaLibrary: `${imageCount} images`,
  };

  const panelByTab: Record<TabId, ReactNode> = {
    overview,
    pages,
    redirects,
    mediaLibrary,
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
