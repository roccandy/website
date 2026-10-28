import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/Toast";
import { AdminBodyAttributes } from "@/app/admin/AdminBodyAttributes";
import { AdminBirthdayRefresh } from "@/app/admin/AdminBirthdayRefresh";
import { AdminQueryToast } from "@/app/admin/AdminQueryToast";
import { AdminScrollRestoration } from "@/app/admin/AdminScrollRestoration";
import { AdminUnsavedChanges } from "./AdminUnsavedChanges";
import {
  buildAdminNavSections,
  isProductionUser,
} from "@/app/admin/adminNavigation";
import { getAdminSession } from "@/lib/adminAuth";
import { getAdminUserById } from "@/lib/adminUsers";
import {
  AdminNavigationProvider,
  AdminPageContent,
} from "./AdminNavigationFeedback";
import { AdminWorkspaceHeader } from "./AdminWorkspaceHeader";
import { getCachedProductionDay } from "./adminReadModels";
import { isVisibleOnPremadeOrders } from "./orders/scheduleVisibility";

const PAYMENTS_SANDBOX_MODE =
  (process.env.NEXT_PUBLIC_SQUARE_ENV ?? "production").toLowerCase() ===
    "sandbox" ||
  (process.env.NEXT_PUBLIC_PAYPAL_ENV ?? "production").toLowerCase() ===
    "sandbox";

function isBirthdayToday(birthday: string | null | undefined) {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return false;
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Perth",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
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
      {
        url: "/branding/admin-favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/branding/admin-favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      { url: "/branding/admin-favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: [{ url: "/branding/admin-favicon.ico" }],
    apple: [
      {
        url: "/branding/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
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

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
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

  const signedInDisplay =
    session.user.name?.trim() || session.user.email?.trim() || "Signed in";
  const signedInUser = session.user.isBootstrap
    ? null
    : await getAdminUserById(session.user.id);
  const birthdayGreeting = isBirthdayToday(signedInUser?.birthday)
    ? `Happy birthday ${signedInUser?.display_name?.trim() || signedInDisplay} ✦`
    : null;
  const navSections = buildAdminNavSections(session.user);
  const productionUser = isProductionUser(session.user);
  const activePremadeCount =
    !productionUser && session.user.role !== "seo"
      ? (await getCachedProductionDay()).orders.filter(isVisibleOnPremadeOrders).length
      : 0;

  return (
    <AdminNavigationProvider>
      <ToastProvider>
        <AdminBodyAttributes />
        <AdminBirthdayRefresh />
        <AdminUnsavedChanges />
        <AdminQueryToast />
        <AdminScrollRestoration />
        <div className="admin-workspace min-h-screen min-w-0 bg-zinc-50 text-zinc-900 print:min-h-0 print:bg-white">
          <a
            href="#admin-main"
            className="sr-only z-[100] rounded-lg bg-emerald-900 px-4 py-3 text-sm text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
          >
            Skip to page content
          </a>
          <AdminWorkspaceHeader
            user={session.user}
            sections={navSections}
            birthdayGreeting={birthdayGreeting}
            activePremadeCount={activePremadeCount}
          />
          {PAYMENTS_SANDBOX_MODE && (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-[11px] font-medium text-amber-800 sm:px-6 print:hidden">
              Sandbox mode · payments are test-only in this environment
            </div>
          )}
          {!productionUser && !session.user.canWrite && (
            <div className="border-b border-sky-100 bg-sky-50/70 px-4 py-1.5 text-[11px] text-sky-800 sm:px-6 print:hidden">
              {session.user.canWriteSeo
                ? "SEO access · website content is editable; operations are view-only."
                : "Read-only access · you can view this workspace. Changes are disabled."}
            </div>
          )}
          <div className="admin-page-shell w-full min-w-0 px-4 py-5 sm:px-6 sm:py-6 print:px-0 print:py-0">
            <main
              id="admin-main"
              tabIndex={-1}
              className="admin-page-content min-w-0 w-full outline-none print:w-full"
            >
              <AdminPageContent>{children}</AdminPageContent>
            </main>
          </div>
        </div>
      </ToastProvider>
    </AdminNavigationProvider>
  );
}
