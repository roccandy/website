import { notFound, redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/adminAuth";
import { getArchivedEmail } from "@/lib/emailArchive";
import { emailKindLabel, emailStatusLabel } from "@/lib/emailArchiveTypes";
import { AdminLink } from "../../AdminNavigationFeedback";
export const dynamic = "force-dynamic";
export const metadata = { title: "Original email | Roc Candy Admin" };
export default async function OriginalEmailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdminSession();
  if (session.user.role === "production") redirect("/admin/production");
  const email = await getArchivedEmail((await params).id);
  if (!email) notFound();
  return (
    <section className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            {emailKindLabel[email.kind]} · saved original
          </p>
          <h1 className="mt-2 break-words text-2xl font-semibold">
            {email.subject}
          </h1>
        </div>
        <a
          href={`/api/admin/emails/${email.id}/original`}
          className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold"
        >
          Download original email (.eml)
        </a>
      </header>
      <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5">
        <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2 text-sm">
          <dt className="text-zinc-500">From</dt>
          <dd className="break-all">{email.from_address}</dd>
          <dt className="text-zinc-500">To</dt>
          <dd className="break-all">{email.to_addresses.join(", ")}</dd>
          <dt className="text-zinc-500">Date</dt>
          <dd>
            {new Intl.DateTimeFormat("en-AU", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Australia/Perth",
            }).format(new Date(email.created_at))}{" "}
            AWST
          </dd>
          <dt className="text-zinc-500">Status</dt>
          <dd>{emailStatusLabel[email.status]}</dd>
        </dl>
        {email.rejected_addresses.length ? (
          <p className="mt-3 break-all rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
            Rejected recipients: {email.rejected_addresses.join(", ")}. Review
            before sending again.
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {email.order_ids.map((id) => (
            <AdminLink
              key={id}
              href={`/admin/orders/${id}#emails-documents`}
              className="rounded border px-3 py-1.5 text-xs font-semibold text-emerald-900"
            >
              View linked order
            </AdminLink>
          ))}
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          This is the saved message submitted to the mail server. Accepted does
          not confirm delivery or that the customer read it. A
          prepared/unconfirmed message must not be assumed sent.
        </p>
      </section>
      {email.attachments.some((file) => file.disposition !== "inline") ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="font-semibold">Original attachments</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {email.attachments.map((file, index) =>
              file.disposition === "inline" ? null : (
                <div
                  key={index}
                  className="min-w-0 rounded-lg border border-zinc-200 p-3"
                >
                  <p className="break-all text-sm font-semibold">
                    {file.filename}
                  </p>
                  <div className="mt-2 flex gap-4 text-xs font-semibold text-emerald-900">
                    {file.contentType === "application/pdf" ? (
                      <a
                        href={`/api/admin/emails/${email.id}/attachment/${index}?inline=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View PDF ↗
                      </a>
                    ) : null}
                    <a
                      href={`/api/admin/emails/${email.id}/attachment/${index}`}
                    >
                      Download
                    </a>
                  </div>
                </div>
              ),
            )}
          </div>
        </section>
      ) : null}
      <section className="min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 p-4">
          <h2 className="font-semibold">Customer email preview</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Original content with saved inline images. External content and
            interactive behaviour are blocked for safety; email apps may render
            layouts differently.
          </p>
        </div>
        {email.html_body ? (
          <iframe
            title="Original customer email"
            src={`/api/admin/emails/${email.id}/preview`}
            sandbox=""
            referrerPolicy="no-referrer"
            className="h-[700px] w-full border-0 bg-white"
          />
        ) : (
          <pre className="whitespace-pre-wrap break-words p-5 font-sans text-sm text-zinc-800">
            {email.text_body}
          </pre>
        )}
      </section>
      {email.html_body ? (
        <details className="rounded-xl border border-zinc-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Plain-text version
          </summary>
          <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm">
            {email.text_body}
          </pre>
        </details>
      ) : null}
    </section>
  );
}
