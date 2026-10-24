import "server-only";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { buildInvoices, type InvoiceOrder } from "./invoiceModel";
import { getInvoiceOriginals } from "@/lib/emailArchive";

export async function getInvoices() {
  const loadedAt = new Date().toISOString();
  const rows: InvoiceOrder[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabaseAdminClient
      .from("orders")
      .select(
        "id,order_number,title,customer_name,customer_email,first_name,last_name,created_at,due_date,total_price,status,paid_at,payment_provider,payment_method,square_invoice_id,square_invoice_title,square_invoice_status,square_invoice_url,square_invoice_due_date,square_invoice_created_at,square_invoice_sent_at,square_invoice_error,refunded_at,refunded_amount",
      )
      .lte("created_at", loadedAt)
      .order("id", { ascending: true })
      .range(offset, offset + 499);
    if (error || !data)
      throw new Error("Invoices could not be loaded. Refresh and try again.");
    rows.push(...(data as unknown as InvoiceOrder[]));
    if (data.length < 500) break;
  }
  const originals = await getInvoiceOriginals();
  const invoices = buildInvoices(rows, loadedAt).map((invoice) => ({
    ...invoice,
    originalPdf: invoice.orders
      .map((order) => originals.get(order.id) ?? originals.get(order.number))
      .find(Boolean),
  }));
  return { loadedAt, invoices };
}
