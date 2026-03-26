"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  type AdminNavSection,
  flattenAdminNavItems,
  getAdminNavToneClasses,
} from "@/app/admin/adminNavigation";

type AdminQuickSearchProps = {
  sections: AdminNavSection[];
};

export function AdminQuickSearch({ sections }: AdminQuickSearchProps) {
  const [query, setQuery] = useState("");
  const items = useMemo(() => flattenAdminNavItems(sections), [sections]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return items.slice(0, 6);
    }

    return items
      .filter((item) => {
        const haystack = `${item.label} ${item.description} ${item.sectionLabel}`.toLowerCase();
        return haystack.includes(normalized);
      })
      .slice(0, 8);
  }, [items, query]);

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-zinc-900">Find a page fast</p>
      <label className="mt-4 block">
        <span className="sr-only">Find admin page</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search pages, pricing, FAQs, packaging..."
          className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-300 focus:bg-white"
        />
      </label>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {results.length ? (
          results.map((item) => {
            const toneClasses = getAdminNavToneClasses(item.sectionTone);

            return (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-zinc-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-zinc-900">{item.label}</p>
                  <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${toneClasses.badgeMuted}`}>
                    {item.sectionLabel}
                  </span>
                </div>
              </Link>
            );
          })
        ) : (
          <div className="sm:col-span-2 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
            No matching admin page found.
          </div>
        )}
      </div>
    </div>
  );
}
