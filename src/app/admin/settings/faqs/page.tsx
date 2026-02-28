import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getManagedFaqItems } from "@/lib/faqs";
import { addFaq } from "./actions";
import FaqAdminList from "./FaqAdminList";

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

      <FaqAdminList items={faqItems} />
    </section>
  );
}
