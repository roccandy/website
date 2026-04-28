import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdminSidebar } from "@/app/admin/AdminSidebar";
import { ToastProvider } from "@/components/Toast";
import { LogoutButton } from "@/app/admin/LogoutButton";
import { AdminBodyAttributes } from "@/app/admin/AdminBodyAttributes";
import { AdminNav } from "@/app/admin/AdminNav";
import { AdminQueryToast } from "@/app/admin/AdminQueryToast";
import { AdminScrollRestoration } from "@/app/admin/AdminScrollRestoration";
import { buildAdminNavSections, isProductionUser, isSeoFocusedUser } from "@/app/admin/adminNavigation";
import { getAdminSession } from "@/lib/adminAuth";

const PAYMENTS_SANDBOX_MODE =
  (process.env.NEXT_PUBLIC_SQUARE_ENV ?? "production").toLowerCase() === "sandbox" ||
  (process.env.NEXT_PUBLIC_PAYPAL_ENV ?? "production").toLowerCase() === "sandbox";

export const metadata: Metadata = {
  title: "Roc Candy Admin",
  description: "Roc Candy admin panel",
  icons: {
    icon: [
      { url: "/branding/admin-favicon.ico", sizes: "any" },
      { url: "/branding/admin-favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/branding/admin-favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/branding/admin-favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: [{ url: "/branding/admin-favicon.ico" }],
    apple: [{ url: "/branding/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession();

  if (!session) {
    return (
      <ToastProvider>
        <AdminBodyAttributes />
        <AdminQueryToast />
        <AdminScrollRestoration />
        <div className="min-h-screen bg-white text-zinc-900">{children}</div>
      </ToastProvider>
    );
  }

  const signedInDisplay = session.user.name?.trim() || session.user.email?.trim() || "Signed in";
  const navSections = buildAdminNavSections(session.user);
  const seoFocused = isSeoFocusedUser(session.user);
  const productionUser = isProductionUser(session.user);
  const roleLabel =
    session.user.role === "admin"
      ? "Full admin"
      : session.user.role === "editor"
        ? "Editor"
        : session.user.role === "seo"
          ? "SEO editor"
          : session.user.role === "production"
            ? "Production"
            : "Viewer";

  return (
    <ToastProvider>
      <AdminBodyAttributes />
      <AdminQueryToast />
      <AdminScrollRestoration />
      <div className="min-h-screen bg-zinc-100 text-zinc-900 print:min-h-0 print:bg-white">
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur print:hidden">
          <div className="mx-auto flex max-w-[92rem] items-center justify-between gap-4 px-4 py-4 lg:px-6">
            <div className="flex items-center gap-3">
              <Link href="/admin" className="text-sm font-semibold text-zinc-900 transition hover:text-zinc-700">
                {seoFocused ? "SEO Workspace" : productionUser ? "Production" : "Roc Candy Admin"}
              </Link>
              <span className="hidden text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 md:inline-flex">
                {roleLabel}
              </span>
              {seoFocused ? (
                <Link
                  href="/admin/settings/pages"
                  className="hidden text-xs font-semibold text-rose-700 transition hover:text-rose-900 lg:inline-flex"
                >
                  Open Site Pages & SEO
                </Link>
              ) : null}
            </div>
            <AdminNav sections={navSections} />
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-right leading-tight">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Signed in</p>
                <p className="text-xs font-medium normal-case text-zinc-700">{signedInDisplay}</p>
              </div>
              {!productionUser ? (
                <Link
                  href="/admin/stats"
                  title="Open the secret stats room"
                  aria-label="Open the secret stats room"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-sm text-zinc-400 transition hover:border-zinc-300 hover:bg-white hover:text-zinc-700"
                >
                  <span aria-hidden="true">◔</span>
                </Link>
              ) : null}
              <LogoutButton />
            </div>
          </div>
        </header>
        {PAYMENTS_SANDBOX_MODE ? (
          <div className="border-b border-amber-300 bg-amber-50 print:hidden">
            <div className="mx-auto max-w-[92rem] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-800 lg:px-6">
              Sandbox mode active: payments are test-only in this environment
            </div>
          </div>
        ) : null}
        {productionUser ? (
          <div className="border-b border-amber-300 bg-amber-50 print:hidden">
            <div className="mx-auto max-w-[92rem] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-800 lg:px-6">
              Production access: this user can view this week and next week orders and print order sheets only
            </div>
          </div>
        ) : !session.user.canWrite && !session.user.canWriteSeo ? (
          <div className="border-b border-sky-300 bg-sky-50 print:hidden">
            <div className="mx-auto max-w-[92rem] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-800 lg:px-6">
              Read-only access: this user can view admin pages but cannot make changes beyond their own password
            </div>
          </div>
        ) : null}
        {!session.user.canWrite && session.user.canWriteSeo ? (
          <div className="border-b border-emerald-300 bg-emerald-50 print:hidden">
            <div className="mx-auto max-w-[92rem] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800 lg:px-6">
              SEO editor access: content & SEO pages, blog posts, FAQs, privacy, and terms are writable. Other admin areas are read-only, aside from their own password.
            </div>
          </div>
        ) : null}
        <div className="mx-auto flex max-w-[92rem] gap-6 px-4 py-6 lg:px-6 print:block print:max-w-none print:px-0 print:py-0">
          <AdminSidebar sections={navSections} user={session.user} />
          <main className="min-w-0 flex-1 print:w-full">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
