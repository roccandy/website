import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getManagedTermsTree } from "@/lib/terms";
import TermsEditor from "./TermsEditor";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function AdminTermsSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/admin/login");
  }

  const termsItems = await getManagedTermsTree();

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Site Settings</p>
          <h1 className="text-3xl font-semibold text-zinc-900">Terms and Conditions</h1>
          <p className="text-sm text-zinc-600">
            This is the source of truth for the public terms page. Use nested items for numbering, sub-numbering, and
            lettered clauses.
          </p>
        </div>
        <Link
          href="/terms-and-conditions"
          className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
        >
          View public terms page
        </Link>
      </div>

      <TermsEditor items={termsItems} />
    </section>
  );
}
