import { supabaseServerClient } from "@/lib/supabase/server";
import { calculatePricing } from "@/lib/pricing";
import { generateOrderNumber } from "@/lib/orderNumbers";
import type { CheckoutOrderPayload, CustomCartItemPayload, PremadeCartItemPayload } from "@/lib/checkoutTypes";

const DEFAULT_COUNTRY = "AU";

type OrderNumberBundle = {
  baseOrderNumber: string;
  customOrderNumber: string;
  premadeOrderNumber: string;
};

type PremadeRow = {
  id: string;
  name: string;
  price: number;
  weight_g: number;
  woo_product_id: string | null;
  description: string;
};

type WooLineItem = {
  product_id: number;
  name?: string;
  quantity: number;
  total?: string;
};

type OrderInsertPayload = Record<string, unknown>;

type BuildContextResult = {
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  dueDate: string | null;
  pickup: boolean;
  paymentPreference: string | null;
  lineItems: WooLineItem[];
  orderPayloads: OrderInsertPayload[];
  orderNumbers: OrderNumberBundle;
  totalAmount: number;
};

function buildOrderNumbers(hasCustom: boolean, hasPremade: boolean, base: string): OrderNumberBundle {
  if (hasCustom && hasPremade) {
    return { baseOrderNumber: base, customOrderNumber: `${base}-a`, premadeOrderNumber: `${base}-b` };
  }
  return { baseOrderNumber: base, customOrderNumber: base, premadeOrderNumber: base };
}

async function loadPremadeItems(premadeItems: PremadeCartItemPayload[]) {
  const premadeById = new Map<string, PremadeRow>();
  if (premadeItems.length === 0) return premadeById;

  const premadeIds = premadeItems.map((item) => item.premadeId);
  const { data, error } = await supabaseServerClient
    .from("premade_candies")
    .select("id,name,price,weight_g,woo_product_id,description")
    .in("id", premadeIds);
  if (error) {
    throw new Error(error.message);
  }
  (data ?? []).forEach((row) =>
    premadeById.set(row.id, {
      id: row.id,
      name: row.name,
      price: Number(row.price),
      weight_g: Number(row.weight_g),
      woo_product_id: row.woo_product_id ?? null,
      description: row.description ?? "",
    })
  );
  return premadeById;
}

function buildBilling(customer: CheckoutOrderPayload["customer"], pickup: boolean) {
  return {
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
}

function assertBasePayload(body: CheckoutOrderPayload) {
  if (!body?.customer?.email || !body?.customer?.firstName || !body?.customer?.lastName) {
    throw new Error("Customer details are required.");
  }
  const customItems = body.customItems ?? [];
  const premadeItems = body.premadeItems ?? [];
  if (customItems.length === 0 && premadeItems.length === 0) {
    throw new Error("Cart is empty.");
  }
}

async function buildCustomItemLine(
  item: CustomCartItemPayload,
  dueDate: string | null,
  customProductId: number
) {
  if (!item.categoryId || !item.packagingOptionId) {
    throw new Error("Custom item is missing category or packaging.");
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
    throw new Error("Custom item pricing failed.");
  }

  return {
    lineItem: {
      product_id: customProductId,
      name: item.title?.trim() ? `Custom order: ${item.title.trim()}` : "Custom order",
      quantity: 1,
      total: totalPrice.toFixed(2),
    },
    totalPrice,
    totalWeightKg,
  };
}

export async function buildWooOrderContext(body: CheckoutOrderPayload): Promise<BuildContextResult> {
  assertBasePayload(body);

  const customItems = body.customItems ?? [];
  const premadeItems = body.premadeItems ?? [];
  const hasCustom = customItems.length > 0;
  const hasPremade = premadeItems.length > 0;

  const customProductIdRaw = process.env.WOO_CUSTOM_PRODUCT_ID?.trim();
  const customProductId = customProductIdRaw ? Number(customProductIdRaw) : null;
  if (hasCustom && (!customProductId || !Number.isFinite(customProductId))) {
    throw new Error("Woo custom product ID is not configured.");
  }

  const premadeById = await loadPremadeItems(premadeItems);
  const dueDate = body.dueDate ?? null;
  const pickup = Boolean(body.pickup);
  const paymentPreference = body.paymentPreference?.trim() || null;
  const customer = body.customer;
  const billing = buildBilling(customer, pickup);
  const lineItems: WooLineItem[] = [];
  const orderPayloads: OrderInsertPayload[] = [];

  const baseOrderNumber = await generateOrderNumber();
  const orderNumbers = buildOrderNumbers(hasCustom, hasPremade, baseOrderNumber);

  for (const item of customItems) {
    const { lineItem, totalPrice, totalWeightKg } = await buildCustomItemLine(
      item,
      dueDate,
      customProductId!
    );
    lineItems.push(lineItem);
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
      payment_method: paymentPreference ?? null,
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
      throw new Error("Premade item not found.");
    }
    if (!premade.woo_product_id) {
      throw new Error(`Premade item ${premade.name} is not synced to Woo.`);
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
      payment_method: paymentPreference ?? null,
      due_date: dueDate,
      quantity: item.quantity,
      total_weight_kg: weightKg,
      total_price: totalPrice,
      status: "pending_payment",
      made: false,
    });
  }

  const totalAmount = lineItems.reduce((sum, item) => sum + Number(item.total ?? 0), 0);

  return {
    billing,
    dueDate,
    pickup,
    paymentPreference,
    lineItems,
    orderPayloads,
    orderNumbers,
    totalAmount,
  };
}
