import Link from "next/link";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/Toast";
import { LogoutButton } from "@/app/admin/LogoutButton";
import { AdminBodyAttributes } from "@/app/admin/AdminBodyAttributes";
import { AdminNav } from "@/app/admin/AdminNav";

const navSections = [
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
      { label: "Candy Flavours", href: "/admin/flavors" },
    ],
  },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
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
            <LogoutButton />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
