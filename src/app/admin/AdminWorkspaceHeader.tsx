"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Session } from "next-auth";
import {
  ArrowUpRight,
  ChevronDown,
  Grid2X2,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  AdminLink,
  AdminTabLink,
  AdminOrderSearch,
  useAdminNavigation,
} from "./AdminNavigationFeedback";
import {
  getAdminPrimaryNavigation,
  type AdminNavSection,
} from "./adminNavigation";
import { LogoutButton } from "./LogoutButton";

export function AdminWorkspaceHeader({
  user,
  sections,
  birthdayGreeting,
}: {
  user: Session["user"];
  sections: AdminNavSection[];
  birthdayGreeting: string | null;
}) {
  const pathname = usePathname();
  const navigation = useAdminNavigation();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const toolsButton = useRef<HTMLButtonElement>(null);
  const accountMenu = useRef<HTMLDetailsElement>(null);
  const primary = getAdminPrimaryNavigation(user);
  const displayName = user.name?.trim() || user.email?.trim() || "Your account";
  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        `${item.label} ${item.description}`
          .toLowerCase()
          .includes(query.toLowerCase().trim()),
      ),
    }))
    .filter((section) => section.items.length);
  const closeTools = () => setToolsOpen(false);
  useEffect(() => {
    const closeForDraftPrompt = () => { dialog.current?.close(); if (accountMenu.current) accountMenu.current.open = false; setToolsOpen(false); };
    window.addEventListener("admin:unsaved-prompt", closeForDraftPrompt);
    return () => window.removeEventListener("admin:unsaved-prompt", closeForDraftPrompt);
  }, []);

  useEffect(() => {
    if (toolsOpen) {
      dialog.current?.showModal();
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previous;
      };
    }
    if (dialog.current?.open) {
      dialog.current.close();
      toolsButton.current?.focus();
    }
  }, [toolsOpen]);

  return (
    <>
      <header className="admin-workspace-header sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur print:hidden">
        {birthdayGreeting && (
          <div className="border-b border-rose-100 bg-rose-50 px-4 py-1 text-center text-[11px] font-medium text-rose-700">
            {birthdayGreeting}
          </div>
        )}
        <div className="flex h-16 min-w-0 items-center justify-between gap-3 px-4 sm:px-6">
          <AdminLink
            href={user.role === "production" ? "/admin/production" : "/admin"}
            className="flex min-w-0 items-center gap-3"
            aria-label="Roc Candy admin home"
          >
            <Image
              src="/branding/logo-gold.svg"
              width={42}
              height={42}
              alt="Roc Candy"
              className="h-9 w-9 shrink-0"
              priority
            />
            <span className="hidden min-w-0 sm:block lg:hidden xl:block">
              <span className="block text-sm font-semibold tracking-tight text-zinc-900">
                Roc Candy
              </span>
              <span className="block text-[10px] tracking-wide text-zinc-400">
                Your business workspace
              </span>
            </span>
          </AdminLink>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
            <div id="admin-header-notices" className="admin-notice-anchor" />
            <AdminOrderSearch />
            {user.canWrite && (
              <AdminLink
                href="/admin/orders/new"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-900"
              >
                <Plus size={15} />
                <span className="hidden min-[420px]:inline">New order</span>
                <span className="min-[420px]:hidden">New</span>
              </AdminLink>
            )}
            <details ref={accountMenu} className="relative">
              <summary
                className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-2 text-xs text-zinc-600 hover:bg-zinc-50 [&::-webkit-details-marker]:hidden"
                aria-label="Your account"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
                  {displayName.charAt(0).toUpperCase()}
                </span>
                <span className="hidden max-w-32 truncate xl:block">
                  {displayName}
                </span>
                <ChevronDown size={12} />
              </summary>
              <div className="absolute right-0 top-full z-[120] mt-2 w-60 rounded-xl border border-zinc-200 bg-white p-4 shadow-lg">
                <p className="break-words text-sm font-semibold text-zinc-800">
                  {displayName}
                </p>
                <p className="mt-1 text-xs capitalize text-zinc-500">
                  {user.role} access
                </p>
                {user.role !== "production" && (
                  <AdminLink
                    href="/admin/settings/password"
                    className="my-3 block text-xs text-emerald-800 hover:underline"
                  >
                    Change password
                  </AdminLink>
                )}
                <LogoutButton />
              </div>
            </details>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2 border-t border-zinc-100 px-3 sm:px-6">
          <nav
            aria-label="Main admin navigation"
            className="flex min-w-0 flex-1 gap-1 overflow-x-auto"
          >
            {primary.map((item) => {
              const active =
                pathname === item.href ||
                (item.href === "/admin/customers" &&
                  pathname.startsWith("/admin/customers/"));
              const opening =
                navigation?.destination?.split(/[?#]/)[0] === item.href;
              return (
                <AdminTabLink
                  eager
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-busy={opening}
                  className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-xs font-medium transition sm:px-4 sm:text-sm ${active || opening ? "border-emerald-800 text-emerald-900" : "border-transparent text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"}`}
                >
                  {item.label}
                  {opening && (
                    <span
                      aria-label="Opening"
                      className="h-2 w-2 rounded-full bg-emerald-500 motion-safe:animate-pulse"
                    />
                  )}
                </AdminTabLink>
              );
            })}
          </nav>
          {pathname === "/admin/orders" ? (
            <AdminLink
              href="/admin/settings/production"
              className="inline-flex shrink-0 items-center rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              Production settings
            </AdminLink>
          ) : null}
          <button
            ref={toolsButton}
            type="button"
            onClick={() => {
              setQuery("");
              setToolsOpen(true);
            }}
            aria-haspopup="dialog"
            aria-expanded={toolsOpen}
            aria-controls="admin-all-tools"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
          >
            <Grid2X2 size={15} />
            <span className="hidden sm:inline">All tools</span>
            <span className="sm:hidden">Tools</span>
          </button>
        </div>
      </header>
      <dialog
        ref={dialog}
        id="admin-all-tools"
        aria-labelledby="admin-tools-title"
        onCancel={closeTools}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            closeTools();
          }
        }}
        onClick={(event) => {
          if (
            event.target === event.currentTarget &&
            event.clientX < event.currentTarget.getBoundingClientRect().left
          )
            closeTools();
        }}
        className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-full max-w-[30rem] border-0 border-l border-zinc-200 bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-zinc-950/30"
      >
        <div className="flex h-full min-w-0 flex-col">
          <div className="border-b border-zinc-100 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id="admin-tools-title" className="text-lg font-semibold">
                  All tools
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Everything you need, out of the way until you need it.
                </p>
              </div>
              <button
                type="button"
                onClick={closeTools}
                aria-label="Close tools"
                className="rounded-lg p-2 hover:bg-zinc-100"
              >
                <X size={19} />
              </button>
            </div>
            <label className="relative mt-4 block">
              <span className="sr-only">Find an admin tool</span>
              <Search
                size={15}
                className="absolute left-3 top-3 text-zinc-400"
              />
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find pricing, packaging, website settings…"
                className="w-full min-w-0 rounded-lg border border-zinc-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>
          <nav
            aria-label="All admin tools"
            className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5"
          >
            {visibleSections.map((section) => (
              <section key={section.key}>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                  {section.label}
                </h3>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <AdminTabLink
                      key={item.href}
                      href={item.href}
                      onClick={closeTools}
                      aria-current={pathname === item.href ? "page" : undefined}
                      className={`group flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 ${pathname === item.href ? "bg-emerald-50 text-emerald-900" : "text-zinc-700 hover:bg-zinc-50"}`}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {item.label}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-4 text-zinc-400">
                          {item.description}
                        </span>
                      </span>
                      <ArrowUpRight
                        size={14}
                        className="shrink-0 text-zinc-300 group-hover:text-emerald-700"
                      />
                    </AdminTabLink>
                  ))}
                </div>
              </section>
            ))}
            {!visibleSections.length && (
              <p className="py-10 text-center text-sm text-zinc-500">
                No matching tools. Try another word.
              </p>
            )}
          </nav>
        </div>
      </dialog>
    </>
  );
}
