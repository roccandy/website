import { getFlavors } from "@/lib/data";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AddFlavorForm } from "./AddFlavorForm";
import FlavorAdminList from "./FlavorAdminList";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function FlavorsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");

  const flavors = await getFlavors();

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Flavors</p>
        <h2 className="text-3xl font-semibold">Candy flavors</h2>
        <p className="text-sm text-zinc-600">Manage the list of flavors customers can choose.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-900">Current flavors</h3>
          <FlavorAdminList items={flavors} />
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-900">Add flavor</h3>
          <AddFlavorForm />
        </div>
      </div>
    </section>
  );
}
