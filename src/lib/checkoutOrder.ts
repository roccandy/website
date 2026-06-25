import { supabaseAdminClient } from "@/lib/supabase/admin";
import { buildCustomPricingInput, calculatePricing } from "@/lib/pricing";
import { buildSplitOrderNumber, generateOrderNumber } from "@/lib/orderNumbers";
import { getQuoteBlocks, getSettings, type QuoteBlock } from "@/lib/data";
import type { CheckoutOrderPayload, CustomCartItemPayload, PremadeCartItemPayload } from "@/lib/checkoutTypes";
import { CHECKOUT_TEST_PROMO_TOTAL, isCheckoutTestPromoCode } from "@/lib/checkoutPromo";

const DEFAULT_COUNTRY = "AU";

type OrderNumberBundle = {
  baseOrderNumber: string;
  customOrderNumbers: string[];
  customOrderNumber: string;
  premadeOrderNumber: string | null;
};

type PremadeRow = {
  id: string;
  name: string;
  price: number;
  weight_g: number;
  description: string;
};

type CheckoutLineItem = {
  item_id: string;
  name?: string;
  quantity: number;
  total?: string;
};

type OrderInsertPayload = Record<string, unknown>;

export type CheckoutOrderContext = {
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
  lineItems: CheckoutLineItem[];
  orderPayloads: OrderInsertPayload[];
  orderNumbers: OrderNumberBundle;
  totalAmount: number;
  taxAmount: number;
  shippingAmount: number;
};

const isDateBlocked = (dateKey: string, blocks: QuoteBlock[]) =>
  blocks.some((block) => dateKey >= block.start_date && dateKey <= block.end_date);

function buildOrderNumbers(customCount: number, hasPremade: boolean, base: string): OrderNumberBundle {
  const splitCount = customCount + (hasPremade ? 1 : 0);
  const shouldSplit = splitCount > 1;
  const customOrderNumbers = Array.from({ length: customCount }, (_, index) =>
    shouldSplit ? buildSplitOrderNumber(base, index) : base
  );
  const premadeOrderNumber = hasPremade
    ? shouldSplit
      ? buildSplitOrderNumber(base, customCount)
      : base
    : null;

  return {
    baseOrderNumber: base,
    customOrderNumbers,
    customOrderNumber: customOrderNumbers[0] ?? base,
    premadeOrderNumber,
  };
}

function assertWeightWithinLimit(weightKg: number, maxTotalKg: number) {
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error("Order weight is required.");
  }
  if (weightKg > maxTotalKg) {
    throw new Error(`Max total kg is ${maxTotalKg}.`);
  }
}

async function loadPremadeItems(premadeItems: PremadeCartItemPayload[]) {
  const premadeById = new Map<string, PremadeRow>();
  if (premadeItems.length === 0) return premadeById;

  const premadeIds = premadeItems.map((item) => item.premadeId);
  const { data, error } = await supabaseAdminClient
    .from("premade_candies")
    .select("id,name,price,weight_g,description")
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
  if (!body?.customer?.firstName?.trim()) {
    throw new Error("First name is required.");
  }
  if (!body?.customer?.lastName?.trim()) {
    throw new Error("Last name is required.");
  }
  if (!body?.customer?.email?.trim()) {
    throw new Error("Email address is required.");
  }
  if (!body?.customer?.phone?.trim()) {
    throw new Error("Phone number is required.");
  }
  const customItems = body.customItems ?? [];
  const premadeItems = body.premadeItems ?? [];
  if (customItems.length === 0 && premadeItems.length === 0) {
    throw new Error("Cart is empty.");
  }
  if (!body.dueDate?.trim()) {
    throw new Error("Requested date is required.");
  }
  if (!body.pickup) {
    if (
      !body.customer.addressLine1?.trim() ||
      !body.customer.suburb?.trim() ||
      !body.customer.postcode?.trim() ||
      !body.customer.state?.trim()
    ) {
      throw new Error("Delivery address is incomplete.");
    }
  }

  const hasBrandedCustomItems = customItems.some((item) => item.categoryId === "branded" || item.designType === "branded");
  if (hasBrandedCustomItems && !body.customer.organizationName?.trim()) {
    throw new Error("Organisation name is required for branded candy orders.");
  }
}

async function buildCustomItemLine(
  item: CustomCartItemPayload,
  dueDate: string | null
) {
  const pricingInput = buildCustomPricingInput({
    categoryId: item.categoryId,
    packagingOptionId: item.packagingOptionId,
    quantity: item.quantity,
    labelsCount: item.labelsCount ?? undefined,
    ingredientLabelsCount: item.ingredientLabelsCount ?? undefined,
    ingredientLabelsOptIn: item.ingredientLabelsOptIn ?? false,
    dueDate: dueDate ?? undefined,
    jacketExtras: item.jacketExtras ?? undefined,
    jacket: item.jacket ?? null,
  });
  if (!pricingInput) {
    throw new Error("Custom item is missing category or packaging.");
  }
  const pricing = await calculatePricing(pricingInput);

  const totalPrice = pricing.total;
  const totalWeightKg = pricing.totalWeightKg;
  if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
    throw new Error("Custom item pricing failed.");
  }

  return {
    lineItem: {
      item_id: item.categoryId || item.designType || item.id || "custom-candy",
      name: item.title?.trim() ? `Custom order: ${item.title.trim()}` : "Custom order",
      quantity: 1,
      total: totalPrice.toFixed(2),
    },
    totalPrice,
    totalWeightKg,
  };
}

function applyCheckoutPromoOverride(lineItems: CheckoutLineItem[], orderPayloads: OrderInsertPayload[]) {
  lineItems.forEach((item, index) => {
    item.total = index === 0 ? CHECKOUT_TEST_PROMO_TOTAL.toFixed(2) : "0.00";
  });
  orderPayloads.forEach((payload, index) => {
    payload.total_price = index === 0 ? CHECKOUT_TEST_PROMO_TOTAL : 0;
  });
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateIncludedGst(totalAmount: number) {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) return 0;
  return roundMoney(totalAmount / 11);
}

export async function buildCheckoutOrderContext(
  body: CheckoutOrderPayload,
  options: { baseOrderNumber?: string | null } = {},
): Promise<CheckoutOrderContext> {
  assertBasePayload(body);

  const customItems = body.customItems ?? [];
  const premadeItems = body.premadeItems ?? [];
  const hasCustom = customItems.length > 0;
  const hasPremade = premadeItems.length > 0;

  const premadeById = await loadPremadeItems(premadeItems);
  const dueDate = body.dueDate?.trim() ?? null;
  const pickup = Boolean(body.pickup);
  const paymentPreference = body.paymentPreference?.trim() || null;
  const settings = await getSettings();
  const maxTotalKg = Number(settings.max_total_kg);
  if (hasCustom && dueDate) {
    const quoteBlocks = await getQuoteBlocks();
    if (isDateBlocked(dueDate, quoteBlocks)) {
      throw new Error("Selected date is unavailable.");
    }
  }
  const customer = body.customer;
  const organizationName = customer.organizationName?.trim() || null;
  const billing = buildBilling(customer, pickup);
  const lineItems: CheckoutLineItem[] = [];
  const orderPayloads: OrderInsertPayload[] = [];

  const baseOrderNumber = options.baseOrderNumber?.trim() || (await generateOrderNumber());
  const orderNumbers = buildOrderNumbers(customItems.length, hasPremade, baseOrderNumber);

  for (const [index, item] of customItems.entries()) {
    const { lineItem, totalPrice, totalWeightKg } = await buildCustomItemLine(
      item,
      dueDate
    );
    assertWeightWithinLimit(totalWeightKg, maxTotalKg);
    lineItems.push(lineItem);
    orderPayloads.push({
      order_number: orderNumbers.customOrderNumbers[index] ?? orderNumbers.customOrderNumber,
      title: item.categoryId === "branded" || item.designType === "branded" ? organizationName : item.title?.trim() || null,
      order_description: item.description?.trim() || null,
      customer_name: `${customer.firstName.trim()} ${customer.lastName.trim()}`.trim(),
      customer_email: customer.email.trim(),
      first_name: customer.firstName.trim(),
      last_name: customer.lastName.trim(),
      phone: customer.phone.trim(),
      organization_name: organizationName,
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
      ingredient_labels_count: item.ingredientLabelsCount ?? null,
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

    const weightKg = (premade.weight_g * item.quantity) / 1000;
    const totalPrice = premade.price * item.quantity;
    assertWeightWithinLimit(weightKg, maxTotalKg);

    lineItems.push({
      item_id: premade.id,
      name: premade.name,
      quantity: item.quantity,
      total: totalPrice.toFixed(2),
    });

    orderPayloads.push({
      order_number: orderNumbers.premadeOrderNumber ?? baseOrderNumber,
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

  if (isCheckoutTestPromoCode(body.promoCode)) {
    applyCheckoutPromoOverride(lineItems, orderPayloads);
  }

  const baseTotal = lineItems.reduce((sum, item) => sum + Number(item.total ?? 0), 0);
  const totalAmount = baseTotal;
  const shippingAmount = 0;
  const taxAmount = calculateIncludedGst(totalAmount);

  return {
    billing,
    dueDate,
    pickup,
    paymentPreference,
    lineItems,
    orderPayloads,
    orderNumbers,
    totalAmount,
    taxAmount,
    shippingAmount,
  };
}
