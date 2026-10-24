import { requireAdminSession } from "@/lib/adminAuth";
import { getInvoices } from "./invoiceData";
import { InvoiceHub } from "./InvoiceHub";
import { parseInvoiceFilters } from "./invoiceModel";

export const metadata = { title: "Invoices | Roc Candy Admin" };
export const dynamic = "force-dynamic";

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAdminSession();
  const [data, params] = await Promise.all([
    getInvoices(),
    Promise.resolve(searchParams),
  ]);
  return (
    <InvoiceHub
      {...data}
      initialFilters={parseInvoiceFilters(params ?? {})}
      initialPage={Math.max(1, Math.min(10000, Math.floor(Number(params?.page) || 1)))}
      canWrite={session.user.canWrite}
    />
  );
}
