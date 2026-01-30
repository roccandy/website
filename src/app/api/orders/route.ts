import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import { generateOrderNumber, normalizeBaseOrderNumber, normalizeOrderNumber } from "@/lib/orderNumbers";
import { getOrdersRecipients, sendOrderEmail } from "@/lib/email";

type OrderPayload = {
  orderNumber?: string;
  title?: string;
  description?: string;
  dateRequired?: string;
  pickup?: boolean;
  state?: string;
  location?: string;
  designType?: string;
  designText?: string;
  jacketType?: string;
  jacketColorOne?: string;
  jacketColorTwo?: string;
  textColor?: string;
  heartColor?: string;
  flavor?: string;
  paymentMethod?: string;
  logoUrl?: string;
  labelImageUrl?: string;
  labelTypeId?: string;
  notes?: string;
  customerName?: string;
  customerEmail?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  organizationName?: string;
  addressLine1?: string;
  addressLine2?: string;
  suburb?: string;
  postcode?: string;
  categoryId?: string;
  packagingOptionId?: string;
  quantity?: number;
  jarLidColor?: string;
  labelsCount?: number;
  jacket?: string;
  totalWeightKg?: number;
  totalPrice?: number;
};

type QuoteBlockRow = {
  start_date: string;
  end_date: string;
};

const isDateBlocked = (dateKey: string, blocks: QuoteBlockRow[]) =>
  blocks.some((block) => dateKey >= block.start_date && dateKey <= block.end_date);

const isOrderNumberConflict = (error: { code?: string | null; message?: string | null }) => {
  if (error.code === "23505") return true;
  const message = error.message?.toLowerCase() ?? "";
  return message.includes("order_number") && (message.includes("duplicate") || message.includes("unique"));
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as OrderPayload;
    const totalWeightKg = Number(body.totalWeightKg);

    if (!Number.isFinite(totalWeightKg) || totalWeightKg <= 0) {
      return NextResponse.json({ error: "Order weight is required." }, { status: 400 });
    }

    const settings = await getSettings();
    if (totalWeightKg > settings.max_total_kg) {
      return NextResponse.json({ error: `Max total kg is ${settings.max_total_kg}.` }, { status: 400 });
    }

    const client = supabaseServerClient;
    let order_number = normalizeBaseOrderNumber(normalizeOrderNumber(body.orderNumber));
    if (!order_number) {
      order_number = await generateOrderNumber();
    }
    const title = body.title?.trim() || null;
    const order_description = body.description?.trim() || null;
    const due_date = body.dateRequired || null;
    const pickup = Boolean(body.pickup);
    const state = body.state?.trim() || null;
    const location = body.location?.trim() || null;
    if (due_date) {
      const { data: quoteBlocks, error: quoteError } = await client
        .from("quote_blocks")
        .select("start_date,end_date");
      if (quoteError) throw new Error(quoteError.message);
      if (isDateBlocked(due_date, (quoteBlocks ?? []) as QuoteBlockRow[])) {
        return NextResponse.json({ error: "Selected date is unavailable." }, { status: 400 });
      }
    }

    let payload: Record<string, unknown> = {
      order_number,
      title,
      order_description,
      customer_name: body.customerName?.trim() || null,
      customer_email: body.customerEmail?.trim() || null,
      first_name: body.firstName?.trim() || null,
      last_name: body.lastName?.trim() || null,
      phone: body.phone?.trim() || null,
      organization_name: body.organizationName?.trim() || null,
      address_line1: body.addressLine1?.trim() || null,
      address_line2: body.addressLine2?.trim() || null,
      suburb: body.suburb?.trim() || null,
      postcode: body.postcode?.trim() || null,
      category_id: body.categoryId ?? null,
      packaging_option_id: body.packagingOptionId ?? null,
      quantity: body.quantity ?? null,
      jar_lid_color: body.jarLidColor ?? null,
      labels_count: body.labelsCount ?? null,
      jacket: body.jacket ?? null,
      design_type: body.designType ?? null,
      design_text: body.designText ?? null,
      jacket_type: body.jacketType ?? null,
      jacket_color_one: body.jacketColorOne ?? null,
      jacket_color_two: body.jacketColorTwo ?? null,
      flavor: body.flavor ?? null,
      payment_method: body.paymentMethod ?? null,
      logo_url: body.logoUrl ?? null,
      label_image_url: body.labelImageUrl ?? null,
      label_type_id: body.labelTypeId ?? null,
      text_color: body.categoryId !== "branded" ? body.textColor ?? null : null,
      heart_color: body.categoryId?.startsWith("weddings") ? body.heartColor ?? null : null,
      notes: body.notes?.trim() || null,
      due_date,
      total_weight_kg: totalWeightKg,
      total_price: body.totalPrice ?? null,
      status: "pending",
      made: false,
      pickup,
      state,
      location,
    };

    let data: { id: string; order_number: string | null } | null = null;
    let insertError: { code?: string | null; message?: string | null } | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await client.from("orders").insert(payload).select("id,order_number").single();
      if (!result.error) {
        data = result.data;
        insertError = null;
        break;
      }
      if (result.error.message?.includes("label_image_url")) {
        const { label_image_url, ...payloadWithoutLabel } = payload;
        payload = payloadWithoutLabel;
        insertError = result.error;
        continue;
      }
      if (isOrderNumberConflict(result.error)) {
        order_number = await generateOrderNumber();
        payload = { ...payload, order_number };
        insertError = result.error;
        continue;
      }
      throw new Error(result.error.message);
    }
    if (!data) {
      const message = insertError?.message || "Unable to place order.";
      throw new Error(message);
    }

    const skipEmail =
      typeof body.paymentMethod === "string" && body.paymentMethod.toLowerCase().includes("woo");
    const ordersRecipients = skipEmail ? [] : getOrdersRecipients();
    if (ordersRecipients.length > 0) {
      try {
        await sendOrderEmail(ordersRecipients, {
          orderNumber: data.order_number ?? order_number ?? null,
          title,
          designType: body.designType ?? null,
          quantity: body.quantity ?? null,
          dueDate: due_date,
          customerName: body.customerName?.trim() || null,
          customerEmail: body.customerEmail?.trim() || null,
          totalWeightKg,
          totalPrice: body.totalPrice ?? null,
          notes: body.notes?.trim() || null,
        });
      } catch (error) {
        console.error("Order email failed:", error);
      }
    }

    return NextResponse.json({ id: data.id, orderNumber: data.order_number ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to place order";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
