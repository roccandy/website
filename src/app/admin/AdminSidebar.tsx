"use client";

import { AdminLink as Link } from "@/app/admin/AdminNavigationFeedback";
import { usePathname } from "next/navigation";
import {
  type AdminNavSection,
  getAdminNavToneClasses,
  isSeoFocusedUser,
  isSeoEditableAdminHref,
  isSelfServiceAdminHref,
} from "@/app/admin/adminNavigation";
import type { Session } from "next-auth";
import { useAdminNavigation } from "./AdminNavigationFeedback";

type AdminSidebarProps = {
  sections: AdminNavSection[];
  user: Session["user"];
};

export function AdminSidebar({ sections, user }: AdminSidebarProps) {
  const pathname = usePathname();
  const seoFocused = isSeoFocusedUser(user);
  const navigation = useAdminNavigation();

  return (
    <aside className="hidden print:hidden lg:sticky lg:top-24 lg:block lg:h-[calc(100vh-7rem)] lg:w-64 lg:flex-none lg:self-start">
      <div className="h-full space-y-3 overflow-y-auto pr-1">
        {sections.map((section) => {
          const toneClasses = getAdminNavToneClasses(section.tone);
          const isPrimarySection = !seoFocused || section.key === "content-seo";

          return (
            <div
              key={section.key}
              className={`rounded-3xl border bg-gradient-to-br p-3 shadow-sm transition ${
                isPrimarySection
                  ? `${toneClasses.border} ${toneClasses.panel}`
                  : "border-zinc-200 from-zinc-50 via-zinc-50 to-white opacity-65"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className={`text-sm font-semibold ${isPrimarySection ? "text-zinc-900" : "text-zinc-800"}`}>{section.label}</p>
                {seoFocused && section.key === "content-seo" ? (
                  <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${toneClasses.badge}`}>
                    SEO
                  </span>
                ) : null}
                {seoFocused && section.key !== "content-seo" ? (
                  <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    View
                  </span>
                ) : null}
              </div>
              <div className="mt-3 space-y-1.5">
                {section.items.map((item) => {
                  const active = pathname === item.href;
                  const opening = navigation?.destination?.split(/[?#]/)[0] === item.href;
                  const writable =
                    isSelfServiceAdminHref(item.href) ||
                    user.canWrite ||
                    (user.canWriteSeo && isSeoEditableAdminHref(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-busy={opening}
                      className={`block rounded-2xl border px-3 py-2.5 transition ${
                        active || opening
                          ? `${toneClasses.border} bg-white shadow-sm`
                          : "border-transparent bg-white/75 hover:border-zinc-200 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-zinc-900">{item.label}</p>
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                            active || opening
                              ? toneClasses.badge
                              : writable
                                ? toneClasses.badgeMuted
                                : "border-zinc-200 bg-white text-zinc-500"
                          }`}
                        >
                          {opening ? "Opening…" : active ? "Open" : writable ? "Edit" : "View"}
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
