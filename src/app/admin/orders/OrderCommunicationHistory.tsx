import { AdminLink } from "../AdminNavigationFeedback";
import { getOrderEmailHistory } from "@/lib/emailArchive";
import { emailKindLabel, emailStatusLabel } from "@/lib/emailArchiveTypes";
import type { OrderRow } from "@/lib/data";

export async function OrderCommunicationHistory({
  order,
}: {
  order: Pick<
    OrderRow,
    "id" | "order_number" | "square_invoice_id" | "square_invoice_sent_at"
  >;
}) {
  const history = await getOrderEmailHistory(order.id, order.order_number);
  const customer = history.emails.filter((email) => email.kind !== "internal");
  const internal = history.emails.filter((email) => email.kind === "internal");
  const rows = (emails: typeof history.emails) => (
    <ol className="divide-y divide-zinc-100">
      {emails.map((email) => (
        <li
          key={email.id}
          className="flex flex-wrap items-start justify-between gap-3 py-4"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              {emailKindLabel[email.kind]} ·{" "}
              {new Intl.DateTimeFormat("en-AU", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Australia/Perth",
              }).format(new Date(email.created_at))}{" "}
              AWST
            </p>
            <AdminLink
              href={`/admin/emails/${email.id}`}
              className="mt-1 block break-words text-sm font-semibold text-emerald-900 hover:underline"
            >
              {email.subject}
            </AdminLink>
            <p className="mt-1 break-all text-xs text-zinc-500">
              To: {email.to_addresses.join(", ")}
            </p>
            <p
              className={`mt-1 text-xs ${email.status === "accepted" ? "text-emerald-700" : "text-amber-800"}`}
            >
              {emailStatusLabel[email.status]}
            </p>
            {email.order_numbers.length > 1 ? (
              <p className="mt-1 text-xs text-zinc-500">
                Combined message ·{" "}
                {email.order_numbers.map((number) => `#${number}`).join(", ")}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminLink
              href={`/admin/emails/${email.id}`}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold"
            >
              View original email
            </AdminLink>
            {email.attachments.map((attachment, index) =>
              attachment.contentType === "application/pdf" ? (
                <a
                  key={index}
                  href={`/api/admin/emails/${email.id}/attachment/${index}?inline=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900"
                >
                  View original invoice PDF ↗
                </a>
              ) : null,
            )}
          </div>
        </li>
      ))}
    </ol>
  );
  return (
    <section
      id="emails-documents"
      className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
      aria-label="Emails & documents"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Emails &amp; documents</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Original website-sent messages and attachments, saved at send
            time—not rebuilt from current order details.
          </p>
        </div>
        <span className="text-xs text-zinc-500">
          {customer.length} customer messages
        </span>
      </div>
      {!history.available ? (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Email history is temporarily unavailable. This does not mean no emails
          were sent.
        </p>
      ) : customer.length ? (
        rows(customer)
      ) : (
        <p className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">
          No archived customer emails for this order yet. Historical emails have
          not been reconstructed. New website-sent order emails will appear here
          once submitted.
        </p>
      )}
      {order.square_invoice_id &&
      order.square_invoice_sent_at &&
      !history.emails.some((email) => email.kind === "invoice-pdf") ? (
        <p className="mt-3 text-xs text-zinc-500">
          An invoice send is recorded, but its original email is not in this
          archive. Check the orders mailbox or Square for the original.
          Square-generated emails and manual mailbox messages are not captured
          here.
        </p>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">
          Square-generated emails and messages sent manually from a mailbox are
          not captured here. Mail-server acceptance is not proof of inbox
          delivery.
        </p>
      )}
      {internal.length ? (
        <details className="mt-4 border-t border-zinc-100 pt-3">
          <summary className="cursor-pointer text-xs font-semibold text-zinc-600">
            Internal notifications ({internal.length})
          </summary>
          {rows(internal)}
        </details>
      ) : null}
      {history.emails.length >= 100 ? (
        <p className="mt-3 text-xs text-zinc-500">
          Showing the latest 100 archived messages for this order.
        </p>
      ) : null}
    </section>
  );
}
