import type { Session } from "next-auth";

export type AdminNavItem = {
  label: string;
  href: string;
  description: string;
  seoEditable?: boolean;
};

export type AdminNavSection = {
  key: string;
  label: string;
  description: string;
  tone: "rose" | "emerald" | "amber" | "sky" | "violet" | "zinc";
  items: AdminNavItem[];
};

export type AdminNavToneClasses = {
  badge: string;
  badgeMuted: string;
  border: string;
  panel: string;
  text: string;
};

type AdminSessionUser = Session["user"];

const BASE_NAV_SECTIONS: AdminNavSection[] = [
  {
    key: "operations",
    label: "Operations",
    description: "Daily production flow, orders, and fulfilment.",
    tone: "amber",
    items: [
      { label: "Production Schedule", href: "/admin/orders", description: "Current custom-order pipeline and slot planning." },
      { label: "Pre-made Orders", href: "/admin/orders/additional-items", description: "Pre-made orders waiting to ship or complete." },
      { label: "All Orders / Refunds", href: "/admin/orders/archived", description: "Full order history, refunds, and archived records." },
      { label: "Create Order", href: "/admin/orders/new", description: "Manual order entry for custom or special cases." },
      { label: "Production Settings", href: "/admin/settings/production", description: "Capacity, blocked dates, overrides, and production rules." },
    ],
  },
  {
    key: "products",
    label: "Products",
    description: "Shop items and flavour setup.",
    tone: "emerald",
    items: [
      { label: "Pre-made Candy", href: "/admin/premade", description: "Products, imagery, pricing, and merchandising fields." },
      { label: "Candy Flavours", href: "/admin/flavors", description: "Flavour list, ordering, and active/inactive status." },
    ],
  },
  {
    key: "commercial",
    label: "Pricing & Packaging",
    description: "Commercial setup for pricing, packaging, and labels.",
    tone: "violet",
    items: [
      { label: "Base Pricing", href: "/admin/pricing", description: "Weight tiers and base order pricing." },
      { label: "Label Pricing", href: "/admin/labels", description: "Supplier label costs and markup configuration." },
      { label: "Extras Pricing", href: "/admin/settings/extras", description: "Urgency fees and extras." },
      { label: "Packaging Options", href: "/admin/packaging", description: "Packaging types, sizes, lids, and imagery." },
      { label: "Label Types", href: "/admin/packaging/labels", description: "Available label formats and shapes." },
      { label: "Colour Palette", href: "/admin/settings/palette", description: "Designer colour system and palette ordering." },
    ],
  },
  {
    key: "content-seo",
    label: "Content & SEO",
    description: "Site copy, page metadata, policy content, and redirects.",
    tone: "rose",
    items: [
      { label: "Site Pages & SEO", href: "/admin/settings/pages", description: "Landing pages, product SEO, redirects, and fixed page content.", seoEditable: true },
      { label: "Blog Posts", href: "/admin/settings/blog-posts", description: "Monthly article publishing, cover images, and blog SEO.", seoEditable: true },
      { label: "FAQs", href: "/admin/settings/faqs", description: "Main FAQ library and ordering.", seoEditable: true },
      { label: "Privacy Policy", href: "/admin/settings/privacy", description: "Public privacy-page content.", seoEditable: true },
      { label: "Terms and Conditions", href: "/admin/settings/terms", description: "Public terms content tree.", seoEditable: true },
    ],
  },
  {
    key: "admin",
    label: "Admin & Insight",
    description: "Users, reporting, and internal tools.",
    tone: "sky",
    items: [
      { label: "My Password", href: "/admin/settings/password", description: "Change your own sign-in password." },
      { label: "Stats", href: "/admin/stats", description: "Internal performance, revenue, and order stats." },
    ],
  },
];

export function isSeoEditableAdminHref(href: string) {
  return (
    href === "/admin/settings/pages" ||
    href === "/admin/settings/blog-posts" ||
    href === "/admin/settings/faqs" ||
    href === "/admin/settings/privacy" ||
    href === "/admin/settings/terms"
  );
}

export function isSelfServiceAdminHref(href: string) {
  return href === "/admin/settings/password";
}

export function isSeoFocusedUser(user: AdminSessionUser) {
  return user.canWriteSeo && !user.canWrite;
}

export function isProductionUser(user: AdminSessionUser) {
  return user.role === "production";
}

function canAccessCustomerCrmNav(user: AdminSessionUser) {
  return user.role !== "production" && user.role !== "seo";
}

export function buildAdminNavSections(user: AdminSessionUser): AdminNavSection[] {
  if (isProductionUser(user)) {
    return [
      {
        key: "production",
        label: "Production",
        description: "This week and next week order list.",
        tone: "amber",
        items: [
          {
            label: "Production Orders",
            href: "/admin/production",
            description: "Read-only list of orders due this week and next week.",
          },
        ],
      },
    ];
  }

  const sections = BASE_NAV_SECTIONS.map((section) => ({
    ...section,
    items: [...section.items],
  }));

  if (user.canManageUsers) {
    const adminSection = sections.find((section) => section.key === "admin");
    if (adminSection) {
      adminSection.items.unshift({
        label: "Admin Users",
        href: "/admin/settings/users",
        description: "Emails, passwords, roles, and account status.",
      });
    }
  }

  if (canAccessCustomerCrmNav(user)) {
    const adminSection = sections.find((section) => section.key === "admin");
    if (adminSection) {
      adminSection.items.push({
        label: "Customers",
        href: "/admin/customers",
        description: "Customer profiles, historic orders, enquiries, and repeat-customer insight.",
      });
    }
  }

  if (isSeoFocusedUser(user)) {
    return [
      ...sections.filter((section) => section.key === "content-seo"),
      ...sections.filter((section) => section.key !== "content-seo"),
    ];
  }

  return sections;
}

export function getAdminNavToneClasses(tone: AdminNavSection["tone"]): AdminNavToneClasses {
  switch (tone) {
    case "rose":
      return {
        badge: "border-rose-300 bg-rose-100 text-rose-900",
        badgeMuted: "border-rose-200 bg-white/80 text-rose-700",
        border: "border-rose-200",
        panel: "from-rose-50 via-white to-white",
        text: "text-rose-700",
      };
    case "emerald":
      return {
        badge: "border-emerald-300 bg-emerald-100 text-emerald-900",
        badgeMuted: "border-emerald-200 bg-white/80 text-emerald-700",
        border: "border-emerald-200",
        panel: "from-emerald-50 via-white to-white",
        text: "text-emerald-700",
      };
    case "amber":
      return {
        badge: "border-amber-300 bg-amber-100 text-amber-900",
        badgeMuted: "border-amber-200 bg-white/80 text-amber-700",
        border: "border-amber-200",
        panel: "from-amber-50 via-white to-white",
        text: "text-amber-700",
      };
    case "sky":
      return {
        badge: "border-sky-300 bg-sky-100 text-sky-900",
        badgeMuted: "border-sky-200 bg-white/80 text-sky-700",
        border: "border-sky-200",
        panel: "from-sky-50 via-white to-white",
        text: "text-sky-700",
      };
    case "violet":
      return {
        badge: "border-violet-300 bg-violet-100 text-violet-900",
        badgeMuted: "border-violet-200 bg-white/80 text-violet-700",
        border: "border-violet-200",
        panel: "from-violet-50 via-white to-white",
        text: "text-violet-700",
      };
    default:
      return {
        badge: "border-zinc-300 bg-zinc-100 text-zinc-900",
        badgeMuted: "border-zinc-200 bg-white/80 text-zinc-700",
        border: "border-zinc-200",
        panel: "from-zinc-50 via-white to-white",
        text: "text-zinc-700",
      };
  }
}
