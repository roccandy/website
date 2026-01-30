import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabase/server";
import { calculatePricing } from "@/lib/pricing";
import { generateOrderNumber } from "@/lib/orderNumbers";
import { createWooOrder } from "@/lib/woo";

type CustomCartItemPayload = {
  id?: string;
  title?: string;
  description?: string;
  categoryId?: string;
  packagingOptionId?: string;
  quantity: number;
  packagingLabel?: string | null;
  jarLidColor?: string | null;
  labelsCount?: number | null;
  labelImageUrl?: string | null;
  labelTypeId?: string | null;
  ingredientLabelsOptIn?: boolean;
  jacket?: string | null;
  jacketType?: string | null;
  jacketColorOne?: string | null;
  jacketColorTwo?: string | null;
  textColor?: string | null;
  heartColor?: string | null;
  flavor?: string | null;
  logoUrl?: string | null;
  designType?: string | null;
  designText?: string | null;
  jacketExtras?: Array<{ jacket: "rainbow" | "two_colour" | "pinstripe" }>;
};

type PremadeCartItemPayload = {
  premadeId: string;
  quantity: number;
};

type CreateWooOrderPayload = {
  dueDate?: string;
  pickup?: boolean;
  paymentPreference?: string | null;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    organizationName?: string;
    addressLine1?: string;
    addressLine2?: string;
    suburb?: string;
    postcode?: string;
    state?: string;
  };
  customItems: CustomCartItemPayload[];
  premadeItems: PremadeCartItemPayload[];
};

const DEFAULT_COUNTRY = "AU";

function buildOrderNumbers(hasCustom: boolean, hasPremade: boolean, base: string) {
  if (hasCustom && hasPremade) {
    return { baseOrderNumber: base, customOrderNumber: `${base}-a`, premadeOrderNumber: `${base}-b` };
  }
  return { baseOrderNumber: base, customOrderNumber: base, premadeOrderNumber: base };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateWooOrderPayload;
    if (!body?.customer?.email || !body?.customer?.firstName || !body?.customer?.lastName) {
      return NextResponse.json({ error: "Customer details are required." }, { status: 400 });
    }

    const customItems = body.customItems ?? [];
    const premadeItems = body.premadeItems ?? [];
    if (customItems.length === 0 && premadeItems.length === 0) {
      return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
    }

    const customProductIdRaw = process.env.WOO_CUSTOM_PRODUCT_ID?.trim();
    const customProductId = customProductIdRaw ? Number(customProductIdRaw) : null;
    if (customItems.length > 0 && (!customProductId || !Number.isFinite(customProductId))) {
      return NextResponse.json(
        { error: "Woo custom product ID is not configured." },
        { status: 500 }
      );
    }

    const client = supabaseServerClient;
    const premadeById = new Map<string, {
      id: string;
      name: string;
      price: number;
      weight_g: number;
      woo_product_id: string | null;
      description: string;
    }>();

    if (premadeItems.length > 0) {
      const premadeIds = premadeItems.map((item) => item.premadeId);
      const { data, error } = await client
        .from("premade_candies")
        .select("id,name,price,weight_g,woo_product_id,description")
        .in("id", premadeIds);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      (data ?? []).forEach((row) => premadeById.set(row.id, {
        id: row.id,
        name: row.name,
        price: Number(row.price),
        weight_g: Number(row.weight_g),
        woo_product_id: row.woo_product_id ?? null,
        description: row.description ?? "",
      }));
    }

    const dueDate = body.dueDate ?? null;
    const pickup = Boolean(body.pickup);
    const paymentPreference = body.paymentPreference?.trim() || null;
    const { customer } = body;

    const billing = {
      first_name: customer.firstName.trim(),
      last_name: customer.lastName.trim(),
      email: customer.email.trim(),
      phone: customer.phone.trim(),
      address_1: pickup ? "" : customer.addressLine1?.trim() ?? "",
      address_2: pickup ? "" : customer.addressLine2?.trim() ?? "",
      city: pickup ? "" : customer.suburb?.trim() ?? "",
      state: pickup ? "" : customer.state?.trim() ?? "",
      postcode: pickup ? "" : customer.postcode?.trim() ?? "",
      country: DEFAULT_COUNTRY,
    };

    const lineItems: Array<{
      product_id: number;
      name?: string;
      quantity: number;
      total?: string;
      meta_data?: Array<{ key: string; value: string }>;
    }> = [];

    const orderPayloads: Array<Record<string, unknown>> = [];

    const hasCustom = customItems.length > 0;
    const hasPremade = premadeItems.length > 0;
    const baseOrderNumber = await generateOrderNumber();
    const orderNumbers = buildOrderNumbers(hasCustom, hasPremade, baseOrderNumber);

    for (const item of customItems) {
      if (!item.categoryId || !item.packagingOptionId) {
        return NextResponse.json({ error: "Custom item is missing category or packaging." }, { status: 400 });
      }

      const pricing = await calculatePricing({
        categoryId: item.categoryId,
        packaging: [{ optionId: item.packagingOptionId, quantity: item.quantity }],
        labelsCount: item.labelsCount ?? undefined,
        dueDate: dueDate ?? undefined,
        extras: item.jacketExtras ?? undefined,
      });

      const totalPrice = pricing.total;
      const totalWeightKg = pricing.totalWeightKg;
      if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
        return NextResponse.json({ error: "Custom item pricing failed." }, { status: 400 });
      }

      lineItems.push({
        product_id: customProductId!,
        name: item.title?.trim() ? `Custom order: ${item.title.trim()}` : "Custom order",
        quantity: 1,
        total: totalPrice.toFixed(2),
      });

      orderPayloads.push({
        order_number: orderNumbers.customOrderNumber,
        title: item.title?.trim() || null,
        order_description: item.description?.trim() || null,
        customer_name: `${customer.firstName.trim()} ${customer.lastName.trim()}`.trim(),
        customer_email: customer.email.trim(),
        first_name: customer.firstName.trim(),
        last_name: customer.lastName.trim(),
        phone: customer.phone.trim(),
        organization_name: customer.organizationName?.trim() || null,
        address_line1: pickup ? null : customer.addressLine1?.trim() || null,
        address_line2: pickup ? null : customer.addressLine2?.trim() || null,
        suburb: pickup ? null : customer.suburb?.trim() || null,
        postcode: pickup ? null : customer.postcode?.trim() || null,
        state: pickup ? null : customer.state?.trim() || null,
        location: pickup ? "Pickup" : customer.suburb?.trim() || null,
        pickup,
        category_id: item.categoryId,
        packaging_option_id: item.packagingOptionId,
        quantity: item.quantity,
        jar_lid_color: item.jarLidColor ?? null,
        labels_count: item.labelsCount ?? null,
        jacket: item.jacket ?? null,
        design_type: item.designType ?? null,
        design_text: item.designText ?? null,
        jacket_type: item.jacketType ?? null,
        jacket_color_one: item.jacketColorOne ?? null,
        jacket_color_two: item.jacketColorTwo ?? null,
        text_color: item.textColor ?? null,
        heart_color: item.heartColor ?? null,
        flavor: item.flavor ?? null,
        payment_method: paymentPreference ?? "Woo Checkout",
        logo_url: item.logoUrl ?? null,
        label_image_url: item.labelImageUrl ?? null,
        label_type_id: item.labelTypeId ?? null,
        notes: item.ingredientLabelsOptIn ? "Ingredient labels requested." : null,
        due_date: dueDate,
        total_weight_kg: totalWeightKg,
        total_price: totalPrice,
        status: "pending_payment",
        made: false,
      });
    }

    for (const item of premadeItems) {
      const premade = premadeById.get(item.premadeId);
      if (!premade) {
        return NextResponse.json({ error: "Premade item not found." }, { status: 400 });
      }
      if (!premade.woo_product_id) {
        return NextResponse.json({ error: `Premade item ${premade.name} is not synced to Woo.` }, { status: 400 });
      }

      const weightKg = (premade.weight_g * item.quantity) / 1000;
      const totalPrice = premade.price * item.quantity;

      lineItems.push({
        product_id: Number(premade.woo_product_id),
        quantity: item.quantity,
        total: totalPrice.toFixed(2),
      });

      orderPayloads.push({
        order_number: orderNumbers.premadeOrderNumber,
        title: premade.name,
        order_description: premade.description ?? null,
        customer_name: `${customer.firstName.trim()} ${customer.lastName.trim()}`.trim(),
        customer_email: customer.email.trim(),
        first_name: customer.firstName.trim(),
        last_name: customer.lastName.trim(),
        phone: customer.phone.trim(),
        organization_name: customer.organizationName?.trim() || null,
        address_line1: pickup ? null : customer.addressLine1?.trim() || null,
        address_line2: pickup ? null : customer.addressLine2?.trim() || null,
        suburb: pickup ? null : customer.suburb?.trim() || null,
        postcode: pickup ? null : customer.postcode?.trim() || null,
        state: pickup ? null : customer.state?.trim() || null,
        location: pickup ? "Pickup" : customer.suburb?.trim() || null,
        pickup,
        design_type: "premade",
        design_text: premade.name,
        payment_method: paymentPreference ?? "Woo Checkout",
        due_date: dueDate,
        quantity: item.quantity,
        total_weight_kg: weightKg,
        total_price: totalPrice,
        status: "pending_payment",
        made: false,
      });
    }

    const wooOrder = await createWooOrder({
      status: "pending",
      set_paid: false,
      billing,
      shipping: pickup ? billing : billing,
      customer_note: dueDate ? `Requested date: ${dueDate}` : undefined,
      line_items: lineItems,
      meta_data: [
        { key: "rc_source", value: "roccandy-next" },
        { key: "rc_due_date", value: dueDate ?? "" },
        { key: "rc_pickup", value: pickup ? "true" : "false" },
        ...(paymentPreference ? [{ key: "rc_payment_preference", value: paymentPreference }] : []),
      ],
    });

    if (!wooOrder?.payment_url) {
      return NextResponse.json({ error: "Woo payment URL missing." }, { status: 500 });
    }

    const enrichedPayloads = orderPayloads.map((payload) => ({
      ...payload,
      woo_order_id: String(wooOrder.id),
      woo_order_status: wooOrder.status ?? null,
      woo_order_key: wooOrder.order_key ?? null,
      woo_payment_url: wooOrder.payment_url ?? null,
    }));

    const { error: insertError } = await client.from("orders").insert(enrichedPayloads);
    if (insertError) {
      console.error("Supabase order insert failed:", insertError);
    }

    return NextResponse.json({ paymentUrl: wooOrder.payment_url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create Woo order";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
