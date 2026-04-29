import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleDollarSign, Mail, MessageSquareText, Phone, Repeat2, UserRound } from "lucide-react";
import { addCustomerNote, assertCustomerCrmAccess, mergeCustomersAction } from "../actions";
import {
  customerSourceLabel,
  getCustomerDetail,
  type CustomerContactEvent,
  type CustomerDetail,
  type CustomerNote,
  type CustomerOrderHistory,
} from "@/lib/customerHistory";

export const metadata: Metadata = {
  title: "Customer Detail | Roc Candy Admin",
};

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const money = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
});

const numberFormat = new Intl.NumberFormat("en-AU");

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sourceBadge(source: string) {
  const classes =
    source === "current_next"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : source === "legacy_new"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : "border-zinc-200 bg-zinc-50 text-zinc-700";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${classes}`}>
      {customerSourceLabel(source)}
    </span>
  );
}

function StatPill({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-2 text-zinc-700">{icon}</div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
          <p className="text-lg font-semibold text-zinc-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function timelineItems(detail: CustomerDetail) {
  type TimelineItem =
    | { id: string; type: "order"; at: string | null; order: CustomerOrderHistory }
    | { id: string; type: "event"; at: string | null; event: CustomerContactEvent }
    | { id: string; type: "note"; at: string | null; note: CustomerNote };

  const items: TimelineItem[] = [
    ...detail.orders.map((order) => ({ id: `order-${order.id}`, type: "order" as const, at: order.created_at_source, order })),
    ...detail.events.map((event) => ({ id: `event-${event.id}`, type: "event" as const, at: event.occurred_at, event })),
    ...detail.notes.map((note) => ({ id: `note-${note.id}`, type: "note" as const, at: note.created_at, note })),
  ];

  return items.sort((a, b) => {
    const aTime = a.at ? new Date(a.at).getTime() : 0;
    const bTime = b.at ? new Date(b.at).getTime() : 0;
    return bTime - aTime;
  });
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">{label}</p>
      <p className="mt-1 text-sm text-zinc-800">{value || "-"}</p>
    </div>
  );
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const session = await assertCustomerCrmAccess();
  const { id } = await Promise.resolve(params);
  const detail = await getCustomerDetail(id);
  if (!detail) notFound();

  const { customer } = detail;
  const sourceSystems = customer.source_systems ?? [];
  const address = [customer.address_line1, customer.address_line2, customer.suburb, customer.state, customer.postcode, customer.country]
    .filter(Boolean)
    .join(", ");

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-3">
          <Link href="/admin/customers" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-900">
            <ArrowLeft className="h-4 w-4" />
            Back to customers
          </Link>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Customer profile</p>
            <h1 className="admin-page-title text-zinc-900">
              {customer.display_name || customer.primary_email || customer.primary_phone || "Unknown customer"}
            </h1>
            <div className="flex flex-wrap gap-2">
              {customer.order_count > 1 ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  Repeat customer
                </span>
              ) : null}
              {customer.match_confidence === "low" ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Low confidence match
                </span>
              ) : null}
              {sourceSystems.map((source) => (
                <span key={source} className="contents">
                  {sourceBadge(source)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatPill icon={<Repeat2 className="h-5 w-5" />} label="Orders" value={numberFormat.format(customer.order_count)} />
        <StatPill icon={<CircleDollarSign className="h-5 w-5" />} label="Spend" value={money.format(customer.lifetime_value)} />
        <StatPill icon={<MessageSquareText className="h-5 w-5" />} label="Enquiries" value={numberFormat.format(customer.enquiry_count)} />
        <StatPill icon={<UserRound className="h-5 w-5" />} label="First seen" value={formatDate(customer.first_seen_at)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.4fr]">
        <aside className="space-y-6">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Mail className="h-4 w-4 text-zinc-500" />
              <h2 className="admin-card-title text-zinc-900">Contact details</h2>
            </div>
            <div className="grid gap-4">
              <DetailRow label="Email" value={customer.primary_email} />
              <DetailRow label="Phone" value={customer.primary_phone} />
              <DetailRow label="Company" value={customer.company} />
              <DetailRow label="Address" value={address} />
              <DetailRow label="Last activity" value={formatDate(customer.last_seen_at)} />
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Phone className="h-4 w-4 text-zinc-500" />
              <h2 className="admin-card-title text-zinc-900">Known identities</h2>
            </div>
            <div className="space-y-2">
              {detail.identities.map((identity) => (
                <div key={identity.id} className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{identity.identity_type.replace("_", " ")}</p>
                  <p className="mt-1 break-all text-sm text-zinc-800">{identity.label || identity.identity_value}</p>
                </div>
              ))}
              {detail.identities.length === 0 ? <p className="text-sm text-zinc-500">No identities recorded.</p> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <UserRound className="h-4 w-4 text-zinc-500" />
              <h2 className="admin-card-title text-zinc-900">Potential duplicates</h2>
            </div>
            <div className="space-y-3">
              {detail.duplicateCandidates.map((candidate) => (
                <div key={candidate.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                  <Link href={`/admin/customers/${candidate.id}`} className="text-sm font-semibold text-zinc-900 hover:underline">
                    {candidate.display_name || candidate.primary_email || candidate.primary_phone || "Unknown customer"}
                  </Link>
                  <p className="mt-1 text-xs text-zinc-500">
                    {candidate.primary_email || candidate.primary_phone || "No primary contact"} · {numberFormat.format(candidate.order_count)} orders
                  </p>
                  {session.user.canWrite ? (
                    <form action={mergeCustomersAction} className="mt-2">
                      <input type="hidden" name="target_customer_id" value={customer.id} />
                      <input type="hidden" name="source_customer_id" value={candidate.id} />
                      <button className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300">
                        Merge into this customer
                      </button>
                    </form>
                  ) : null}
                </div>
              ))}
              {detail.duplicateCandidates.length === 0 ? <p className="text-sm text-zinc-500">No likely duplicates found.</p> : null}
            </div>
          </section>
        </aside>

        <div className="space-y-6">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="admin-card-title text-zinc-900">Timeline</h2>
              <span className="text-xs text-zinc-500">{timelineItems(detail).length} events</span>
            </div>
            <div className="space-y-3">
              {timelineItems(detail).slice(0, 80).map((item) => (
                <div key={item.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                  {item.type === "order" ? (
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {sourceBadge(item.order.source_system)}
                        <p className="font-semibold text-zinc-900">{item.order.display_order_number}</p>
                        <span className="text-xs text-zinc-500">{formatDateTime(item.at)}</span>
                      </div>
                      <p className="mt-2 text-sm text-zinc-700">
                        {[
                          item.order.order_type || "Order",
                          item.order.order_status || "unknown",
                          money.format(Number(item.order.total_price ?? 0)),
                          Number(item.order.refunded_total ?? 0) > 0 ? `${money.format(Number(item.order.refunded_total))} refunded` : null,
                        ].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  ) : item.type === "event" ? (
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {sourceBadge(item.event.source_system)}
                        <p className="font-semibold text-zinc-900">Enquiry</p>
                        <span className="text-xs text-zinc-500">{formatDateTime(item.at)}</span>
                      </div>
                      <p className="mt-2 line-clamp-3 text-sm text-zinc-700">{item.event.message || item.event.subject || "-"}</p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-700">
                          Note
                        </span>
                        <p className="font-semibold text-zinc-900">{item.note.created_by_name || item.note.created_by_email || "Admin"}</p>
                        <span className="text-xs text-zinc-500">{formatDateTime(item.at)}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{item.note.body}</p>
                    </div>
                  )}
                </div>
              ))}
              {timelineItems(detail).length === 0 ? <p className="text-sm text-zinc-500">No timeline items yet.</p> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="admin-card-title text-zinc-900">Orders</h2>
            <div className="mt-4 space-y-4">
              {detail.orders.map((order) => {
                const orderItems = detail.itemsByOrderId.get(order.id) ?? [];
                return (
                  <article key={order.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          {sourceBadge(order.source_system)}
                          <p className="font-semibold text-zinc-900">{order.display_order_number}</p>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          Created {formatDate(order.created_at_source)} · Due {formatDate(order.due_date)}
                        </p>
                      </div>
                      <p className="font-semibold text-zinc-900">{money.format(Number(order.total_price ?? 0))}</p>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <DetailRow label="Status" value={order.order_status} />
                      <DetailRow label="Payment" value={[order.payment_provider, order.payment_reference].filter(Boolean).join(" · ")} />
                      <DetailRow label="Paid" value={order.payment_total !== null ? money.format(Number(order.payment_total)) : null} />
                      <DetailRow label="Refunded" value={Number(order.refunded_total ?? 0) > 0 ? money.format(Number(order.refunded_total)) : null} />
                      <DetailRow label="Card" value={[order.card_brand, order.card_last4 ? `•••• ${order.card_last4}` : null].filter(Boolean).join(" ")} />
                      <DetailRow label="Fulfilment" value={order.pickup ? "Pickup" : "Delivery"} />
                    </div>
                    {order.notes || order.internal_notes ? (
                      <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-700">
                        {order.notes ? <p className="whitespace-pre-wrap">{order.notes}</p> : null}
                        {order.internal_notes ? <p className="mt-2 whitespace-pre-wrap text-zinc-500">{order.internal_notes}</p> : null}
                      </div>
                    ) : null}
                    {orderItems.length > 0 ? (
                      <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-xs">
                          <thead className="text-left uppercase tracking-[0.16em] text-zinc-400">
                            <tr>
                              <th className="py-2 pr-3">Item</th>
                              <th className="py-2 pr-3">Design</th>
                              <th className="py-2 pr-3">Flavour</th>
                              <th className="py-2 pr-3">Qty</th>
                              <th className="py-2 pr-3">Weight</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orderItems.map((item) => (
                              <tr key={item.id} className="border-t border-zinc-200">
                                <td className="py-2 pr-3 text-zinc-800">{item.title || "-"}</td>
                                <td className="py-2 pr-3 text-zinc-700">{item.design_text || item.design_type || "-"}</td>
                                <td className="py-2 pr-3 text-zinc-700">{item.flavor || "-"}</td>
                                <td className="py-2 pr-3 text-zinc-700">{item.quantity ?? "-"}</td>
                                <td className="py-2 pr-3 text-zinc-700">
                                  {item.total_weight_kg ? `${(item.total_weight_kg * 1000).toFixed(0)} g` : "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </article>
                );
              })}
              {detail.orders.length === 0 ? <p className="text-sm text-zinc-500">No orders recorded.</p> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="admin-card-title text-zinc-900">Enquiries</h2>
            <div className="mt-4 space-y-3">
              {detail.events.map((event) => (
                <article key={event.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {sourceBadge(event.source_system)}
                    <p className="font-semibold text-zinc-900">{event.name || event.email || "Enquiry"}</p>
                    <span className="text-xs text-zinc-500">{formatDateTime(event.occurred_at)}</span>
                  </div>
                  {event.subject ? <p className="mt-2 text-sm font-semibold text-zinc-700">{event.subject}</p> : null}
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{event.message || "-"}</p>
                  {event.attachment_path ? (
                    <p className="mt-2 break-all text-xs text-zinc-500">Attachment: {event.attachment_path}</p>
                  ) : null}
                </article>
              ))}
              {detail.events.length === 0 ? <p className="text-sm text-zinc-500">No enquiries recorded.</p> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="admin-card-title text-zinc-900">Internal notes</h2>
            {session.user.canWrite ? (
              <form action={addCustomerNote} className="mt-4 space-y-3">
                <input type="hidden" name="customer_id" value={customer.id} />
                <textarea
                  name="body"
                  rows={4}
                  placeholder="Add an internal note"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                />
                <button className="rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
                  Save note
                </button>
              </form>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">You have read-only access.</p>
            )}
            <div className="mt-5 space-y-3">
              {detail.notes.map((note) => (
                <div key={note.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                  <p className="text-xs text-zinc-500">
                    {note.created_by_name || note.created_by_email || "Admin"} · {formatDateTime(note.created_at)}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{note.body}</p>
                </div>
              ))}
              {detail.notes.length === 0 ? <p className="text-sm text-zinc-500">No internal notes yet.</p> : null}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
