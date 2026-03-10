"use client";

import { useState, type ReactNode } from "react";

type TabId = "overview" | "builtIn" | "newPage" | "managed" | "redirects" | "mediaLibrary";

type Props = {
  builtInCount: number;
  managedCount: number;
  redirectCount: number;
  imageCount: number;
  canWriteSeo: boolean;
  overview: ReactNode;
  builtIn: ReactNode;
  newPage: ReactNode;
  managed: ReactNode;
  redirects: ReactNode;
  mediaLibrary: ReactNode;
};

const TAB_ORDER: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "builtIn", label: "Built-in Pages" },
  { id: "newPage", label: "Create Page" },
  { id: "managed", label: "Managed Pages" },
  { id: "redirects", label: "Redirects" },
  { id: "mediaLibrary", label: "Media Library" },
];

export function SeoAdminWorkspace({
  builtInCount,
  managedCount,
  redirectCount,
  imageCount,
  canWriteSeo,
  overview,
  builtIn,
  newPage,
  managed,
  redirects,
  mediaLibrary,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("builtIn");

  const metaByTab: Record<TabId, string> = {
    overview: "Guide",
    builtIn: `${builtInCount} pages`,
    newPage: canWriteSeo ? "Writable" : "Read-only",
    managed: `${managedCount} pages`,
    redirects: `${redirectCount} rules`,
    mediaLibrary: `${imageCount} images`,
  };

  const panelByTab: Record<TabId, ReactNode> = {
    overview,
    builtIn,
    newPage,
    managed,
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
