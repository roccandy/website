"use server";

import { logAdminActivity, type AdminActivityInput } from "@/lib/adminActivity";
import { requireAdminWriteAccess } from "@/lib/adminAuth";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { generateOrderNumber, normalizeBaseOrderNumber } from "@/lib/orderNumbers";
import {
  getOrdersRecipients,
  sendCustomerOrderSummaryEmail,
  sendCustomerRefundEmail,
  sendOrderEmail,
} from "@/lib/email";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/data";
import { buildPricingContext } from "@/lib/pricing";
import {
  calculateAdminLargeOrderPricingWithContext,
  normalizeAdminBatchWeights,
  suggestedAdminBatchWeights,
  type AdminDiscountType,
} from "@/lib/adminLargeOrders";
import {
  createAndPublishAdminSquareInvoice,
  createAdminSquareInvoiceDraft,
  defaultAdminSquareInvoiceTitle,
  removeAdminSquareInvoice,
  updateAndPublishAdminSquareInvoice,
} from "@/lib/adminOrderIntegrations";
import { refundSquarePayment, refundPayPalCapture } from "@/lib/refunds";
import { persistOrderRefund, persistOrderRefunds } from "@/lib/orderRefunds";
import { buildAdminOrderSummaryEmailPayload } from "@/lib/orderEmailSummary";
import {
  ADMIN_PREMADE_ORDER_MARKER,
  isAdminPremadeCategoryId,
  isAdminPremadeOrder,
} from "@/lib/adminPremadeOrder";
import { findFirstAvailableSlotIndexForDate } from "./productionScheduleShared";
import { isAdminManagedCustomOrder } from "./scheduleVisibility";

const ORDERS_PATH = "/admin/orders";
const ADDITIONAL_ITEMS_PATH = "/admin/orders/additional-items";
const OPEN_OVERRIDE_REASON = "Open override";
const MANUAL_BLOCK_REASON = "Manual block";
const INGREDIENT_LABELS_NOTE = "Ingredient labels requested.";
const ORDER_SUFFIX_PATTERN = /-[a-z]+$/i;
const toastRedirect = (base: string, tone: "success" | "error", message: string) =>
  `${base}?toast=${tone}&message=${encodeURIComponent(message)}`;
const normalizeWeddingDesignText = (value: string | null) =>
  value
    ?.replace(/\s*[\u2665\u2764]\ufe0f?\s*/g, " ❤️ ")
    .replace(/\ufe0f/g, "")
    .replace(/\u2764/g, "❤️")
    .replace(/\s+/g, " ")
    .trim() || null;
const isInvalidIntegerInputError = (message: string) =>
  message.toLowerCase().includes("invalid input syntax for type integer");
const isInlineResponse = (formData: FormData) => formData.get("response_mode")?.toString() === "inline";
const normalizeAdminDiscountType = (value: string | null | undefined): AdminDiscountType => {
  if (value === "percent" || value === "fixed") return value;
  return "none";
};
const toSafeInteger = (value: number, fallback = 1) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(fallback, Math.round(value));
};
const toMoneyCents = (value: number) => Math.round(value * 100);
const roundKg = (value: number) => Math.round(value * 100) / 100;
const refundedCentsForOrder = (order: { refunded_amount?: number | null; refunded_at?: string | null; status?: string | null; total_price?: number | null }) => {
  const stored = Number(order.refunded_amount);
  if (Number.isFinite(stored) && stored > 0) return toMoneyCents(stored);
  if (order.refunded_at && order.status !== "partially-refunded") return toMoneyCents(Number(order.total_price ?? 0));
  return 0;
};
const remainingRefundCentsForOrder = (order: { refunded_amount?: number | null; refunded_at?: string | null; status?: string | null; total_price?: number | null }) =>
  Math.max(0, toMoneyCents(Number(order.total_price ?? 0)) - refundedCentsForOrder(order));

const syncIngredientLabelsNote = (notes: string | null, enabled: boolean) => {
  const existingLines = (notes ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.toLowerCase() !== INGREDIENT_LABELS_NOTE.toLowerCase());

  if (enabled) {
    existingLines.push(INGREDIENT_LABELS_NOTE);
  }

  return existingLines.length > 0 ? existingLines.join("\n") : null;
};

const isNoProductionDay = (slotDate: string, settings: Awaited<ReturnType<typeof getSettings>>) => {
  const date = new Date(`${slotDate}T00:00:00`);
  const day = date.getDay();
  if (day === 0) return settings.no_production_sun;
  if (day === 1) return settings.no_production_mon;
  if (day === 2) return settings.no_production_tue;
  if (day === 3) return settings.no_production_wed;
  if (day === 4) return settings.no_production_thu;
  if (day === 5) return settings.no_production_fri;
  return settings.no_production_sat;
};

async function assertAssignableDate(slotDate: string) {
  const settings = await getSettings();
  if (isNoProductionDay(slotDate, settings)) {
    throw new Error("This production date is unavailable.");
  }
}

const isOrderNumberConflict = (error: { code?: string | null; message?: string | null }) => {
  if (error.code === "23505") return true;
  const message = error.message?.toLowerCase() ?? "";
  return message.includes("order_number") && (message.includes("duplicate") || message.includes("unique"));
};

const formatPremadeWeight = (weightG: number) => {
  if (!Number.isFinite(weightG) || weightG <= 0) return "";
  if (weightG >= 1000) {
    const kg = weightG / 1000;
    return `${kg % 1 === 0 ? kg.toFixed(0) : kg.toFixed(1)}kg`;
  }
  return `${weightG}g`;
};

const describeOrderTarget = (input: {
  orderNumber?: string | null;
  title?: string | null;
  customerName?: string | null;
}) => {
  const label = input.title?.trim() || input.customerName?.trim() || "Order";
  const orderNumber = input.orderNumber?.trim();
  return orderNumber ? `#${orderNumber} ${label}`.trim() : label;
};

async function sendAdminCreatedCustomerOrderEmail(order: Record<string, unknown>) {
  const customerEmail = typeof order.customer_email === "string" ? order.customer_email.trim() : "";
  if (!customerEmail) return;
  const pickup = Boolean(order.pickup);
  const billing = {
    address_1: typeof order.address_line1 === "string" ? order.address_line1 : "",
    address_2: typeof order.address_line2 === "string" ? order.address_line2 : "",
    city: typeof order.suburb === "string" ? order.suburb : "",
    state: typeof order.state === "string" ? order.state : "",
    postcode: typeof order.postcode === "string" ? order.postcode : "",
  };
  const paymentAmount = Number(order.total_price);
  const summary = await buildAdminOrderSummaryEmailPayload({
    orderPayloads: [order],
    orderNumber: typeof order.order_number === "string" ? order.order_number : null,
    requestedDate: typeof order.due_date === "string" ? order.due_date : null,
    billing,
    pickup,
    paymentMethod: "Square invoice",
    paymentAmount: Number.isFinite(paymentAmount) ? paymentAmount : 0,
  });
  await sendCustomerOrderSummaryEmail([customerEmail], summary);
}

async function resolveFirstAvailableSlotIndex(
  slotDate: string,
  client: typeof supabaseAdminClient,
  slotsPerDay: number,
) {
  const [{ data: slots, error: slotsError }, { data: assignments, error: assignmentsError }] = await Promise.all([
    client.from("production_slots").select("id,slot_date,slot_index,capacity_kg,status,notes,created_at"),
    client.from("order_slots").select("id,order_id,slot_id,kg_assigned,created_at"),
  ]);
  if (slotsError) throw new Error(slotsError.message);
  if (assignmentsError) throw new Error(assignmentsError.message);

  return findFirstAvailableSlotIndexForDate({
    date: slotDate,
    slotsPerDay,
    assignments: assignments ?? [],
    slots: slots ?? [],
  });
}

async function upsertOrderShared(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect" });
  const inlineResponse = isInlineResponse(formData);
  const submitIntent = formData.get("submit_intent")?.toString() || "save";
  const shouldScheduleAfterCreate = submitIntent === "save_and_schedule";
  const productionSlotDate = formData.get("production_slot_date")?.toString() || null;
  const redirectTo = formData.get("redirect_to")?.toString() || null;
  const toastSuccess = formData.get("toast_success")?.toString() || null;
  const toastError = formData.get("toast_error")?.toString() || null;
  const sendUpdatedInvoice = formData.get("send_updated_invoice")?.toString() === "on";
  const id = formData.get("id")?.toString() || undefined;
  const order_number_raw = formData.get("order_number")?.toString() || null;
  const order_number = normalizeBaseOrderNumber(order_number_raw);
  const title = formData.get("title")?.toString() || null;
  const order_description = formData.get("order_description")?.toString() || null;
  const customer_name_raw = formData.get("customer_name")?.toString() || null;
  const customer_email = formData.get("customer_email")?.toString() || null;
  const category_id_raw = formData.get("category_id")?.toString() || null;
  const category_id = isAdminPremadeCategoryId(category_id_raw) ? null : category_id_raw;
  const packaging_option_id = formData.get("packaging_option_id")?.toString() || null;
  const quantity = formData.get("quantity") ? Number(formData.get("quantity")) : null;
  const labels_count = formData.get("labels_count") ? Number(formData.get("labels_count")) : null;
  const jacket = formData.get("jacket")?.toString() || null;
  const design_type = formData.get("design_type")?.toString() || null;
  const design_text_raw = formData.get("design_text")?.toString() || null;
  const design_text = design_text_raw?.trim() || null;
  const adminPremadeModeRaw = formData.get("admin_premade_mode")?.toString() || null;
  const adminPremadeMode = adminPremadeModeRaw?.trim() || null;
  const jacket_type_raw = formData.get("jacket_type")?.toString() || null;
  const jacket_type = jacket_type_raw?.trim() || null;
  const jacket_color_one = formData.get("jacket_color_one")?.toString() || null;
  const jacket_color_two = formData.get("jacket_color_two")?.toString() || null;
  const text_color_raw = formData.get("text_color")?.toString() || null;
  const heart_color_raw = formData.get("heart_color")?.toString() || null;
  const flavor = formData.get("flavor")?.toString() || null;
  const jar_lid_color = formData.get("jar_lid_color")?.toString() || null;
  const hasLogoUrlField = formData.has("logo_url");
  const logo_url = hasLogoUrlField ? formData.get("logo_url")?.toString() || null : null;
  const label_image_url = formData.get("label_image_url")?.toString() || null;
  const hasDueDateField = formData.has("due_date");
  const due_date = hasDueDateField ? formData.get("due_date")?.toString() || null : null;
  const created_at_raw = formData.get("created_at")?.toString() || null;
  const first_name = formData.get("first_name")?.toString() || null;
  const last_name = formData.get("last_name")?.toString() || null;
  const phone = formData.get("phone")?.toString() || null;
  const organization_name = formData.get("organization_name")?.toString() || null;
  const address_line1 = formData.get("address_line1")?.toString() || null;
  const address_line2 = formData.get("address_line2")?.toString() || null;
  const suburb = formData.get("suburb")?.toString() || null;
  const postcode = formData.get("postcode")?.toString() || null;
  const order_weight_g = formData.get("order_weight_g");
  const total_weight_kg_input = formData.get("total_weight_kg");
  const total_weight_kg_raw =
    order_weight_g !== null
      ? Number(order_weight_g) / 1000
      : total_weight_kg_input !== null
        ? Number(total_weight_kg_input)
        : NaN;
  const total_weight_kg = Number.isFinite(total_weight_kg_raw) ? roundKg(total_weight_kg_raw) : NaN;
  const total_price = formData.get("total_price") ? Number(formData.get("total_price")) : null;
  const submittedBatchWeights = normalizeAdminBatchWeights(formData.getAll("batch_weight_kg").map((value) => value.toString()));
  const hasDiscountTypeControl = formData.has("admin_discount_type");
  const hasDiscountValueControl = formData.has("admin_discount_value");
  const hasPriceOverrideControl = formData.has("admin_price_override");
  const admin_discount_type = (formData.get("admin_discount_type")?.toString() || "none") as AdminDiscountType;
  const admin_discount_value_raw = Number(formData.get("admin_discount_value") || 0);
  const admin_discount_value =
    Number.isFinite(admin_discount_value_raw) && admin_discount_value_raw > 0 ? admin_discount_value_raw : null;
  const admin_price_override_raw = Number(formData.get("admin_price_override") || NaN);
  const admin_price_override =
    Number.isFinite(admin_price_override_raw) && admin_price_override_raw >= 0 ? admin_price_override_raw : null;
  const status = formData.get("status")?.toString() || null;
  const payment_method = formData.get("payment_method")?.toString() || null;
  const notes = formData.get("notes")?.toString() || null;
  const customer_note = formData.get("customer_note")?.toString() || null;
  const hasLabelsControl = formData.has("labels_opt_in");
  const labelsOptIn = formData.get("labels_opt_in")?.toString() === "on";
  const hasIngredientLabelsControl = formData.has("ingredient_labels_opt_in");
  const ingredientLabelsOptIn = formData.get("ingredient_labels_opt_in")?.toString() === "on";
  const ingredientLabelsCountRaw = formData.get("ingredient_labels_count");
  const ingredientLabelsCount =
    ingredientLabelsCountRaw !== null && ingredientLabelsCountRaw.toString().trim() !== ""
      ? Number(ingredientLabelsCountRaw)
      : null;
  const pickup_raw = formData.get("pickup");
  const pickup = pickup_raw !== null ? pickup_raw === "on" : null;
  const state = formData.get("state")?.toString() || null;
  const premadeIds = formData.getAll("premade_id").map((value) => value.toString().trim());
  const premadeQuantities = formData.getAll("premade_quantity").map((value) => value.toString().trim());
  const premadeSelections = premadeIds
    .map((value, index) => {
      const quantity = Number(premadeQuantities[index]);
      if (!value || !Number.isFinite(quantity) || quantity <= 0) return null;
      return { id: value, quantity };
    })
    .filter((item): item is { id: string; quantity: number } => Boolean(item));

  const client = supabaseAdminClient;
  const existing = id
    ? (await client.from("orders").select("*").eq("id", id).maybeSingle()).data
    : null;
  let activity: AdminActivityInput | null = null;
  let postSaveRedirect: string | null = null;
  let inlineTone: "success" | "error" = "success";
  let inlineMessage = toastSuccess ?? "Order Updated";
  const resolvedCategoryId = category_id ?? existing?.category_id ?? null;
  const isAdminPremade =
    isAdminPremadeOrder(existing) ||
    isAdminPremadeOrder({
      category_id: category_id_raw,
      design_type,
      notes,
      title,
    }) ||
    isAdminPremadeOrder({
      category_id: resolvedCategoryId,
      design_type,
      notes,
      title,
    });
  const isBranded = resolvedCategoryId === "branded";
  const isWedding = resolvedCategoryId?.startsWith("weddings");
  const resolvedDesignText = isWedding ? normalizeWeddingDesignText(design_text) : design_text;
  const nameFromParts = [first_name, last_name].filter(Boolean).join(" ") || null;
  const resolvedCustomerName = customer_name_raw ?? nameFromParts ?? existing?.customer_name ?? null;
  const resolvedTextColor = !isBranded && !isAdminPremade ? text_color_raw ?? existing?.text_color ?? null : null;
  const resolvedHeartColor = isWedding && !isAdminPremade ? heart_color_raw ?? existing?.heart_color ?? null : null;
  const resolvedNotes = hasIngredientLabelsControl
    ? syncIngredientLabelsNote(notes ?? existing?.notes ?? null, ingredientLabelsOptIn)
    : notes ?? existing?.notes ?? null;
  const jacketType =
    jacket_type ??
    (jacket === "rainbow"
      ? "rainbow"
      : jacket === "two_colour" || jacket === "two_colour_pinstripe"
        ? "two_colour"
        : jacket === "pinstripe"
          ? "pinstripe"
          : null);
  const created_at_date = created_at_raw ? new Date(created_at_raw) : null;
  const created_at =
    created_at_date && !Number.isNaN(created_at_date.valueOf()) ? created_at_date.toISOString() : null;
  const resolvedDueDate = isAdminPremade
    ? shouldScheduleAfterCreate
      ? productionSlotDate ?? null
      : null
    : hasDueDateField
      ? due_date
      : existing?.due_date ?? null;

  const resolvedWeightKg = Number.isFinite(total_weight_kg)
    ? total_weight_kg
    : existing?.total_weight_kg ?? NaN;
  const syncedTitleFromDesignText =
    id && resolvedDesignText !== null && resolvedDesignText !== (existing?.design_text ?? null)
      ? resolvedDesignText
      : null;
  try {
    if (!Number.isFinite(resolvedWeightKg) || resolvedWeightKg <= 0) {
      throw new Error("Order weight is required.");
    }

    const existingInvoiceStatus = existing?.square_invoice_status?.toUpperCase() ?? null;
    const shouldReplaceSquareInvoice =
      Boolean(
        id &&
          existing?.square_invoice_id &&
          sendUpdatedInvoice &&
          isAdminManagedCustomOrder(existing) &&
          !existing.paid_at &&
          existingInvoiceStatus !== "PAID",
      );
    if (sendUpdatedInvoice && !shouldReplaceSquareInvoice) {
      throw new Error("Updated Square invoices can only be sent for unpaid admin-created orders with an existing Square invoice.");
    }

    const pricingContext = isAdminPremade ? null : await buildPricingContext();
    const settings = pricingContext?.settings ?? (await getSettings());
    const isPriceLocked = Boolean(existing?.admin_price_locked_at || existing?.square_invoice_id) && !shouldReplaceSquareInvoice;
    const existingBatchWeights = normalizeAdminBatchWeights(
      Array.isArray(existing?.admin_batch_weights_kg) ? existing.admin_batch_weights_kg : [],
    );
    const existingBatchWeightsForComparison =
      existingBatchWeights.length > 0
        ? existingBatchWeights
        : Number(existing?.total_weight_kg) > 0
          ? normalizeAdminBatchWeights([existing?.total_weight_kg])
          : [];
    const existingBatchTotal = existingBatchWeights.reduce((sum, weight) => sum + weight, 0);
    const submittedLabelsCount = hasLabelsControl
      ? labelsOptIn && Number.isFinite(labels_count ?? NaN) && Number(labels_count) > 0
        ? Number(labels_count)
        : null
      : labels_count ?? existing?.labels_count ?? null;
    const submittedIngredientLabelsCount = hasIngredientLabelsControl
      ? ingredientLabelsOptIn && Number.isFinite(ingredientLabelsCount ?? NaN) && Number(ingredientLabelsCount) > 0
        ? Number(ingredientLabelsCount)
        : null
      : ingredientLabelsCount ?? existing?.ingredient_labels_count ?? null;
    const existingBatchKey = existingBatchWeightsForComparison.map((weight) => weight.toFixed(2)).join("|");
    const submittedBatchKey = submittedBatchWeights.map((weight) => weight.toFixed(2)).join("|");
    const sizeAffectingFieldsChanged =
      !existing ||
      Math.abs(Number(existing.total_weight_kg ?? 0) - resolvedWeightKg) > 0.02 ||
      (quantity !== null && Number(quantity) !== Number(existing.quantity ?? NaN)) ||
      (packaging_option_id !== null && packaging_option_id !== (existing.packaging_option_id ?? null)) ||
      (category_id !== null && category_id !== (existing.category_id ?? null));
    const priceAffectingFieldsChanged =
      sizeAffectingFieldsChanged ||
      (hasDueDateField && (due_date ?? null) !== (existing?.due_date ?? null)) ||
      (jacket !== null && jacket !== (existing?.jacket ?? null)) ||
      Number(submittedLabelsCount ?? 0) !== Number(existing?.labels_count ?? 0) ||
      Number(submittedIngredientLabelsCount ?? 0) !== Number(existing?.ingredient_labels_count ?? 0) ||
      (submittedBatchWeights.length > 0 && submittedBatchKey !== existingBatchKey) ||
      normalizeAdminDiscountType(admin_discount_type) !== normalizeAdminDiscountType(existing?.admin_discount_type) ||
      Number(admin_discount_value ?? 0) !== Number(existing?.admin_discount_value ?? 0) ||
      Number(admin_price_override ?? 0) !== Number(existing?.admin_price_override ?? 0);
    const existingBatchWeightsMismatch =
      existingBatchWeights.length > 0 && Math.abs(existingBatchTotal - resolvedWeightKg) > 0.02;
    const shouldRegenerateBatchWeights =
      submittedBatchWeights.length === 0 && (sizeAffectingFieldsChanged || existingBatchWeightsMismatch);
    const batchWeightsForPricing =
      submittedBatchWeights.length > 0
        ? submittedBatchWeights
        : !shouldRegenerateBatchWeights && existingBatchWeights.length > 0
          ? existingBatchWeights
          : [];
    const resolvedBatchWeights =
      submittedBatchWeights.length > 0
        ? submittedBatchWeights
        : shouldRegenerateBatchWeights
          ? suggestedAdminBatchWeights(resolvedWeightKg, Number(settings.max_total_kg))
          : existingBatchWeights;
    const shouldCalculateAdminPricing =
      !isAdminPremade && pricingContext && (!existing || shouldReplaceSquareInvoice || (!isPriceLocked && priceAffectingFieldsChanged));
    const adminPricing =
      shouldCalculateAdminPricing
        ? calculateAdminLargeOrderPricingWithContext(
            {
              categoryId: resolvedCategoryId ?? "",
              packagingOptionId: packaging_option_id ?? existing?.packaging_option_id ?? "",
              quantity: quantity ?? existing?.quantity ?? 0,
              labelsCount: submittedLabelsCount,
              ingredientLabelsCount: submittedIngredientLabelsCount,
              dueDate: resolvedDueDate,
              jacket: jacket ?? existing?.jacket ?? null,
              batchWeightsKg: batchWeightsForPricing,
              discountType: admin_discount_type,
              discountValue: admin_discount_value,
              priceOverride: admin_price_override,
            },
            pricingContext,
          )
        : null;

    if (isAdminPremade && resolvedWeightKg > Number(settings.max_total_kg)) {
      throw new Error(`Max total kg per settings is ${settings.max_total_kg}.`);
    }

    const submittedFlavor = flavor?.trim() || null;
    const existingFlavor = existing?.flavor?.trim() || null;
    const existingDesignText = existing?.design_text?.trim() || null;
    const resolvedFlavor = submittedFlavor || existingFlavor || null;
    const resolvedAdminPremadeSelection = isAdminPremade
      ? adminPremadeMode === "premade"
        ? resolvedDesignText ?? existingDesignText ?? null
        : submittedFlavor ?? resolvedDesignText ?? existingFlavor ?? existingDesignText ?? null
      : null;
    const resolvedAdminPremadeFlavor = isAdminPremade
      ? adminPremadeMode === "premade"
        ? null
        : submittedFlavor ?? existingFlavor ?? null
      : resolvedFlavor;
    if (isAdminPremade && !resolvedAdminPremadeSelection) {
      throw new Error("A flavor or pre-made candy is required for premade stock orders.");
    }
    if (isAdminPremade && shouldScheduleAfterCreate && !productionSlotDate) {
      throw new Error("Production date is required to slot this premade order.");
    }

    const premadeStockTitle = resolvedAdminPremadeSelection
      ? `Premade stock - ${resolvedAdminPremadeSelection}`
      : "Premade stock";
    const premadeStockDescription = resolvedAdminPremadeSelection
      ? `${resolvedAdminPremadeSelection} stock batch`
      : "Premade stock batch";

    const basePayload = {
      title: isAdminPremade ? premadeStockTitle : title ?? syncedTitleFromDesignText ?? existing?.title ?? null,
      order_description: isAdminPremade ? premadeStockDescription : order_description ?? existing?.order_description ?? null,
      customer_name: isAdminPremade ? null : resolvedCustomerName,
      customer_email: isAdminPremade ? null : customer_email ?? existing?.customer_email ?? null,
      category_id: isAdminPremade ? null : category_id ?? existing?.category_id ?? null,
      packaging_option_id: isAdminPremade ? null : packaging_option_id ?? existing?.packaging_option_id ?? null,
      quantity: isAdminPremade ? null : quantity ?? existing?.quantity ?? null,
      labels_count: isAdminPremade
        ? null
        : hasLabelsControl
          ? labelsOptIn
            ? submittedLabelsCount
            : null
          : labels_count ?? existing?.labels_count ?? null,
      ingredient_labels_count: isAdminPremade
        ? null
        : hasIngredientLabelsControl
          ? ingredientLabelsOptIn
            ? submittedIngredientLabelsCount
            : null
          : ingredientLabelsCount ?? existing?.ingredient_labels_count ?? null,
      jacket: isAdminPremade ? null : jacket ?? existing?.jacket ?? null,
      design_type: isAdminPremade ? "premade" : design_type ?? existing?.design_type ?? null,
      design_text: isAdminPremade ? resolvedAdminPremadeSelection : resolvedDesignText ?? existing?.design_text ?? null,
      jacket_type: isAdminPremade ? null : jacketType ?? existing?.jacket_type ?? null,
      jacket_color_one: isAdminPremade ? null : jacket_color_one ?? existing?.jacket_color_one ?? null,
      jacket_color_two: isAdminPremade ? null : jacket_color_two ?? existing?.jacket_color_two ?? null,
      flavor: resolvedAdminPremadeFlavor,
      jar_lid_color: isAdminPremade ? null : jar_lid_color ?? existing?.jar_lid_color ?? null,
      logo_url: isAdminPremade || !isBranded ? null : hasLogoUrlField ? logo_url : existing?.logo_url ?? null,
      label_image_url: isAdminPremade ? null : label_image_url ?? existing?.label_image_url ?? null,
      due_date: resolvedDueDate,
      total_weight_kg: resolvedWeightKg,
      total_price: isAdminPremade
        ? null
        : isPriceLocked
          ? existing?.total_price ?? null
          : adminPricing?.total ?? total_price ?? existing?.total_price ?? null,
      admin_batch_weights_kg: isAdminPremade ? [] : adminPricing?.batchWeightsKg ?? resolvedBatchWeights,
      admin_pricing_subtotal: isAdminPremade ? null : adminPricing?.subtotalBeforeDiscount ?? existing?.admin_pricing_subtotal ?? null,
      admin_discount_type: isAdminPremade
        ? null
        : adminPricing?.discountType ?? (hasDiscountTypeControl ? normalizeAdminDiscountType(admin_discount_type) : existing?.admin_discount_type ?? null),
      admin_discount_value: isAdminPremade
        ? null
        : hasDiscountValueControl
          ? admin_discount_value
          : existing?.admin_discount_value ?? null,
      admin_price_override: isAdminPremade
        ? null
        : adminPricing?.priceOverride ?? (hasPriceOverrideControl ? admin_price_override : existing?.admin_price_override ?? null),
      status: isAdminPremade ? "unassigned" : status ?? existing?.status ?? "pending",
      payment_method: isAdminPremade ? null : payment_method ?? existing?.payment_method ?? null,
      pickup: isAdminPremade ? false : pickup ?? existing?.pickup ?? false,
      state: isAdminPremade ? null : state ?? existing?.state ?? null,
      first_name: isAdminPremade ? null : first_name ?? existing?.first_name ?? null,
      last_name: isAdminPremade ? null : last_name ?? existing?.last_name ?? null,
      phone: isAdminPremade ? null : phone ?? existing?.phone ?? null,
      organization_name: isAdminPremade ? null : organization_name ?? existing?.organization_name ?? null,
      address_line1: isAdminPremade ? null : address_line1 ?? existing?.address_line1 ?? null,
      address_line2: isAdminPremade ? null : address_line2 ?? existing?.address_line2 ?? null,
      suburb: isAdminPremade ? null : suburb ?? existing?.suburb ?? null,
      postcode: isAdminPremade ? null : postcode ?? existing?.postcode ?? null,
      notes: isAdminPremade ? ADMIN_PREMADE_ORDER_MARKER : resolvedNotes,
      customer_note: isAdminPremade ? null : customer_note ?? existing?.customer_note ?? null,
      square_invoice_title: isAdminPremade
        ? null
        : existing?.square_invoice_title ??
          (existing
            ? defaultAdminSquareInvoiceTitle({
                id: existing.id,
                order_number: existing.order_number,
                title: title ?? syncedTitleFromDesignText ?? existing.title ?? null,
                organization_name: organization_name ?? existing.organization_name ?? null,
                customer_name: resolvedCustomerName,
              })
            : null),
      text_color: resolvedTextColor,
      heart_color: resolvedHeartColor,
      created_at: created_at ?? undefined,
    };

    if (id) {
      const { error } = await client.from("orders").update(basePayload).eq("id", id);
      if (error) throw new Error(error.message);
      if (shouldReplaceSquareInvoice && existing?.square_invoice_id) {
        const idempotencySuffix = `replace-${Date.now()}`;
        let oldInvoiceRemoved = false;
        try {
          const removal = await removeAdminSquareInvoice(existing, { idempotencySuffix });
          oldInvoiceRemoved = Boolean(removal && removal.action !== "skipped");
          const integrationOrder = {
            ...existing,
            ...basePayload,
            id,
            square_invoice_id: null,
            square_invoice_version: null,
            square_customer_id: existing.square_customer_id,
          } as Parameters<typeof createAndPublishAdminSquareInvoice>[0];
          const updatedInvoice = await createAndPublishAdminSquareInvoice(integrationOrder, {
            idempotencySuffix,
          });
          const { error: invoiceUpdateError } = await client
            .from("orders")
            .update({
              square_customer_id: updatedInvoice.customerId,
              square_order_id: updatedInvoice.squareOrderId,
              square_invoice_id: updatedInvoice.invoiceId,
              square_invoice_version: updatedInvoice.invoiceVersion,
              square_invoice_status: updatedInvoice.invoiceStatus,
              square_invoice_url: updatedInvoice.invoiceUrl,
              square_invoice_due_date: updatedInvoice.invoiceDueDate,
              square_invoice_created_at: updatedInvoice.invoiceCreatedAt,
              square_invoice_sent_at: updatedInvoice.invoiceSentAt,
              square_invoice_error: null,
              admin_price_locked_at: new Date().toISOString(),
              payment_method: "Square invoice",
              payment_provider: "square_invoice",
            })
            .eq("id", id);
          if (invoiceUpdateError) throw new Error(invoiceUpdateError.message);
          inlineMessage = "Order updated and replacement Square invoice sent.";
        } catch (invoiceError) {
          const message = invoiceError instanceof Error ? invoiceError.message : "Unable to send updated Square invoice.";
          const invoiceFailurePatch: Record<string, unknown> = {
            square_invoice_error: `Updated Square invoice failed: ${message}`,
          };
          if (oldInvoiceRemoved) {
            Object.assign(invoiceFailurePatch, {
              square_order_id: null,
              square_invoice_id: null,
              square_invoice_version: null,
              square_invoice_status: null,
              square_invoice_url: null,
              square_invoice_due_date: null,
              square_invoice_created_at: null,
              square_invoice_sent_at: null,
            });
          }
          await client.from("orders").update(invoiceFailurePatch).eq("id", id);
          inlineTone = "error";
          inlineMessage = `Order saved, but updated Square invoice failed: ${message}`;
        }
      }
      activity = {
        area: "operations",
        action: "updated",
        entityType: "order",
        entityId: id,
        entityLabel: describeOrderTarget({
          orderNumber: existing?.order_number ?? order_number,
          title: basePayload.title,
          customerName: basePayload.customer_name,
        }),
        summary: `Updated ${describeOrderTarget({
          orderNumber: existing?.order_number ?? order_number,
          title: basePayload.title,
          customerName: basePayload.customer_name,
        })}.`,
        path: redirectTo ?? ORDERS_PATH,
        changedFields: shouldReplaceSquareInvoice ? ["Order details", "Square invoice"] : ["Order details"],
        metadata: {
          status: basePayload.status,
          dueDate: basePayload.due_date,
          replacedSquareInvoice: shouldReplaceSquareInvoice,
        },
      };
    } else {
      const hasPremadeSelections = !isAdminPremade && premadeSelections.length > 0;
      const buildOrderNumbers = async (seed?: string | null) => {
        const baseNumber = normalizeBaseOrderNumber(seed) ?? (await generateOrderNumber());
        const baseOrderNumber = baseNumber.replace(ORDER_SUFFIX_PATTERN, "");
        const customOrderNumber = hasPremadeSelections ? `${baseOrderNumber}-a` : baseOrderNumber;
        const premadeOrderNumber = hasPremadeSelections ? `${baseOrderNumber}-b` : null;
        const quoteLabel =
          hasPremadeSelections && premadeOrderNumber ? `Quote order: #${customOrderNumber}` : null;
        return { baseOrderNumber, customOrderNumber, premadeOrderNumber, quoteLabel };
      };
      let orderNumbers = await buildOrderNumbers(order_number);
      let payload: (typeof basePayload & { order_number: string }) | null = null;
      let createdOrderId: string | null = null;
      let insertError: { code?: string | null; message?: string | null } | null = null;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = {
          ...basePayload,
          order_number: orderNumbers.customOrderNumber,
          square_invoice_title:
            basePayload.square_invoice_title ??
            defaultAdminSquareInvoiceTitle({
              id: "pending",
              order_number: orderNumbers.customOrderNumber,
              title: basePayload.title,
              organization_name: basePayload.organization_name,
              customer_name: basePayload.customer_name,
            }),
        };
        const { data, error } = await client.from("orders").insert(candidate).select("id").single();
        if (!error) {
          payload = candidate;
          createdOrderId = data?.id ?? null;
          insertError = null;
          break;
        }
        if (isOrderNumberConflict(error)) {
          orderNumbers = await buildOrderNumbers(null);
          insertError = error;
          continue;
        }
        throw new Error(error.message);
      }
      if (!payload) {
        const message = insertError?.message || "Unable to create order.";
        throw new Error(message);
      }
      if (!createdOrderId) {
        throw new Error("Unable to resolve the new order id.");
      }
      const { customOrderNumber, premadeOrderNumber, quoteLabel } = orderNumbers;
      const ordersRecipients = getOrdersRecipients();
      if (!isAdminPremade && ordersRecipients.length > 0) {
        try {
          await sendOrderEmail(ordersRecipients, {
            orderNumber: customOrderNumber,
            title: payload.title,
            designType: payload.design_type,
            quantity: payload.quantity,
            flavor: payload.flavor,
            dueDate: payload.due_date,
            customerName: payload.customer_name,
            customerEmail: payload.customer_email,
            totalWeightKg: payload.total_weight_kg,
            totalPrice: payload.total_price,
            notes: payload.notes,
          });
        } catch (error) {
          console.error("Order email failed:", error);
        }
      }
      if (!isAdminPremade && !hasPremadeSelections) {
        const integrationOrder = {
          id: createdOrderId,
          ...payload,
          admin_batch_weights_kg: payload.admin_batch_weights_kg ?? null,
          square_customer_id: null,
          square_invoice_id: null,
          square_invoice_version: null,
        } as Parameters<typeof createAdminSquareInvoiceDraft>[0];
        const integrationPatch: Record<string, unknown> = {};
        const integrationWarnings: string[] = [];

        try {
          const invoiceDraft = await createAdminSquareInvoiceDraft(integrationOrder);
          integrationPatch.square_customer_id = invoiceDraft.customerId;
          integrationPatch.square_order_id = invoiceDraft.squareOrderId;
          integrationPatch.square_invoice_id = invoiceDraft.invoiceId;
          integrationPatch.square_invoice_version = invoiceDraft.invoiceVersion;
          integrationPatch.square_invoice_status = invoiceDraft.invoiceStatus;
          integrationPatch.square_invoice_url = invoiceDraft.invoiceUrl;
          integrationPatch.square_invoice_due_date = invoiceDraft.invoiceDueDate;
          integrationPatch.square_invoice_created_at = invoiceDraft.invoiceCreatedAt;
          integrationPatch.square_invoice_error = null;
          integrationPatch.admin_price_locked_at = new Date().toISOString();
          integrationPatch.payment_method = "Square invoice";
          integrationPatch.payment_provider = "square_invoice";
        } catch (error) {
          const message = error instanceof Error ? error.message : "Square invoice draft creation failed.";
          console.error("Admin Square invoice draft failed:", error);
          integrationWarnings.push(`Square invoice draft failed: ${message}`);
        }

        if (integrationWarnings.length > 0) {
          integrationPatch.square_invoice_error = integrationWarnings.join("\n");
        }

        if (Object.keys(integrationPatch).length > 0) {
          const { error: integrationUpdateError } = await client
            .from("orders")
            .update(integrationPatch)
            .eq("id", createdOrderId);
          if (integrationUpdateError) {
            console.error("Admin payment integration update failed:", integrationUpdateError);
          }
        }

        const params = new URLSearchParams({ selected: createdOrderId });
        if (integrationWarnings.length > 0) {
          params.set("toast", "error");
          params.set("message", `Order created, but ${integrationWarnings.join(" ")}`);
        } else if (integrationPatch.square_invoice_id) {
          postSaveRedirect = `/admin/orders/${createdOrderId}/invoice`;
        }
        if (!postSaveRedirect) {
          postSaveRedirect = `${ORDERS_PATH}?${params.toString()}`;
        }
      }
      if (hasPremadeSelections && premadeOrderNumber) {
        const uniquePremadeIds = Array.from(new Set(premadeSelections.map((item) => item.id)));
        const { data: premadeRows, error: premadeError } = await client
          .from("premade_candies")
          .select("id,name,price,weight_g")
          .in("id", uniquePremadeIds);
        if (premadeError) throw new Error(premadeError.message);

        const premadeLookup = new Map((premadeRows ?? []).map((row) => [row.id, row]));
        const fallbackCustomerName =
          resolvedCustomerName ?? ([first_name, last_name].filter(Boolean).join(" ") || null);

        const premadePayloads = premadeSelections.map((selection) => {
          const premade = premadeLookup.get(selection.id);
          if (!premade) {
            throw new Error("Premade candy selection is unavailable.");
          }
          const unitWeightG = Number(premade.weight_g);
          const totalWeightKg = (unitWeightG * selection.quantity) / 1000;
          if (!Number.isFinite(totalWeightKg) || totalWeightKg <= 0) {
            throw new Error("Premade item weight is required.");
          }
          if (totalWeightKg > settings.max_total_kg) {
            throw new Error(`Max total kg per settings is ${settings.max_total_kg}.`);
          }
          const unitPrice = Number(premade.price);
          const totalPrice = Number.isFinite(unitPrice) ? unitPrice * selection.quantity : null;
          const weightLabel = formatPremadeWeight(unitWeightG);
          const description = weightLabel ? `${weightLabel} premade candy` : "Premade candy";

          return {
            order_number: premadeOrderNumber,
            title: premade.name ?? "Premade candy",
            order_description: description,
            customer_name: fallbackCustomerName,
            customer_email: customer_email ?? null,
            design_type: "premade",
            design_text: premade.name ?? null,
            due_date: due_date ?? null,
            quantity: selection.quantity,
            total_weight_kg: totalWeightKg,
            total_price: totalPrice,
            status: "pending",
            notes: quoteLabel,
            pickup,
            state: state ?? null,
            first_name: first_name ?? null,
            last_name: last_name ?? null,
            phone: phone ?? null,
            organization_name: organization_name ?? null,
            address_line1: address_line1 ?? null,
            address_line2: address_line2 ?? null,
            suburb: suburb ?? null,
            postcode: postcode ?? null,
          };
        });

        if (premadePayloads.length > 0) {
          const { error: premadeInsertError } = await client.from("orders").insert(premadePayloads);
          if (premadeInsertError) throw new Error(premadeInsertError.message);
          const ordersRecipients = getOrdersRecipients();
          if (ordersRecipients.length > 0) {
            for (const premadePayload of premadePayloads) {
              try {
                await sendOrderEmail(ordersRecipients, {
                  orderNumber: premadePayload.order_number ?? null,
                  title: premadePayload.title ?? null,
                  designType: premadePayload.design_type ?? null,
                  quantity: premadePayload.quantity ?? null,
                  flavor: null,
                  dueDate: premadePayload.due_date ?? null,
                  customerName: premadePayload.customer_name ?? null,
                  customerEmail: premadePayload.customer_email ?? null,
                  totalWeightKg: premadePayload.total_weight_kg ?? null,
                  totalPrice: premadePayload.total_price ?? null,
                  notes: premadePayload.notes ?? null,
                });
              } catch (error) {
                console.error("Order email failed:", error);
              }
            }
          }
        }
      }

      if (isAdminPremade && shouldScheduleAfterCreate && productionSlotDate) {
        await assertAssignableDate(productionSlotDate);
        const slotsPerDay = Math.max(1, Number(settings.production_slots_per_day) || 1);
        const slotIndex = await resolveFirstAvailableSlotIndex(productionSlotDate, client, slotsPerDay);
        if (slotIndex === null) {
          throw new Error("No production slot is available on this date.");
        }
        const scheduleFormData = new FormData();
        scheduleFormData.set("order_id", createdOrderId);
        scheduleFormData.set("slot_date", productionSlotDate);
        scheduleFormData.set("slot_index", String(slotIndex));
        scheduleFormData.set("kg_assigned", String(payload.total_weight_kg));
        scheduleFormData.set("response_mode", "inline");
        const scheduleResult = await assignOrderToSlot(scheduleFormData);
        if (!scheduleResult?.ok) {
          throw new Error(scheduleResult?.message || "Unable to slot premade order into production schedule.");
        }
        postSaveRedirect = `${ORDERS_PATH}?selected=${encodeURIComponent(createdOrderId)}`;
      }

      activity = {
        area: "operations",
        action: "created",
        entityType: "order",
        entityId: createdOrderId,
        entityLabel: describeOrderTarget({
          orderNumber: customOrderNumber,
          title: payload.title,
          customerName: payload.customer_name,
        }),
        summary: `Created ${describeOrderTarget({
          orderNumber: customOrderNumber,
          title: payload.title,
          customerName: payload.customer_name,
        })}.`,
        path: redirectTo ?? ORDERS_PATH,
        changedFields: ["Order details"],
        metadata: {
          orderNumber: customOrderNumber,
          premadeOrderNumber,
          createdPremadeCompanion: hasPremadeSelections,
          adminPremade: isAdminPremade,
        },
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save order.";
    if (inlineResponse) {
      return { ok: false, tone: "error" as const, message: toastError ?? message };
    }
    if (redirectTo && toastError) {
      const params = new URLSearchParams({ toast: "error", message: toastError });
      redirect(`${redirectTo}?${params.toString()}`);
    }
    throw error;
  }

  if (activity) {
    await logAdminActivity(activity);
  }
  revalidatePath(ORDERS_PATH);
  revalidatePath("/admin");
  revalidatePath("/admin/orders/[id]/print", "page");
  if (id) {
    revalidatePath(`/admin/orders/${id}/print`);
    revalidatePath(`/admin/orders/${id}`);
  }
  if (existing?.order_number) {
    revalidatePath(`/admin/orders/${encodeURIComponent(existing.order_number)}/print`);
  }
  if (redirectTo?.startsWith("/")) {
    revalidatePath(redirectTo);
  }
  if (inlineResponse) {
    return { ok: true, tone: inlineTone, message: inlineMessage };
  }
  const destination = postSaveRedirect ?? redirectTo ?? ORDERS_PATH;
  if (redirectTo && inlineMessage) {
    const params = new URLSearchParams({ toast: inlineTone, message: inlineMessage });
    redirect(`${destination}?${params.toString()}`);
  }
  redirect(destination);
}

export async function upsertOrder(formData: FormData) {
  await upsertOrderShared(formData);
}

export async function upsertOrderInline(formData: FormData) {
  formData.set("response_mode", "inline");
  return upsertOrderShared(formData);
}

export async function retryAdminSquareInvoiceDraft(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect" });
  const orderId = formData.get("order_id")?.toString() || null;
  if (!orderId) {
    redirect(toastRedirect(ORDERS_PATH, "error", "Missing order id."));
  }

  const client = supabaseAdminClient;
  const { data: order, error: fetchError } = await client.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (fetchError) {
    redirect(toastRedirect(ORDERS_PATH, "error", fetchError.message));
  }
  if (!order) {
    redirect(toastRedirect(ORDERS_PATH, "error", "Order not found."));
  }
  if (!isAdminManagedCustomOrder(order)) {
    redirect(toastRedirect(ORDERS_PATH, "error", "Website orders do not use Square invoices."));
  }
  if (order.square_invoice_id) {
    redirect(`/admin/orders/${orderId}/invoice`);
  }

  try {
    const invoiceDraft = await createAdminSquareInvoiceDraft(
      order as Parameters<typeof createAdminSquareInvoiceDraft>[0],
      { idempotencySuffix: `retry-${Date.now()}` },
    );
    const { error: updateError } = await client
      .from("orders")
      .update({
        square_customer_id: invoiceDraft.customerId,
        square_order_id: invoiceDraft.squareOrderId,
        square_invoice_id: invoiceDraft.invoiceId,
        square_invoice_version: invoiceDraft.invoiceVersion,
        square_invoice_status: invoiceDraft.invoiceStatus,
        square_invoice_url: invoiceDraft.invoiceUrl,
        square_invoice_due_date: invoiceDraft.invoiceDueDate,
        square_invoice_created_at: invoiceDraft.invoiceCreatedAt,
        square_invoice_error: null,
        admin_price_locked_at: order.admin_price_locked_at ?? new Date().toISOString(),
        payment_method: "Square invoice",
        payment_provider: "square_invoice",
      })
      .eq("id", orderId);
    if (updateError) throw new Error(updateError.message);

    await logAdminActivity({
      area: "operations",
      action: "updated",
      entityType: "order",
      entityId: orderId,
      entityLabel: describeOrderTarget({
        orderNumber: order.order_number,
        title: order.title,
        customerName: order.customer_name,
      }),
      summary: `Created Square invoice draft for ${describeOrderTarget({
        orderNumber: order.order_number,
        title: order.title,
        customerName: order.customer_name,
      })}.`,
      path: ORDERS_PATH,
      changedFields: ["Square invoice"],
      metadata: {
        invoiceId: invoiceDraft.invoiceId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Square invoice draft creation failed.";
    await client.from("orders").update({ square_invoice_error: `Square invoice draft failed: ${message}` }).eq("id", orderId);
    const params = new URLSearchParams({ selected: orderId, toast: "error", message });
    redirect(`${ORDERS_PATH}?${params.toString()}`);
  }

  revalidatePath(ORDERS_PATH);
  revalidatePath(`/admin/orders/${orderId}/invoice`);
  redirect(`/admin/orders/${orderId}/invoice`);
}

export async function sendAdminSquareInvoice(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect" });
  const orderId = formData.get("order_id")?.toString() || null;
  const invoiceTitle = formData.get("square_invoice_title")?.toString().trim() || null;
  const customerNote = formData.get("customer_note")?.toString() || null;
  const firstName = formData.get("first_name")?.toString().trim() || null;
  const lastName = formData.get("last_name")?.toString().trim() || null;
  const customerName = [firstName, lastName].filter(Boolean).join(" ") || formData.get("customer_name")?.toString().trim() || null;
  const customerEmail = formData.get("customer_email")?.toString().trim() || null;
  const phone = formData.get("phone")?.toString().trim() || null;

  if (!orderId) {
    redirect(toastRedirect(ORDERS_PATH, "error", "Missing order id."));
  }

  const client = supabaseAdminClient;
  const { data: existing, error: existingError } = await client.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (existingError) {
    redirect(toastRedirect(ORDERS_PATH, "error", existingError.message));
  }
  if (!existing) {
    redirect(toastRedirect(ORDERS_PATH, "error", "Order not found."));
  }
  if (!isAdminManagedCustomOrder(existing)) {
    const params = new URLSearchParams({ selected: orderId, toast: "error", message: "Website orders do not use Square invoices." });
    redirect(`${ORDERS_PATH}?${params.toString()}`);
  }
  if (!existing.square_invoice_id) {
    const params = new URLSearchParams({ selected: orderId, toast: "error", message: "Square invoice draft is missing." });
    redirect(`${ORDERS_PATH}?${params.toString()}`);
  }
  if (existing.square_invoice_sent_at || existing.square_invoice_status === "UNPAID" || existing.square_invoice_status === "PAID") {
    const params = new URLSearchParams({ selected: orderId, toast: "error", message: "This Square invoice has already been sent." });
    redirect(`${ORDERS_PATH}?${params.toString()}`);
  }

  const localPatch = {
    square_invoice_title: invoiceTitle ?? existing.square_invoice_title ?? defaultAdminSquareInvoiceTitle(existing),
    customer_note: customerNote,
    customer_name: customerName ?? existing.customer_name,
    first_name: firstName ?? existing.first_name,
    last_name: lastName ?? existing.last_name,
    customer_email: customerEmail ?? existing.customer_email,
    phone: phone ?? existing.phone,
    square_invoice_error: null,
  };

  const integrationOrder = {
    ...existing,
    ...localPatch,
  } as Parameters<typeof updateAndPublishAdminSquareInvoice>[0];

  try {
    const sentInvoice = await updateAndPublishAdminSquareInvoice(integrationOrder);
    const { error: updateError } = await client
      .from("orders")
      .update({
        ...localPatch,
        square_invoice_id: sentInvoice.invoiceId,
        square_invoice_version: sentInvoice.invoiceVersion,
        square_invoice_status: sentInvoice.invoiceStatus,
        square_invoice_url: sentInvoice.invoiceUrl,
        square_invoice_sent_at: sentInvoice.invoiceSentAt,
        square_invoice_error: null,
      })
      .eq("id", orderId);
    if (updateError) throw new Error(updateError.message);

    await logAdminActivity({
      area: "operations",
      action: "updated",
      entityType: "order",
      entityId: orderId,
      entityLabel: describeOrderTarget({
        orderNumber: existing.order_number,
        title: existing.title,
        customerName: localPatch.customer_name,
      }),
      summary: `Sent Square invoice for ${describeOrderTarget({
        orderNumber: existing.order_number,
        title: existing.title,
        customerName: localPatch.customer_name,
      })}.`,
      path: ORDERS_PATH,
      changedFields: ["Square invoice"],
      metadata: {
        invoiceId: sentInvoice.invoiceId,
        invoiceStatus: sentInvoice.invoiceStatus,
      },
    });
    try {
      await sendAdminCreatedCustomerOrderEmail({
        ...existing,
        ...localPatch,
        payment_method: "Square invoice",
      });
    } catch (error) {
      console.error("Admin-created customer order email failed:", error);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send Square invoice.";
    await client.from("orders").update({ ...localPatch, square_invoice_error: message }).eq("id", orderId);
    redirect(toastRedirect(`/admin/orders/${orderId}/invoice`, "error", message));
  }

  revalidatePath(ORDERS_PATH);
  revalidatePath(`/admin/orders/${orderId}/invoice`);
  redirect(`${ORDERS_PATH}?selected=${encodeURIComponent(orderId)}&toast=success&message=${encodeURIComponent("Square invoice sent.")}`);
}

export async function markOrderAsPaid(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect" });
  const orderId = formData.get("id")?.toString() || formData.get("order_id")?.toString() || null;
  let successRedirect: string | null = null;
  const errorRedirect = (message: string) => {
    const params = new URLSearchParams({
      toast: "error",
      message,
    });
    if (orderId) {
      params.set("selected", orderId);
    }
    redirect(`${ORDERS_PATH}?${params.toString()}`);
  };

  try {
    if (!orderId) throw new Error("Missing order id");

    const client = supabaseAdminClient;
    const { data: existing, error: existingError } = await client
      .from("orders")
      .select(
        "id,order_number,title,customer_name,design_type,woo_order_id,woo_payment_url,paid_at,payment_method,payment_provider,square_invoice_id,status",
      )
      .eq("id", orderId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existing) throw new Error("Order not found.");
    if (!isAdminManagedCustomOrder(existing)) {
      throw new Error("Only admin-created custom orders can be marked as paid.");
    }
    if (existing.paid_at) {
      throw new Error("Order is already marked as paid.");
    }

    const paidAt = new Date().toISOString();
    const paymentMethod = existing.payment_method?.trim() || "Manual payment";
    const { error } = await client
      .from("orders")
      .update({
        paid_at: paidAt,
        payment_method: paymentMethod,
      })
      .eq("id", orderId);
    if (error) throw new Error(error.message);

    await logAdminActivity({
      area: "operations",
      action: "updated",
      entityType: "order",
      entityId: orderId,
      entityLabel: describeOrderTarget({
        orderNumber: existing.order_number,
        title: existing.title,
        customerName: existing.customer_name,
      }),
      summary: `Marked ${describeOrderTarget({
        orderNumber: existing.order_number,
        title: existing.title,
        customerName: existing.customer_name,
      })} as paid.`,
      path: ORDERS_PATH,
      changedFields: ["Payment status"],
      metadata: {
        paidAt,
      },
    });

    revalidatePath(ORDERS_PATH);
    revalidatePath("/admin/orders/archived");

    const params = new URLSearchParams({
      selected: orderId,
      toast: "success",
      message: "Order marked as paid.",
    });
    successRedirect = `${ORDERS_PATH}?${params.toString()}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to mark order as paid.";
    errorRedirect(message);
  }

  if (successRedirect) {
    redirect(successRedirect);
  }
}

export async function refundOrder(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect" });
  const idsRaw = formData.get("ids")?.toString() || "";
  const ids = idsRaw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const id = formData.get("id")?.toString() || ids[0] || null;
  const refundReasonRaw = formData.get("refund_reason")?.toString() || null;
  const refundReason = refundReasonRaw ? refundReasonRaw.trim().slice(0, 255) : null;
  const refundType = formData.get("refund_type")?.toString() === "partial" ? "partial" : "full";
  const refundAmountRaw = formData.get("refund_amount")?.toString() || "";
  const redirectCandidate = formData.get("redirect_to")?.toString() || "";
  const redirectBase = redirectCandidate.startsWith("/admin/orders") ? redirectCandidate : ORDERS_PATH;
  if (!id) {
    redirect(`${redirectBase}?toast_error=Refund%20failed%3A%20Missing%20order%20id`);
  }
  const client = supabaseAdminClient;
  const orderIds = Array.from(new Set(ids.length > 0 ? ids : [id]));
  const orderQuery =
    orderIds.length > 1
      ? client.from("orders").select("*").in("id", orderIds)
      : client.from("orders").select("*").eq("id", orderIds[0]!).maybeSingle();
  const { data: orderData, error } = await orderQuery;
  const orders = Array.isArray(orderData) ? orderData : orderData ? [orderData] : [];
  if (error || orders.length === 0) {
    redirect(`${redirectBase}?toast_error=Refund%20failed%3A%20Order%20not%20found`);
  }

  const provider = orders[0]?.payment_provider;
  const transactionId = orders[0]?.payment_transaction_id;
  if (!provider || !transactionId) {
    redirect(`${redirectBase}?toast_error=Refund%20failed%3A%20Missing%20payment%20details`);
  }

  const samePayment = orders.every(
    (order) => order.payment_provider === provider && order.payment_transaction_id === transactionId,
  );
  if (!samePayment) {
    redirect(`${redirectBase}?toast_error=Refund%20failed%3A%20Orders%20must%20share%20the%20same%20payment`);
  }

  const maxRefundCents = orders.reduce((sum, order) => sum + remainingRefundCentsForOrder(order), 0);
  const maxRefundAmount = maxRefundCents / 100;
  if (!Number.isFinite(maxRefundAmount) || maxRefundCents <= 0) {
    redirect(`${redirectBase}?toast_error=Refund%20failed%3A%20No%20refundable%20amount%20remaining`);
  }

  const requestedRefundAmount = Number(refundAmountRaw);
  const requestedRefundCents = Number.isFinite(requestedRefundAmount) ? toMoneyCents(requestedRefundAmount) : NaN;
  const amountCents = refundType === "partial" ? requestedRefundCents : maxRefundCents;
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    redirect(`${redirectBase}?toast_error=Refund%20failed%3A%20Invalid%20refund%20amount`);
  }
  if (amountCents > maxRefundCents) {
    redirect(`${redirectBase}?toast_error=Refund%20failed%3A%20Refund%20amount%20exceeds%20order%20total`);
  }
  const amount = amountCents / 100;
  const isPartialRefund = amountCents < maxRefundCents;

  try {
    if (provider === "square") {
      await refundSquarePayment(String(transactionId), amountCents, refundReason);
    } else if (provider === "paypal") {
      await refundPayPalCapture(String(transactionId), amount.toFixed(2), refundReason);
    } else {
      redirect(`${redirectBase}?toast_error=Refund%20failed%3A%20Unsupported%20provider`);
    }

    const refundResult =
      orders.length > 1
        ? await persistOrderRefunds({
            client,
            orders,
            refundAmount: amount,
            refundReason,
          })
        : await persistOrderRefund({
            client,
            order: orders[0]!,
            refundAmount: amount,
            refundReason,
          });

    const recipientEmails = Array.from(new Set(orders.map((order) => order.customer_email).filter(Boolean)));
    if (recipientEmails.length > 0) {
      await sendCustomerRefundEmail(recipientEmails, {
        orderNumber: orders[0]?.order_number ?? null,
        amount,
        paymentMethod: orders[0]?.payment_method ?? orders[0]?.payment_provider ?? null,
        reason: refundReason,
      });
    }

    const successOrderLabel = orders[0]?.order_number ? `#${orders[0].order_number}` : "order";
    const successMessage =
      isPartialRefund
        ? `Partial refund processed for ${successOrderLabel}.`
        : refundResult.sharedPayment && !refundResult.fullyRefundedPayment
        ? `Refund processed for ${successOrderLabel}. Other split items on this payment can still be refunded separately.`
        : "Refund processed";
    await logAdminActivity({
      area: "operations",
      action: "refunded",
      entityType: "order",
      entityId: orders[0]?.id ?? id,
      entityLabel: describeOrderTarget({
        orderNumber: orders[0]?.order_number ?? null,
        title: orders[0]?.title ?? null,
        customerName: orders[0]?.customer_name ?? null,
      }),
      summary: successMessage,
      path: redirectBase,
      changedFields: ["Refund"],
      metadata: {
        orderCount: orders.length,
        amount,
        refundType: isPartialRefund ? "partial" : "full",
      },
    });
    redirect(`${redirectBase}?toast_success=${encodeURIComponent(successMessage)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refund failed.";
    redirect(`${redirectBase}?toast_error=${encodeURIComponent(message)}`);
  }
}

export async function upsertSlot(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect" });
  const id = formData.get("id")?.toString() || undefined;
  const slot_date = formData.get("slot_date")?.toString() || null;
  const capacity_kg = Number(formData.get("capacity_kg") || 0);
  const status = formData.get("status")?.toString() || "open";
  const notes = formData.get("notes")?.toString() || null;

  if (!slot_date) throw new Error("Slot date is required.");
  if (!Number.isFinite(capacity_kg) || capacity_kg <= 0) {
    throw new Error("Capacity must be greater than zero.");
  }

  const client = supabaseAdminClient;
  const writeSlot = async (capacityValue: number) => {
    const payload = { slot_date, capacity_kg: capacityValue, status, notes };
    if (id) {
      const { error } = await client.from("production_slots").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      return;
    }
    const { error } = await client.from("production_slots").insert(payload);
    if (error) throw new Error(error.message);
  };

  try {
    await writeSlot(capacity_kg);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save slot.";
    if (!isInvalidIntegerInputError(message)) throw error;
    await writeSlot(toSafeInteger(capacity_kg));
  }

  await logAdminActivity({
    area: "operations",
    action: id ? "updated" : "created",
    entityType: "production-slot",
    entityId: id ?? null,
    entityLabel: slot_date,
    summary: `${id ? "Updated" : "Created"} production slot for ${slot_date}.`,
    path: ORDERS_PATH,
    changedFields: ["Slot date", "Capacity", "Status"],
  });
  redirect(ORDERS_PATH);
}

export async function upsertProductionDayNote(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect" });
  const noteDate = formData.get("note_date")?.toString().trim() || "";
  const note = formData.get("note")?.toString().trim() || "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(noteDate)) {
    return { ok: false, tone: "error" as const, message: "Production date is required." };
  }

  try {
    const client = supabaseAdminClient;
    if (note) {
      const { error } = await client.from("production_day_notes").upsert(
        {
          note_date: noteDate,
          note,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "note_date" },
      );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await client.from("production_day_notes").delete().eq("note_date", noteDate);
      if (error) throw new Error(error.message);
    }

    await logAdminActivity({
      area: "operations",
      action: note ? "updated" : "deleted",
      entityType: "production-day-note",
      entityLabel: noteDate,
      summary: note ? `Saved production note for ${noteDate}.` : `Cleared production note for ${noteDate}.`,
      path: ORDERS_PATH,
      changedFields: ["Production note"],
    });
    revalidatePath(ORDERS_PATH);
    revalidatePath("/admin/production");
    return { ok: true, tone: "success" as const, message: note ? "Note saved." : "Note cleared." };
  } catch (error) {
    return {
      ok: false,
      tone: "error" as const,
      message: error instanceof Error ? error.message : "Unable to save note.",
    };
  }
}

export async function assignOrderToSlot(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect" });
  const inlineResponse = isInlineResponse(formData);
  let assignmentActivity: AdminActivityInput | null = null;
  try {
    const assignmentId = formData.get("assignment_id")?.toString() || undefined;
    const order_id = formData.get("order_id")?.toString();
    const slot_id = formData.get("slot_id")?.toString() || undefined;
    const slot_date = formData.get("slot_date")?.toString();
    const slot_index_input = formData.get("slot_index");
    const slot_index = slot_index_input !== null ? Number(slot_index_input) : NaN;
    const requestedKgAssigned = Number(formData.get("kg_assigned") || 0);
    if (!order_id) throw new Error("Order is required.");
    if (!slot_id && (!slot_date || !Number.isFinite(slot_index))) {
      throw new Error("Slot date and index are required.");
    }

    const client = supabaseAdminClient;
    let resolvedSlotId = slot_id;

    if (slot_date) {
      await assertAssignableDate(slot_date);
    }

    const { data: order, error: orderError } = await client
      .from("orders")
      .select("id,order_number,title,customer_name,total_weight_kg")
      .eq("id", order_id)
      .single();
    if (orderError) throw new Error(orderError.message);
    const totalOrderKgRaw = Number(order.total_weight_kg);
    const totalOrderKg =
      Number.isFinite(totalOrderKgRaw) && totalOrderKgRaw > 0 ? totalOrderKgRaw : null;
    const kg_assigned =
      Number.isFinite(requestedKgAssigned) && requestedKgAssigned > 0
        ? requestedKgAssigned
        : totalOrderKg ?? 0.01;

    if (!Number.isFinite(kg_assigned) || kg_assigned <= 0) {
      throw new Error("Assigned kg must be greater than zero.");
    }

    if (!resolvedSlotId && slot_date && Number.isFinite(slot_index)) {
      const { data: existingSlots, error: existingError } = await client
        .from("production_slots")
        .select("id,capacity_kg,created_at")
        .eq("slot_date", slot_date)
        .eq("slot_index", slot_index)
        .order("created_at", { ascending: false })
        .limit(1);
      if (existingError) throw new Error(existingError.message);
      const existingSlot = existingSlots?.[0] ?? null;

      if (existingSlot) {
        resolvedSlotId = existingSlot.id;
      } else {
        const { max_total_kg } = await getSettings();
        const createSlot = async (capacityValue: number) => {
          const { data, error } = await client
            .from("production_slots")
            .insert({
              slot_date,
              slot_index,
              capacity_kg: capacityValue,
              status: "open",
            })
            .select("id,capacity_kg")
            .single();
          if (error) throw new Error(error.message);
          return data;
        };
        try {
          const created = await createSlot(max_total_kg);
          resolvedSlotId = created.id;
        } catch (createError) {
          const message = createError instanceof Error ? createError.message : "Unable to create slot.";
          if (!isInvalidIntegerInputError(message)) throw createError;
          const created = await createSlot(toSafeInteger(max_total_kg));
          resolvedSlotId = created.id;
        }
      }
    }

    if (!resolvedSlotId) throw new Error("Slot could not be resolved.");
    let resolvedSlotDate = slot_date ?? null;
    if (!slot_date && resolvedSlotId) {
      const { data: slotDateRow, error: slotDateError } = await client
        .from("production_slots")
        .select("slot_date")
        .eq("id", resolvedSlotId)
        .maybeSingle();
      if (slotDateError) throw new Error(slotDateError.message);
      if (slotDateRow?.slot_date) {
        resolvedSlotDate = slotDateRow.slot_date;
        await assertAssignableDate(slotDateRow.slot_date);
      }
    }

    const { data: slotAssignments, error: slotAssignmentsError } = await client
      .from("order_slots")
      .select("id,kg_assigned")
      .eq("slot_id", resolvedSlotId);
    if (slotAssignmentsError) throw new Error(slotAssignmentsError.message);

    const { data: orderAssignments, error: orderAssignmentsError } = await client
      .from("order_slots")
      .select("id,kg_assigned")
      .eq("order_id", order_id);
    if (orderAssignmentsError) throw new Error(orderAssignmentsError.message);

    const existingOrderAssignment =
      assignmentId
        ? orderAssignments.find((assignment) => assignment.id === assignmentId) ?? null
        : null;
    const previousForAssignment = existingOrderAssignment?.kg_assigned ?? 0;

    const orderUsed =
      orderAssignments.reduce((sum, a) => sum + Number(a.kg_assigned || 0), 0) -
      Number(previousForAssignment || 0) +
      kg_assigned;
    if (totalOrderKg !== null && orderUsed > totalOrderKg) {
      throw new Error("Assigned kg exceeds the order's total weight.");
    }

    if (slotAssignments.length > 0 && slotAssignments[0]?.id !== assignmentId && slotAssignments[0]?.id !== existingOrderAssignment?.id) {
      throw new Error("This slot already has an order assigned.");
    }

    const writeAssignment = async (assignedKg: number) => {
      if (assignmentId) {
        const { error } = await client
          .from("order_slots")
          .update({ order_id, slot_id: resolvedSlotId, kg_assigned: assignedKg })
          .eq("id", assignmentId);
        if (error) throw new Error(error.message);
        return;
      }
      const { error } = await client
        .from("order_slots")
        .insert({ order_id, slot_id: resolvedSlotId, kg_assigned: assignedKg });
      if (error) throw new Error(error.message);
    };

    try {
      await writeAssignment(kg_assigned);
    } catch (writeError) {
      const writeMessage = writeError instanceof Error ? writeError.message : "Unable to assign order.";
      if (!isInvalidIntegerInputError(writeMessage)) throw writeError;
      const fallbackKgAssigned =
        totalOrderKg !== null
          ? Math.max(1, Math.min(Math.round(totalOrderKg), Math.round(kg_assigned)))
          : Math.max(1, Math.round(kg_assigned));
      await writeAssignment(fallbackKgAssigned);
    }

    const { error: statusError } = await client.from("orders").update({ status: "scheduled" }).eq("id", order_id);
    if (statusError) throw new Error(statusError.message);
    assignmentActivity = {
      area: "operations",
      action: "assigned",
      entityType: "order",
      entityId: order.id,
      entityLabel: describeOrderTarget({
        orderNumber: order.order_number,
        title: order.title,
        customerName: order.customer_name,
      }),
      summary: `Assigned ${describeOrderTarget({
        orderNumber: order.order_number,
        title: order.title,
        customerName: order.customer_name,
      })} to ${resolvedSlotDate ?? "a production slot"}.`,
      path: ORDERS_PATH,
      changedFields: ["Production slot"],
      metadata: {
        slotId: resolvedSlotId,
        slotDate: resolvedSlotDate,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to assign order.";
    if (inlineResponse) {
      revalidatePath(ORDERS_PATH);
      return { ok: false, tone: "error" as const, message };
    }
    redirect(toastRedirect(ORDERS_PATH, "error", message));
  }

  if (assignmentActivity) {
    await logAdminActivity(assignmentActivity);
  }
  if (inlineResponse) {
    revalidatePath(ORDERS_PATH);
    return { ok: true, tone: "success" as const, message: "Order assigned." };
  }
  redirect(toastRedirect(ORDERS_PATH, "success", "Order assigned."));
}

export async function deleteAssignment(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect" });
  const inlineResponse = isInlineResponse(formData);
  let orderIdForLog: string | null = null;
  try {
    const assignmentId = formData.get("assignment_id")?.toString();
    if (!assignmentId) throw new Error("Missing assignment id");

    const client = supabaseAdminClient;
    const { data: orderSlot, error: slotLookupError } = await client
      .from("order_slots")
      .select("order_id")
      .eq("id", assignmentId)
      .maybeSingle();
    if (slotLookupError) throw new Error(slotLookupError.message);
    orderIdForLog = orderSlot?.order_id ?? null;

    const { error } = await client.from("order_slots").delete().eq("id", assignmentId);
    if (error) throw new Error(error.message);

    if (orderSlot?.order_id) {
      const { error: statusError } = await client
        .from("orders")
        .update({ status: "unassigned" })
        .eq("id", orderSlot.order_id);
      if (statusError) throw new Error(statusError.message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to unassign order.";
    if (inlineResponse) {
      revalidatePath(ORDERS_PATH);
      return { ok: false, tone: "error" as const, message };
    }
    redirect(toastRedirect(ORDERS_PATH, "error", message));
  }

  await logAdminActivity({
    area: "operations",
    action: "unassigned",
    entityType: "order",
    entityId: orderIdForLog,
    entityLabel: orderIdForLog ?? "Order",
    summary: "Removed an order from its production slot.",
    path: ORDERS_PATH,
    changedFields: ["Production slot"],
  });
  if (inlineResponse) {
    revalidatePath(ORDERS_PATH);
    return { ok: true, tone: "success" as const, message: "Order unassigned." };
  }
  redirect(toastRedirect(ORDERS_PATH, "success", "Order unassigned."));
}

export async function deleteOrder(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect" });
  const orderId = formData.get("order_id")?.toString() || formData.get("id")?.toString() || null;
  if (!orderId) {
    redirect(toastRedirect(ORDERS_PATH, "error", "Missing order id."));
  }

  const client = supabaseAdminClient;
  const { data: order, error: fetchError } = await client
    .from("orders")
    .select("id,order_number,title,customer_name,square_invoice_id,square_invoice_version")
    .eq("id", orderId)
    .maybeSingle();
  if (fetchError) {
    redirect(toastRedirect(ORDERS_PATH, "error", fetchError.message));
  }
  if (!order) {
    redirect(toastRedirect(ORDERS_PATH, "error", "Order not found."));
  }

  try {
    if (order.square_invoice_id) {
      await removeAdminSquareInvoice(order, { idempotencySuffix: `delete-${Date.now()}` });
    }

    const { error: assignmentError } = await client.from("order_slots").delete().eq("order_id", orderId);
    if (assignmentError) throw new Error(assignmentError.message);

    const { error: deleteError } = await client.from("orders").delete().eq("id", orderId);
    if (deleteError) throw new Error(deleteError.message);

    await logAdminActivity({
      area: "operations",
      action: "deleted",
      entityType: "order",
      entityId: orderId,
      entityLabel: describeOrderTarget({
        orderNumber: order.order_number,
        title: order.title,
        customerName: order.customer_name,
      }),
      summary: `Deleted ${describeOrderTarget({
        orderNumber: order.order_number,
        title: order.title,
        customerName: order.customer_name,
      })}.`,
      path: ORDERS_PATH,
      changedFields: ["Order"],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete order.";
    redirect(toastRedirect(ORDERS_PATH, "error", message));
  }

  revalidatePath(ORDERS_PATH);
  revalidatePath("/admin");
  revalidatePath("/admin/production");
  revalidatePath("/admin/orders/archived");
  redirect(toastRedirect(ORDERS_PATH, "success", "Order deleted."));
}

async function completeOrder(formData: FormData, inlineResponse: boolean) {
  await requireAdminWriteAccess({ onDenied: "redirect" });
  const orderId = formData.get("order_id")?.toString();
  const includeCompanion = formData.get("include_companion")?.toString() === "on";
  const companionOrderIds = (formData.get("companion_order_ids")?.toString() || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  let completionActivity: AdminActivityInput | null = null;
  try {
    if (!orderId) throw new Error("Missing order id");

    const client = supabaseAdminClient;
    const completedAt = new Date().toISOString();

    if (includeCompanion && companionOrderIds.length > 0) {
      const { count: refundedCompanionCount, error: refundedCompanionError } = await client
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("id", companionOrderIds)
        .eq("design_type", "premade")
        .not("refunded_at", "is", null);
      if (refundedCompanionError) throw new Error(refundedCompanionError.message);
      if (refundedCompanionCount && refundedCompanionCount > 0) {
        throw new Error("Refunded split items cannot be completed.");
      }
    }

    const { error } = await client
      .from("orders")
      .update({ status: "archived", archived_at: completedAt })
      .eq("id", orderId);
    if (error) throw new Error(error.message);

    if (includeCompanion && companionOrderIds.length > 0) {
      const { error: companionError } = await client
        .from("orders")
        .update({ status: "shipped", shipped_at: completedAt })
        .in("id", companionOrderIds)
        .eq("design_type", "premade");
      if (companionError) throw new Error(companionError.message);
    }
    completionActivity = {
      area: "operations",
      action: "archived",
      entityType: "order",
      entityId: orderId,
      entityLabel: orderId ?? "Order",
      summary:
        includeCompanion && companionOrderIds.length > 0
          ? `Completed order and ${companionOrderIds.length} linked companion item(s).`
          : "Completed order.",
      path: ORDERS_PATH,
      changedFields: ["Order status"],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete order.";
    if (inlineResponse) {
      revalidatePath(ORDERS_PATH);
      revalidatePath(ADDITIONAL_ITEMS_PATH);
      revalidatePath("/admin/orders/archived");
      return { ok: false, tone: "error" as const, message };
    }
    throw error;
  }

  if (completionActivity) {
    await logAdminActivity(completionActivity);
  }
  if (inlineResponse) {
    revalidatePath(ORDERS_PATH);
    revalidatePath(ADDITIONAL_ITEMS_PATH);
    revalidatePath("/admin/orders/archived");
    return { ok: true, tone: "success" as const, message: "Order completed." };
  }
  revalidatePath(ADDITIONAL_ITEMS_PATH);
  revalidatePath("/admin/orders/archived");
  redirect(ORDERS_PATH);
}

export async function archiveOrder(formData: FormData) {
  await completeOrder(formData, false);
}

export async function archiveOrderInline(formData: FormData) {
  return completeOrder(formData, true);
}

export async function unarchiveOrder(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect" });
  const orderId = formData.get("order_id")?.toString();
  const orderIdsRaw = formData.get("order_ids")?.toString() || "";
  const orderIds = Array.from(
    new Set(
      orderIdsRaw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
  const targetOrderIds = orderIds.length > 0 ? orderIds : orderId ? [orderId] : [];
  const redirectCandidate = formData.get("redirect_to")?.toString() || "";
  const redirectBase = redirectCandidate.startsWith("/admin/orders") ? redirectCandidate : "/admin/orders/archived";
  if (targetOrderIds.length === 0) throw new Error("Missing order id");

  const client = supabaseAdminClient;
  const { data: existingRows, error: existingError } = await client
    .from("orders")
    .select("id, design_type, status")
    .in("id", targetOrderIds);
  if (existingError) throw new Error(existingError.message);
  if (!existingRows || existingRows.length === 0) throw new Error("Order not found.");

  const premadeIds = existingRows
    .filter((order) => order.design_type === "premade" || order.status === "shipped")
    .map((order) => order.id);
  const customIds = existingRows
    .filter((order) => order.design_type !== "premade" && order.status !== "shipped")
    .map((order) => order.id);

  if (premadeIds.length > 0) {
    const { error } = await client
      .from("orders")
      .update({ status: "pending", shipped_at: null })
      .in("id", premadeIds);
    if (error) throw new Error(error.message);
  }

  if (customIds.length > 0) {
    const { error } = await client
      .from("orders")
      .update({ status: "pending", archived_at: null })
      .in("id", customIds);
    if (error) throw new Error(error.message);
  }

  revalidatePath(ORDERS_PATH);
  revalidatePath(ADDITIONAL_ITEMS_PATH);
  revalidatePath("/admin/orders/archived");
  await logAdminActivity({
    area: "operations",
    action: "restored",
    entityType: "orders",
    entityLabel: targetOrderIds.length === 1 ? targetOrderIds[0] : `${targetOrderIds.length} orders`,
    summary:
      targetOrderIds.length === 1
        ? "Moved 1 order back to pending."
        : `Moved ${targetOrderIds.length} orders back to pending.`,
    path: redirectBase,
    changedFields: ["Order status"],
  });
  redirect(redirectBase);
}

export async function markAdditionalItemShipped(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect" });
  const orderId = formData.get("order_id")?.toString();
  if (!orderId) throw new Error("Missing order id");

  const client = supabaseAdminClient;
  const { data: existing, error: existingError } = await client
    .from("orders")
    .select("id,order_number,title,customer_name,refunded_at")
    .eq("id", orderId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing?.refunded_at) throw new Error("Refunded orders cannot be shipped.");
  const { error } = await client
    .from("orders")
    .update({ status: "shipped", shipped_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) throw new Error(error.message);

  await logAdminActivity({
    area: "operations",
    action: "shipped",
    entityType: "order",
    entityId: existing?.id ?? orderId,
    entityLabel: describeOrderTarget({
      orderNumber: existing?.order_number ?? null,
      title: existing?.title ?? null,
      customerName: existing?.customer_name ?? null,
    }),
    summary: `Marked ${describeOrderTarget({
      orderNumber: existing?.order_number ?? null,
      title: existing?.title ?? null,
      customerName: existing?.customer_name ?? null,
    })} as shipped.`,
    path: ADDITIONAL_ITEMS_PATH,
    changedFields: ["Order status"],
  });

  redirect(ADDITIONAL_ITEMS_PATH);
}

export async function markAdditionalItemsShipped(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect" });
  const orderIdsRaw = formData.get("order_ids")?.toString() || "";
  const orderIds = orderIdsRaw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const includeCompanion = formData.get("include_companion")?.toString() === "on";
  const companionOrderIds = (formData.get("companion_order_ids")?.toString() || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const redirectCandidate = formData.get("redirect_to")?.toString() || "";
  const redirectBase = redirectCandidate.startsWith("/admin/orders") ? redirectCandidate : ADDITIONAL_ITEMS_PATH;
  if (orderIds.length === 0) throw new Error("Missing order ids");

  const client = supabaseAdminClient;
  const completedAt = new Date().toISOString();
  const { count: refundedCount, error: refundedError } = await client
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in("id", orderIds)
    .eq("design_type", "premade")
    .not("refunded_at", "is", null);
  if (refundedError) throw new Error(refundedError.message);
  if (refundedCount && refundedCount > 0) throw new Error("Refunded orders cannot be shipped.");
  const { error } = await client
    .from("orders")
    .update({ status: "shipped", shipped_at: completedAt })
    .in("id", orderIds)
    .eq("design_type", "premade");
  if (error) throw new Error(error.message);

  if (includeCompanion && companionOrderIds.length > 0) {
    const { data: companionAssignments, error: companionAssignmentsError } = await client
      .from("order_slots")
      .select("order_id,slot_id")
      .in("order_id", companionOrderIds);
    if (companionAssignmentsError) throw new Error(companionAssignmentsError.message);

    const slotIds = Array.from(
      new Set((companionAssignments ?? []).map((assignment) => assignment.slot_id).filter(Boolean)),
    );
    const slotDateById = new Map<string, string>();
    if (slotIds.length > 0) {
      const { data: companionSlots, error: companionSlotsError } = await client
        .from("production_slots")
        .select("id,slot_date")
        .in("id", slotIds);
      if (companionSlotsError) throw new Error(companionSlotsError.message);
      (companionSlots ?? []).forEach((slot) => {
        slotDateById.set(slot.id, slot.slot_date);
      });
    }

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}-${`${today.getDate()}`.padStart(2, "0")}`;
    for (const companionOrderId of companionOrderIds) {
      const assignment = (companionAssignments ?? []).find((item) => item.order_id === companionOrderId);
      if (!assignment) {
        throw new Error("Linked custom order is unassigned and must be updated in the production schedule first.");
      }
      const slotDate = slotDateById.get(assignment.slot_id);
      if (!slotDate) {
        throw new Error("Linked custom order assignment is invalid and must be updated in the production schedule first.");
      }
      if (slotDate > todayKey) {
        throw new Error("Linked custom order is scheduled for a future date and must be updated in the production schedule first.");
      }
    }

    const { count: refundedCompanionCount, error: refundedCompanionError } = await client
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("id", companionOrderIds)
      .not("refunded_at", "is", null);
    if (refundedCompanionError) throw new Error(refundedCompanionError.message);
    if (refundedCompanionCount && refundedCompanionCount > 0) {
      throw new Error("Refunded split items cannot be completed.");
    }

    const { error: companionError } = await client
      .from("orders")
      .update({ status: "archived", archived_at: completedAt })
      .in("id", companionOrderIds)
      .neq("design_type", "premade");
    if (companionError) throw new Error(companionError.message);
  }

  revalidatePath(ORDERS_PATH);
  revalidatePath("/admin/orders/archived");
  await logAdminActivity({
    area: "operations",
    action: "shipped",
    entityType: "premade-orders",
    entityLabel: `${orderIds.length} orders`,
    summary:
      includeCompanion && companionOrderIds.length > 0
        ? `Marked ${orderIds.length} pre-made order(s) shipped and completed ${companionOrderIds.length} linked custom order(s).`
        : `Marked ${orderIds.length} pre-made order(s) shipped.`,
    path: redirectBase,
    changedFields: ["Order status"],
  });
  redirect(redirectBase);
}

export async function markAdditionalItemsPending(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect" });
  const orderIdsRaw = formData.get("order_ids")?.toString() || "";
  const orderIds = orderIdsRaw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (orderIds.length === 0) throw new Error("Missing order ids");

  const client = supabaseAdminClient;
  const { count: refundedCount, error: refundedError } = await client
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in("id", orderIds)
    .eq("design_type", "premade")
    .not("refunded_at", "is", null);
  if (refundedError) throw new Error(refundedError.message);
  if (refundedCount && refundedCount > 0) throw new Error("Refunded orders cannot be unshipped.");
  const { error } = await client
    .from("orders")
    .update({ status: "pending", shipped_at: null })
    .in("id", orderIds)
    .eq("design_type", "premade");
  if (error) throw new Error(error.message);

  await logAdminActivity({
    area: "operations",
    action: "updated",
    entityType: "premade-orders",
    entityLabel: `${orderIds.length} orders`,
    summary: `Moved ${orderIds.length} pre-made order(s) back to pending.`,
    path: ADDITIONAL_ITEMS_PATH,
    changedFields: ["Order status"],
  });
  redirect(ADDITIONAL_ITEMS_PATH);
}

export async function addOpenOverride(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect" });
  const date = formData.get("date")?.toString();
  if (!date) throw new Error("Date is required.");

  const client = supabaseAdminClient;
  const { data: existing, error: existingError } = await client
    .from("production_blocks")
    .select("id")
    .eq("start_date", date)
    .eq("end_date", date)
    .eq("reason", OPEN_OVERRIDE_REASON)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (!existing) {
    const { error } = await client.from("production_blocks").insert({
      start_date: date,
      end_date: date,
      reason: OPEN_OVERRIDE_REASON,
    });
    if (error) throw new Error(error.message);
  }

  await logAdminActivity({
    area: "operations",
    action: "created",
    entityType: "production-block",
    entityLabel: date,
    summary: `Added an open override for ${date}.`,
    path: ORDERS_PATH,
    changedFields: ["Production block"],
  });
  redirect(ORDERS_PATH);
}

export async function addManualBlock(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect" });
  const date = formData.get("date")?.toString();
  if (!date) throw new Error("Date is required.");

  const client = supabaseAdminClient;
  const { error: removeOpenError } = await client
    .from("production_blocks")
    .delete()
    .eq("start_date", date)
    .eq("end_date", date)
    .eq("reason", OPEN_OVERRIDE_REASON);
  if (removeOpenError) throw new Error(removeOpenError.message);

  const { data: existing, error: existingError } = await client
    .from("production_blocks")
    .select("id")
    .eq("start_date", date)
    .eq("end_date", date)
    .not("reason", "eq", OPEN_OVERRIDE_REASON)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (!existing) {
    const { error } = await client.from("production_blocks").insert({
      start_date: date,
      end_date: date,
      reason: MANUAL_BLOCK_REASON,
    });
    if (error) throw new Error(error.message);
  }

  await logAdminActivity({
    area: "operations",
    action: "created",
    entityType: "production-block",
    entityLabel: date,
    summary: `Added a manual production block for ${date}.`,
    path: ORDERS_PATH,
    changedFields: ["Production block"],
  });
  redirect(ORDERS_PATH);
}

export async function removeManualBlock(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect" });
  const date = formData.get("date")?.toString();
  if (!date) throw new Error("Date is required.");

  const client = supabaseAdminClient;
  const { error } = await client
    .from("production_blocks")
    .delete()
    .eq("start_date", date)
    .eq("end_date", date)
    .eq("reason", MANUAL_BLOCK_REASON);
  if (error) throw new Error(error.message);

  await logAdminActivity({
    area: "operations",
    action: "deleted",
    entityType: "production-block",
    entityLabel: date,
    summary: `Removed the manual production block for ${date}.`,
    path: ORDERS_PATH,
    changedFields: ["Production block"],
  });
  redirect(ORDERS_PATH);
}
