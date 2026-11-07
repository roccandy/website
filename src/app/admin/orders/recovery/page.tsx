import { requireAdminSession } from "@/lib/adminAuth";
import { listOpenPaymentFailures } from "@/lib/paymentFailures";
import { resolvePaymentRecoveryAction } from "./actions";
import { AdminSubmitButton } from "@/components/AdminSubmitButton";

export const metadata = { title: "Payment Recovery | Roc Candy Admin" };
export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export default async function PaymentRecoveryPage() {
  const session = await requireAdminSession();
  const failures = await listOpenPaymentFailures();
  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Admin / Orders</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">Payment recovery</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
          These are payments where the provider may have succeeded but Roc Candy could not finish saving the order. Check the provider transaction before creating, changing, or refunding an order.
        </p>
      </header>

      {failures.length === 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900">No open payment recovery items.</div>
      ) : (
        <div className="space-y-4">
          {failures.map((failure) => (
            <article key={failure.id} className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">{failure.provider} · {failure.stage}</p>
                  <h2 className="mt-1 text-base font-semibold text-zinc-900">{failure.order_number || "Order number not assigned"}</h2>
                </div>
                <time className="text-xs text-zinc-500">{new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Australia/Perth" }).format(new Date(failure.created_at))}</time>
              </div>
              <p className="mt-3 text-sm text-zinc-700">{failure.message}</p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div><dt className="text-xs text-zinc-500">Customer</dt><dd className="mt-1 font-medium text-zinc-900">{failure.customer_email || "Not recorded"}</dd></div>
                <div><dt className="text-xs text-zinc-500">Amount</dt><dd className="mt-1 font-medium text-zinc-900">{failure.order_total == null ? "Not recorded" : money.format(Number(failure.order_total))}</dd></div>
                <div><dt className="text-xs text-zinc-500">Provider transaction</dt><dd className="mt-1 break-all font-medium text-zinc-900">{failure.payment_transaction_id || "Not recorded"}</dd></div>
              </dl>
              {session.user.canWrite ? (
                <form action={resolvePaymentRecoveryAction} className="mt-5 flex flex-wrap items-end gap-3 border-t border-zinc-100 pt-4">
                  <input type="hidden" name="id" value={failure.id} />
                  <label className="min-w-[16rem] flex-1 text-xs font-medium text-zinc-600">Resolution note (optional)<input name="resolution_note" maxLength={1000} placeholder="e.g. order recreated after Square confirmation" className="mt-1 block w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900" /></label>
                  <AdminSubmitButton type="submit" pendingLabel="Closing…" className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900">Close after reconciliation</AdminSubmitButton>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
