import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

const sections = [
  {
    title: "Orders",
    description: "Track active orders and archive history.",
    links: [
      {
        href: "/admin/orders",
        label: "Production Schedule",
        description: "Current production pipeline.",
      },
      {
        href: "/admin/orders/additional-items",
        label: "Pre-made Orders",
        description: "Premade candy orders to ship.",
      },
      {
        href: "/admin/orders/archived",
        label: "All Orders / Refunds",
        description: "All orders across custom and premade.",
      },
    ],
  },
  {
    title: "Catalog",
    description: "Shop-facing items and flavour icons.",
    links: [
      {
        href: "/admin/premade",
        label: "Pre-made Candy",
        description: "Items, pricing, badges, and order.",
      },
    ],
  },
  {
    title: "Pricing",
    description: "Set base pricing, label pricing, and extras in one place.",
    links: [
      {
        href: "/admin/pricing",
        label: "Base Pricing",
        description: "Weight tiers by order type.",
      },
      {
        href: "/admin/labels",
        label: "Label Pricing",
        description: "Supplier label costs & markup.",
      },
      {
        href: "/admin/settings/extras",
        label: "Extras Pricing",
        description: "Jackets, urgency fees, and transaction fees.",
      },
    ],
  },
  {
    title: "Packaging",
    description: "Manage packaging options, pricing, and images.",
    links: [
      {
        href: "/admin/packaging",
        label: "Packaging Options & Pricing",
        description: "Types, sizes, lids, and images.",
      },
      {
        href: "/admin/packaging/labels",
        label: "Labels",
        description: "Label types by shape and size.",
      },
    ],
  },
  {
    title: "Site Settings",
    description: "Global rules, colours, and production limits.",
    links: [
      {
        href: "/admin/settings/palette",
        label: "Colour Palette",
        description: "Order builder colours.",
      },
      {
        href: "/admin/settings/production",
        label: "Production Settings",
        description: "Production options & blocked dates.",
      },
      {
        href: "/admin/flavors",
        label: "Candy Flavours",
        description: "Flavour list + symbols.",
      },
    ],
  },
];

export default async function AdminHome() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/admin/login");
  }

  return (
    <section className="space-y-10">
      <div className="rounded-3xl border border-zinc-200 bg-gradient-to-br from-white via-zinc-50 to-zinc-100 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Admin</p>
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">Roc Candy Console</h1>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {sections.map((section) => (
          <div key={section.title} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-zinc-900">{section.title}</h2>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {section.links.map((item) => (
                <Link
                  key={`${section.title}-${item.label}`}
                  href={item.href}
                  className="group rounded-xl border border-zinc-200 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-zinc-900">{item.label}</p>
                      <p className="text-xs text-zinc-500">{item.description}</p>
                    </div>
                    <span className="text-xs font-semibold text-zinc-400 transition group-hover:text-zinc-600">
                      View
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
