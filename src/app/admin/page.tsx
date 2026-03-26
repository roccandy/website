import Link from "next/link";
import { AdminQuickSearch } from "@/app/admin/AdminQuickSearch";
import {
  buildAdminNavSections,
  type AdminNavItem,
  type AdminNavSection,
  getAdminNavToneClasses,
  isSeoEditableAdminHref,
  isSeoFocusedUser,
} from "@/app/admin/adminNavigation";
import { requireAdminSession } from "@/lib/adminAuth";
import { getOrders } from "@/lib/data";
import { isVisibleOnPremadeOrders, isVisibleOnProductionSchedule } from "./orders/scheduleVisibility";

function getAccessLabel(canWrite: boolean, canWriteSeo: boolean, href: string) {
  if (canWrite) return "Edit";
  if (canWriteSeo && isSeoEditableAdminHref(href)) return "Edit";
  return "View";
}

function getPriorityItems(sections: AdminNavSection[], hrefs: string[]) {
  const itemsByHref = new Map<string, AdminNavItem>();

  for (const section of sections) {
    for (const item of section.items) {
      itemsByHref.set(item.href, item);
    }
  }

  return hrefs
    .map((href) => {
      const item = itemsByHref.get(href);
      return item ? { href, item } : null;
    })
    .filter((entry): entry is { href: string; item: AdminNavItem } => Boolean(entry));
}

export default async function AdminHome() {
  const session = await requireAdminSession();
  const orders = await getOrders();
  const sections = buildAdminNavSections(session.user);
  const seoFocused = isSeoFocusedUser(session.user);
  const signedInDisplay = session.user.name?.trim() || session.user.email?.trim() || "Signed in";
  const outstandingCounts: Record<string, number> = {
    "/admin/orders": orders.filter(isVisibleOnProductionSchedule).length,
    "/admin/orders/additional-items": orders.filter(isVisibleOnPremadeOrders).length,
  };

  const startHere = seoFocused
    ? getPriorityItems(sections, [
        "/admin/settings/pages",
        "/admin/settings/faqs",
        "/admin/settings/privacy",
        "/admin/settings/terms",
      ])
    : getPriorityItems(sections, [
        "/admin/orders",
        "/admin/orders/additional-items",
        "/admin/orders/archived",
        "/admin/settings/pages",
      ]);

  const seoSection = sections.find((section) => section.key === "content-seo");
  const nonSeoSections = sections.filter((section) => section.key !== "content-seo");

  return (
    <section className="space-y-8">
      <div className="rounded-[2rem] border border-zinc-200 bg-gradient-to-br from-white via-zinc-50 to-zinc-100 p-6 shadow-sm lg:p-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-zinc-500">
                  {seoFocused ? "SEO Workspace" : "Admin Dashboard"}
                </span>
                <span className="inline-flex rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-zinc-500">
                  {session.user.role}
                  {session.user.isBootstrap ? " · bootstrap" : ""}
                </span>
              </div>
              <div className="space-y-2">
                <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
                  {seoFocused ? "Everything SEO, without the admin maze." : "A clearer way through the Roc Candy admin."}
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-zinc-600">
                  {seoFocused
                    ? "Your writing workspace is now front-and-centre. Site Pages & SEO, FAQs, privacy, and terms stay in one obvious area, while the rest of admin remains available as read-only reference."
                    : "The admin keeps every existing page and location, but navigation is now grouped by workflow so orders, products, pricing, packaging, and content are easier to find."}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  {seoFocused ? "Primary area" : "Custom orders live"}
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
                  {seoFocused ? "Content & SEO" : outstandingCounts["/admin/orders"]}
                </p>
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  {seoFocused
                    ? "Pages, product SEO, redirects, FAQs, privacy, and terms."
                    : "Orders currently visible on the production schedule."}
                </p>
              </div>
              <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  {seoFocused ? "Edit scope" : "Pre-made orders live"}
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
                  {seoFocused ? "SEO only" : outstandingCounts["/admin/orders/additional-items"]}
                </p>
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  {seoFocused
                    ? "Other areas stay accessible as reference, but not editable."
                    : "Pre-made orders waiting for fulfilment or follow-up."}
                </p>
              </div>
              <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Signed in as</p>
                <p className="mt-2 text-lg font-semibold tracking-tight text-zinc-900">{signedInDisplay}</p>
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  {session.user.canManageUsers
                    ? "Full platform permissions, including users and settings."
                    : seoFocused
                      ? "SEO editing permissions with direct access to content tools."
                      : session.user.canWrite
                        ? "Operational editing permissions across admin tools."
                        : "Read-only access across the admin workspace."}
                </p>
              </div>
            </div>
          </div>

          <AdminQuickSearch sections={sections} />
        </div>
      </div>

      <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
              {seoFocused ? "Recommended start points" : "Start here"}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
              {seoFocused ? "The pages your SEO workflow uses most" : "The pages most people need first"}
            </h2>
          </div>
          {seoFocused ? (
            <p className="max-w-xl text-sm leading-6 text-zinc-500">
              Product SEO and redirects are managed inside <span className="font-medium text-zinc-700">Site Pages & SEO</span>, so that should usually be your first stop.
            </p>
          ) : (
            <p className="max-w-xl text-sm leading-6 text-zinc-500">
              Orders and content are surfaced first here so you can get into the day’s work without hunting through generic cards.
            </p>
          )}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {startHere.map(({ href, item }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-3xl border border-zinc-200 bg-gradient-to-br from-white via-zinc-50 to-zinc-100 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-zinc-900">{item.label}</p>
                    {outstandingCounts[href] ? (
                      <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold leading-none text-white">
                        {outstandingCounts[href]}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm leading-6 text-zinc-500">{item.description}</p>
                </div>
                <span className="inline-flex rounded-full border border-zinc-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 transition group-hover:border-zinc-300 group-hover:text-zinc-700">
                  {getAccessLabel(session.user.canWrite, session.user.canWriteSeo, href)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {seoFocused && seoSection ? (
        <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm lg:p-8">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">SEO tools</p>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Your direct editing workspace</h2>
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {seoSection.items.map((item) => {
              const toneClasses = getAdminNavToneClasses(seoSection.tone);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-3xl border bg-gradient-to-br p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneClasses.border} ${toneClasses.panel}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <p className="text-base font-semibold text-zinc-900">{item.label}</p>
                      <p className="text-sm leading-6 text-zinc-600">{item.description}</p>
                    </div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${toneClasses.badge}`}>
                      Edit
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="space-y-6">
        {(seoFocused ? nonSeoSections : sections).map((section) => {
          const toneClasses = getAdminNavToneClasses(section.tone);

          return (
            <div key={section.key} className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm lg:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${toneClasses.badgeMuted}`}>
                      {section.label}
                    </span>
                    {seoFocused ? (
                      <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        View-only here
                      </span>
                    ) : null}
                  </div>
                  <h2 className="text-xl font-semibold text-zinc-900">{section.description}</h2>
                </div>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {section.items.map((item) => (
                  <Link
                    key={`${section.key}-${item.href}`}
                    href={item.href}
                    className="group rounded-3xl border border-zinc-200 bg-zinc-50/60 p-5 transition hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-white hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-zinc-900">{item.label}</p>
                          {outstandingCounts[item.href] ? (
                            <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold leading-none text-white">
                              {outstandingCounts[item.href]}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs leading-5 text-zinc-500">{item.description}</p>
                      </div>
                      <span className="inline-flex rounded-full border border-zinc-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 transition group-hover:border-zinc-300 group-hover:text-zinc-700">
                        {getAccessLabel(session.user.canWrite, session.user.canWriteSeo, item.href)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
