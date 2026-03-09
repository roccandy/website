import Link from "next/link";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/Toast";
import { LogoutButton } from "@/app/admin/LogoutButton";
import { AdminBodyAttributes } from "@/app/admin/AdminBodyAttributes";
import { AdminNav } from "@/app/admin/AdminNav";
import { getAdminSession } from "@/lib/adminAuth";

const baseNavSections = [
  {
    label: "Orders",
    items: [
      { label: "Production Schedule", href: "/admin/orders" },
      { label: "Pre-made Orders", href: "/admin/orders/additional-items" },
      { label: "All Orders / Refunds", href: "/admin/orders/archived" },
    ],
  },
  {
    label: "Catalog",
    items: [{ label: "Pre-made Candy", href: "/admin/premade" }],
  },
  {
    label: "Pricing",
    items: [
      { label: "Base Pricing", href: "/admin/pricing" },
      { label: "Label Pricing", href: "/admin/labels" },
      { label: "Extras Pricing", href: "/admin/settings/extras" },
    ],
  },
  {
    label: "Packaging",
    items: [
      { label: "Packaging Options & Pricing", href: "/admin/packaging" },
      { label: "Labels", href: "/admin/packaging/labels" },
    ],
  },
  {
    label: "Site settings",
    items: [
      { label: "Colour Palette", href: "/admin/settings/palette" },
      { label: "Production Settings", href: "/admin/settings/production" },
      { label: "FAQs", href: "/admin/settings/faqs" },
      { label: "Privacy Policy", href: "/admin/settings/privacy" },
      { label: "Terms and Conditions", href: "/admin/settings/terms" },
      { label: "Candy Flavours", href: "/admin/flavors" },
    ],
  },
];

const PAYMENTS_SANDBOX_MODE =
  (process.env.NEXT_PUBLIC_SQUARE_ENV ?? "production").toLowerCase() === "sandbox" ||
  (process.env.NEXT_PUBLIC_PAYPAL_ENV ?? "production").toLowerCase() === "sandbox";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession();

  if (!session) {
    return (
      <ToastProvider>
        <AdminBodyAttributes />
        <div className="min-h-screen bg-white text-zinc-900">{children}</div>
      </ToastProvider>
    );
  }

  const signedInDisplay = session.user.name?.trim() || session.user.email?.trim() || "Signed in";
  const navSections = session.user.canManageUsers
    ? [
        ...baseNavSections,
        {
          label: "Users",
          items: [{ label: "Admin Users", href: "/admin/settings/users" }],
        },
      ]
    : baseNavSections;

  return (
    <ToastProvider>
      <AdminBodyAttributes />
      <div className="min-h-screen bg-white text-zinc-900">
        <header className="border-b border-zinc-200">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
            <Link href="/admin" className="text-sm font-medium text-zinc-700 hover:text-zinc-900">
              Home
            </Link>
            <AdminNav sections={navSections} />
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-right leading-tight">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Signed in</p>
                <p className="text-xs font-medium normal-case text-zinc-700">{signedInDisplay}</p>
              </div>
              <LogoutButton />
            </div>
          </div>
        </header>
        {PAYMENTS_SANDBOX_MODE ? (
          <div className="border-b border-amber-300 bg-amber-50">
            <div className="mx-auto max-w-6xl px-6 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">
              Sandbox mode active: payments are test-only in this environment
            </div>
          </div>
        ) : null}
        {!session.user.canWrite ? (
          <div className="border-b border-sky-300 bg-sky-50">
            <div className="mx-auto max-w-6xl px-6 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-800">
              Read-only access: this user can view admin pages but cannot make changes
            </div>
          </div>
        ) : null}
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
