"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type AdminNavSection,
  getAdminNavToneClasses,
  isSeoFocusedUser,
  isSeoEditableAdminHref,
} from "@/app/admin/adminNavigation";
import type { Session } from "next-auth";

type AdminSidebarProps = {
  sections: AdminNavSection[];
  user: Session["user"];
};

export function AdminSidebar({ sections, user }: AdminSidebarProps) {
  const pathname = usePathname();
  const seoFocused = isSeoFocusedUser(user);

  return (
    <aside className="hidden lg:block lg:w-80 lg:flex-none">
      <div className="sticky top-24 space-y-4">
        <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
            {seoFocused ? "SEO Workspace" : "Admin Navigation"}
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {seoFocused
              ? "Your main editing area is Content & SEO. Other admin pages stay available, but they are view-only."
              : "Everything stays in its existing location. Navigation is now grouped by workflow instead of a flat list."}
          </p>
        </div>

        {sections.map((section) => {
          const toneClasses = getAdminNavToneClasses(section.tone);
          const isPrimarySection = !seoFocused || section.key === "content-seo";

          return (
            <div
              key={section.key}
              className={`rounded-3xl border bg-gradient-to-br p-4 shadow-sm transition ${
                isPrimarySection
                  ? `${toneClasses.border} ${toneClasses.panel}`
                  : "border-zinc-200 from-white via-white to-zinc-50 opacity-80"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className={`text-sm font-semibold ${isPrimarySection ? "text-zinc-900" : "text-zinc-800"}`}>
                    {section.label}
                  </p>
                  <p className="text-xs leading-5 text-zinc-500">{section.description}</p>
                </div>
                {seoFocused && section.key === "content-seo" ? (
                  <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${toneClasses.badge}`}>
                    Recommended
                  </span>
                ) : null}
                {seoFocused && section.key !== "content-seo" ? (
                  <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    View only
                  </span>
                ) : null}
              </div>
              <div className="mt-4 space-y-2">
                {section.items.map((item) => {
                  const active = pathname === item.href;
                  const writable = user.canWrite || (user.canWriteSeo && isSeoEditableAdminHref(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block rounded-2xl border px-3 py-3 transition ${
                        active
                          ? `${toneClasses.border} bg-white shadow-sm`
                          : "border-transparent bg-white/75 hover:border-zinc-200 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-zinc-900">{item.label}</p>
                          <p className="text-xs leading-5 text-zinc-500">{item.description}</p>
                        </div>
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                            active
                              ? toneClasses.badge
                              : writable
                                ? toneClasses.badgeMuted
                                : "border-zinc-200 bg-white text-zinc-500"
                          }`}
                        >
                          {active ? "Open" : writable ? "Edit" : "View"}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
