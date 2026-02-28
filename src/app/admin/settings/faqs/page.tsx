import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getManagedFaqItems } from "@/lib/faqs";
import { addFaq, deleteFaq, moveFaqDown, moveFaqUp, updateFaq } from "./actions";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function AdminFaqSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/admin/login");
  }

  const faqItems = await getManagedFaqItems();

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Site Settings</p>
          <h1 className="text-3xl font-semibold text-zinc-900">FAQs</h1>
          <p className="text-sm text-zinc-600">
            This is the source of truth for the public FAQ page. Add, edit, reorder, or delete entries.
          </p>
        </div>
        <Link
          href="/faq"
          className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
        >
          View public FAQ page
        </Link>
      </div>

      <form
        action={addFaq}
        className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_auto]"
      >
        <label className="space-y-1 text-sm text-zinc-700">
          <span className="text-xs text-zinc-500">New question</span>
          <input
            type="text"
            name="question"
            placeholder="Type the FAQ question"
            className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm text-zinc-700">
          <span className="text-xs text-zinc-500">New answer (HTML allowed)</span>
          <input
            type="text"
            name="answerHtml"
            placeholder="Type the FAQ answer"
            className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Add FAQ
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {faqItems.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
            No FAQs yet. Add the first one above.
          </div>
        ) : null}

        {faqItems.map((item, index) => {
          const formId = `faq-edit-${item.id}`;
          const isFirst = index === 0;
          const isLast = index === faqItems.length - 1;
          return (
            <article key={item.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <form id={formId} action={updateFaq} className="space-y-3">
                <input type="hidden" name="id" value={item.id} />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    FAQ #{index + 1}
                  </p>
                </div>
                <label className="block text-sm text-zinc-700">
                  <span className="text-xs text-zinc-500">Question</span>
                  <input
                    type="text"
                    name="question"
                    defaultValue={item.question}
                    required
                    className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm text-zinc-700">
                  <span className="text-xs text-zinc-500">Answer (HTML allowed)</span>
                  <textarea
                    name="answerHtml"
                    defaultValue={item.answerHtml}
                    required
                    rows={5}
                    className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                  />
                </label>
              </form>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  form={formId}
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
                >
                  Save
                </button>

                <form action={moveFaqUp}>
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    disabled={isFirst}
                    className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
                      isFirst
                        ? "border-zinc-200 bg-zinc-100 text-zinc-400"
                        : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    Move up
                  </button>
                </form>

                <form action={moveFaqDown}>
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    disabled={isLast}
                    className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
                      isLast
                        ? "border-zinc-200 bg-zinc-100 text-zinc-400"
                        : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    Move down
                  </button>
                </form>

                <form action={deleteFaq} className="ml-auto">
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
