import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdminSidebar } from "@/app/admin/AdminSidebar";
import { ToastProvider } from "@/components/Toast";
import { LogoutButton } from "@/app/admin/LogoutButton";
import { AdminBodyAttributes } from "@/app/admin/AdminBodyAttributes";
import { AdminBirthdayRefresh } from "@/app/admin/AdminBirthdayRefresh";
import { AdminNav } from "@/app/admin/AdminNav";
import { AdminQueryToast } from "@/app/admin/AdminQueryToast";
import { AdminScrollRestoration } from "@/app/admin/AdminScrollRestoration";
import { buildAdminNavSections, isProductionUser } from "@/app/admin/adminNavigation";
import { getAdminSession } from "@/lib/adminAuth";
import { getAdminUserById } from "@/lib/adminUsers";

const PAYMENTS_SANDBOX_MODE =
  (process.env.NEXT_PUBLIC_SQUARE_ENV ?? "production").toLowerCase() === "sandbox" ||
  (process.env.NEXT_PUBLIC_PAYPAL_ENV ?? "production").toLowerCase() === "sandbox";

function isBirthdayToday(birthday: string | null | undefined) {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return false;
  const parts = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Perth", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return Boolean(month && day && birthday.slice(5) === `${month}-${day}`);
}

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
  const signedInUser = session.user.isBootstrap ? null : await getAdminUserById(session.user.id);
  const birthdayGreeting = isBirthdayToday(signedInUser?.birthday) ? `Happy birthday ${signedInUser?.display_name?.trim() || signedInDisplay} ✦` : null;
  const navSections = buildAdminNavSections(session.user);
  const productionUser = isProductionUser(session.user);
  const productionHref = productionUser ? "/admin/production" : "/admin/orders";

  return (
    <ToastProvider>
      <AdminBodyAttributes />
      <AdminBirthdayRefresh />
      <AdminQueryToast />
      <AdminScrollRestoration />
      <div className="min-h-screen bg-zinc-100 text-zinc-900 print:min-h-0 print:bg-white">
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur print:hidden">
          {birthdayGreeting ? (
            <div
              className="overflow-hidden border-b border-rose-100 bg-rose-50/70 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-500"
              aria-label={birthdayGreeting}
            >
              <div className="admin-birthday-banner inline-flex min-w-max gap-16 whitespace-nowrap">
                <span>{birthdayGreeting}</span>
                <span aria-hidden="true">{birthdayGreeting}</span>
                <span aria-hidden="true">{birthdayGreeting}</span>
              </div>
            </div>
          ) : null}
          <div className="mx-auto flex max-w-[92rem] items-center justify-between gap-4 px-4 py-4 lg:px-6">
            <div className="flex items-center gap-3">
              <Link href="/admin" className="shrink-0 transition hover:opacity-80" aria-label="Roc Candy admin home">
                <Image src="/branding/logo-gold.svg" alt="Roc Candy" width={124} height={124} className="h-10 w-auto" priority />
              </Link>
            </div>
            <AdminNav sections={navSections} />
            <div className="flex items-center gap-3">
              <form action="/admin/orders/archived" method="get" className="hidden items-center lg:flex">
                <label className="sr-only" htmlFor="admin-header-order-search">
                  Search orders
                </label>
                <input
                  id="admin-header-order-search"
                  type="search"
                  name="q"
                  placeholder="Search orders"
                  className="w-36 rounded-l-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none lg:w-44"
                />
                <button
                  type="submit"
                  className="rounded-r-md border border-l-0 border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300 hover:text-zinc-900"
                >
                  Search
                </button>
              </form>
              <Link
                href={productionHref}
                className="hidden rounded-md border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300 hover:text-zinc-900 lg:inline-flex"
              >
                Production
              </Link>
              {session.user.canWrite ? (
                <Link
                  href="/admin/orders/new"
                  className="hidden rounded-md bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 lg:inline-flex"
                >
                  New order
                </Link>
              ) : null}
              <p className="max-w-36 truncate text-sm font-medium text-zinc-700" title={signedInDisplay}>
                {signedInDisplay}
              </p>
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
        {!productionUser && !session.user.canWrite && !session.user.canWriteSeo ? (
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
        <div className="admin-page-shell mx-auto flex max-w-[92rem] gap-6 px-4 py-6 lg:px-6 print:block print:max-w-none print:px-0 print:py-0">
          {!productionUser ? <AdminSidebar sections={navSections} user={session.user} /> : null}
          <main className="min-w-0 flex-1 print:w-full">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
