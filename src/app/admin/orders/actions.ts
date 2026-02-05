"use server";

import { supabaseServerClient } from "@/lib/supabase/server";
import { generateOrderNumber, normalizeBaseOrderNumber } from "@/lib/orderNumbers";
import { getOrdersRecipients, sendCustomerRefundEmail, sendOrderEmail } from "@/lib/email";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/data";
import { refundSquarePayment, refundPayPalCapture } from "@/lib/refunds";
import { updateWooOrder } from "@/lib/woo";

const ORDERS_PATH = "/admin/orders";
const ADDITIONAL_ITEMS_PATH = "/admin/orders/additional-items";
const OPEN_OVERRIDE_REASON = "Open override";
const MANUAL_BLOCK_REASON = "Manual block";
const QUOTE_BLOCK_REASON = "Front-end block";
const ORDER_SUFFIX_PATTERN = /-(a|b)$/i;

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

export async function upsertOrder(formData: FormData) {
  const redirectTo = formData.get("redirect_to")?.toString() || null;
  const toastSuccess = formData.get("toast_success")?.toString() || null;
  const toastError = formData.get("toast_error")?.toString() || null;
  const id = formData.get("id")?.toString() || undefined;
  const order_number_raw = formData.get("order_number")?.toString() || null;
  const order_number = normalizeBaseOrderNumber(order_number_raw);
  const title = formData.get("title")?.toString() || null;
  const order_description = formData.get("order_description")?.toString() || null;
  const customer_name_raw = formData.get("customer_name")?.toString() || null;
  const customer_email = formData.get("customer_email")?.toString() || null;
  const category_id = formData.get("category_id")?.toString() || null;
  const packaging_option_id = formData.get("packaging_option_id")?.toString() || null;
  const quantity = formData.get("quantity") ? Number(formData.get("quantity")) : null;
  const labels_count = formData.get("labels_count") ? Number(formData.get("labels_count")) : null;
  const jacket = formData.get("jacket")?.toString() || null;
  const design_type = formData.get("design_type")?.toString() || null;
  const design_text_raw = formData.get("design_text")?.toString() || null;
  const design_text = design_text_raw?.trim() || null;
  const jacket_type_raw = formData.get("jacket_type")?.toString() || null;
  const jacket_type = jacket_type_raw?.trim() || null;
  const jacket_color_one = formData.get("jacket_color_one")?.toString() || null;
  const jacket_color_two = formData.get("jacket_color_two")?.toString() || null;
  const text_color_raw = formData.get("text_color")?.toString() || null;
  const heart_color_raw = formData.get("heart_color")?.toString() || null;
  const flavor = formData.get("flavor")?.toString() || null;
  const jar_lid_color = formData.get("jar_lid_color")?.toString() || null;
  const logo_url = formData.get("logo_url")?.toString() || null;
  const label_image_url = formData.get("label_image_url")?.toString() || null;
  const due_date = formData.get("due_date")?.toString() || null;
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
  const total_weight_kg =
    order_weight_g !== null
      ? Number(order_weight_g) / 1000
      : total_weight_kg_input !== null
        ? Number(total_weight_kg_input)
        : NaN;
  const total_price = formData.get("total_price") ? Number(formData.get("total_price")) : null;
  const status = formData.get("status")?.toString() || null;
  const payment_method = formData.get("payment_method")?.toString() || null;
  const notes = formData.get("notes")?.toString() || null;
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

  const client = supabaseServerClient;
  const existing = id
    ? (await client.from("orders").select("*").eq("id", id).maybeSingle()).data
    : null;
  const resolvedCategoryId = category_id ?? existing?.category_id ?? null;
  const isBranded = resolvedCategoryId === "branded";
  const isWedding = resolvedCategoryId?.startsWith("weddings");
  const nameFromParts = [first_name, last_name].filter(Boolean).join(" ") || null;
  const resolvedCustomerName = customer_name_raw ?? nameFromParts ?? existing?.customer_name ?? null;
  const resolvedTextColor = !isBranded ? text_color_raw ?? existing?.text_color ?? null : null;
  const resolvedHeartColor = isWedding ? heart_color_raw ?? existing?.heart_color ?? null : null;
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

  const resolvedWeightKg = Number.isFinite(total_weight_kg)
    ? total_weight_kg
    : existing?.total_weight_kg ?? NaN;
  try {
    if (!Number.isFinite(resolvedWeightKg) || resolvedWeightKg <= 0) {
      throw new Error("Order weight is required.");
    }

    const settings = await getSettings();
    if (resolvedWeightKg > settings.max_total_kg) {
      throw new Error(`Max total kg per settings is ${settings.max_total_kg}.`);
    }

    const basePayload = {
      title: title ?? existing?.title ?? null,
      order_description: order_description ?? existing?.order_description ?? null,
      customer_name: resolvedCustomerName,
      customer_email: customer_email ?? existing?.customer_email ?? null,
      category_id: category_id ?? existing?.category_id ?? null,
      packaging_option_id: packaging_option_id ?? existing?.packaging_option_id ?? null,
      quantity: quantity ?? existing?.quantity ?? null,
      labels_count: labels_count ?? existing?.labels_count ?? null,
      jacket: jacket ?? existing?.jacket ?? null,
      design_type: design_type ?? existing?.design_type ?? null,
      design_text: design_text ?? existing?.design_text ?? null,
      jacket_type: jacketType ?? existing?.jacket_type ?? null,
      jacket_color_one: jacket_color_one ?? existing?.jacket_color_one ?? null,
      jacket_color_two: jacket_color_two ?? existing?.jacket_color_two ?? null,
      flavor: flavor ?? existing?.flavor ?? null,
      jar_lid_color: jar_lid_color ?? existing?.jar_lid_color ?? null,
      logo_url: logo_url ?? existing?.logo_url ?? null,
      label_image_url: label_image_url ?? existing?.label_image_url ?? null,
      due_date: due_date ?? existing?.due_date ?? null,
      total_weight_kg: resolvedWeightKg,
      total_price: total_price ?? existing?.total_price ?? null,
      status: status ?? existing?.status ?? "pending",
      payment_method: payment_method ?? existing?.payment_method ?? null,
      notes: notes ?? existing?.notes ?? null,
      pickup: pickup ?? existing?.pickup ?? false,
      state: state ?? existing?.state ?? null,
      first_name: first_name ?? existing?.first_name ?? null,
      last_name: last_name ?? existing?.last_name ?? null,
      phone: phone ?? existing?.phone ?? null,
      organization_name: organization_name ?? existing?.organization_name ?? null,
      address_line1: address_line1 ?? existing?.address_line1 ?? null,
      address_line2: address_line2 ?? existing?.address_line2 ?? null,
      suburb: suburb ?? existing?.suburb ?? null,
      postcode: postcode ?? existing?.postcode ?? null,
      text_color: resolvedTextColor,
      heart_color: resolvedHeartColor,
      created_at: created_at ?? undefined,
    };

    if (id) {
      const { error } = await client.from("orders").update(basePayload).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const hasPremadeSelections = premadeSelections.length > 0;
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
      let insertError: { code?: string | null; message?: string | null } | null = null;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = { ...basePayload, order_number: orderNumbers.customOrderNumber };
        const { error } = await client.from("orders").insert(candidate);
        if (!error) {
          payload = candidate;
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
      const { customOrderNumber, premadeOrderNumber, quoteLabel } = orderNumbers;
      const ordersRecipients = getOrdersRecipients();
      if (ordersRecipients.length > 0) {
        try {
          await sendOrderEmail(ordersRecipients, {
            orderNumber: customOrderNumber,
            title: payload.title,
            designType: payload.design_type,
            quantity: payload.quantity,
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
    }
  } catch (error) {
    if (redirectTo && toastError) {
      const params = new URLSearchParams({ toast: "error", message: toastError });
      redirect(`${redirectTo}?${params.toString()}`);
    }
    throw error;
  }

  const destination = redirectTo ?? ORDERS_PATH;
  if (redirectTo && toastSuccess) {
    const params = new URLSearchParams({ toast: "success", message: toastSuccess });
    redirect(`${destination}?${params.toString()}`);
  }
  redirect(destination);
}

export async function refundOrder(formData: FormData) {
  const id = formData.get("id")?.toString() || null;
  const refundReason = formData.get("refund_reason")?.toString() || null;
  const redirectCandidate = formData.get("redirect_to")?.toString() || "";
  const redirectBase = redirectCandidate.startsWith("/admin/orders") ? redirectCandidate : ORDERS_PATH;
  if (!id) {
    redirect(`${redirectBase}?toast_error=Refund%20failed%3A%20Missing%20order%20id`);
  }
  const client = supabaseServerClient;
  const { data: order, error } = await client.from("orders").select("*").eq("id", id).maybeSingle();
  if (error || !order) {
    redirect(`${redirectBase}?toast_error=Refund%20failed%3A%20Order%20not%20found`);
  }

  const provider = order.payment_provider;
  const transactionId = order.payment_transaction_id;
  if (!provider || !transactionId) {
    redirect(`${redirectBase}?toast_error=Refund%20failed%3A%20Missing%20payment%20details`);
  }

  const amount = Number(order.total_price ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    redirect(`${redirectBase}?toast_error=Refund%20failed%3A%20Invalid%20amount`);
  }

  try {
    if (provider === "square") {
      await refundSquarePayment(String(transactionId), Math.round(amount * 100), refundReason);
    } else if (provider === "paypal") {
      await refundPayPalCapture(String(transactionId), amount.toFixed(2), refundReason);
    } else {
      redirect(`${redirectBase}?toast_error=Refund%20failed%3A%20Unsupported%20provider`);
    }

    const refundedAt = new Date().toISOString();
    await client
      .from("orders")
      .update({
        status: "refunded",
        refunded_at: refundedAt,
        woo_order_status: "refunded",
      })
      .eq("id", order.id);

    if (order.woo_order_id) {
      await updateWooOrder(String(order.woo_order_id), { status: "refunded" });
    }

    if (order.customer_email) {
      await sendCustomerRefundEmail([order.customer_email], {
        orderNumber: order.order_number ?? null,
        amount: Number(order.total_price ?? 0),
        paymentMethod: order.payment_method ?? order.payment_provider ?? null,
      });
    }

    redirect(`${redirectBase}?toast_success=Refund%20processed`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refund failed.";
    redirect(`${redirectBase}?toast_error=${encodeURIComponent(message)}`);
  }
}

export async function upsertSlot(formData: FormData) {
  const id = formData.get("id")?.toString() || undefined;
  const slot_date = formData.get("slot_date")?.toString() || null;
  const capacity_kg = Number(formData.get("capacity_kg") || 0);
  const status = formData.get("status")?.toString() || "open";
  const notes = formData.get("notes")?.toString() || null;

  if (!slot_date) throw new Error("Slot date is required.");
  if (!Number.isFinite(capacity_kg) || capacity_kg <= 0) {
    throw new Error("Capacity must be greater than zero.");
  }

  const client = supabaseServerClient;
  const payload = { slot_date, capacity_kg, status, notes };
  if (id) {
    const { error } = await client.from("production_slots").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client.from("production_slots").insert(payload);
    if (error) throw new Error(error.message);
  }

  redirect(ORDERS_PATH);
}

export async function assignOrderToSlot(formData: FormData) {
  const assignmentId = formData.get("assignment_id")?.toString() || undefined;
  const order_id = formData.get("order_id")?.toString();
  const slot_id = formData.get("slot_id")?.toString() || undefined;
  const slot_date = formData.get("slot_date")?.toString();
  const slot_index_input = formData.get("slot_index");
  const slot_index = slot_index_input !== null ? Number(slot_index_input) : NaN;
  const kg_assigned = Number(formData.get("kg_assigned") || 0);
  const todayKey = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, "0");
    const day = `${now.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  })();

  if (!order_id) throw new Error("Order is required.");
  if (!slot_id && (!slot_date || !Number.isFinite(slot_index))) {
    throw new Error("Slot date and index are required.");
  }
  if (!Number.isFinite(kg_assigned) || kg_assigned <= 0) {
    throw new Error("Assigned kg must be greater than zero.");
  }
  if (slot_date && slot_date < todayKey) {
    throw new Error("Cannot assign orders to past dates.");
  }

  const client = supabaseServerClient;
  let resolvedSlotId = slot_id;

  const { data: order, error: orderError } = await client
    .from("orders")
    .select("id,total_weight_kg")
    .eq("id", order_id)
    .single();
  if (orderError) throw new Error(orderError.message);

  if (!resolvedSlotId && slot_date && Number.isFinite(slot_index)) {
    const { data: existingSlot, error: existingError } = await client
      .from("production_slots")
      .select("id,capacity_kg")
      .eq("slot_date", slot_date)
      .eq("slot_index", slot_index)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    if (existingSlot) {
      resolvedSlotId = existingSlot.id;
    } else {
      const { max_total_kg } = await getSettings();
      const { data: created, error: createError } = await client
        .from("production_slots")
        .insert({
          slot_date,
          slot_index,
          capacity_kg: max_total_kg,
          status: "open",
        })
        .select("id,capacity_kg")
        .single();
      if (createError) throw new Error(createError.message);
      resolvedSlotId = created.id;
    }
  }

  if (!resolvedSlotId) throw new Error("Slot could not be resolved.");
  if (!slot_date && resolvedSlotId) {
    const { data: slotDateRow, error: slotDateError } = await client
      .from("production_slots")
      .select("slot_date")
      .eq("id", resolvedSlotId)
      .maybeSingle();
    if (slotDateError) throw new Error(slotDateError.message);
    if (slotDateRow?.slot_date && slotDateRow.slot_date < todayKey) {
      throw new Error("Cannot assign orders to past dates.");
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

  const existingOrderAssignment = orderAssignments[0];
  const previousForAssignment =
    assignmentId
      ? slotAssignments.find((a) => a.id === assignmentId)?.kg_assigned ?? 0
      : existingOrderAssignment?.kg_assigned ?? 0;

  const orderUsed =
    orderAssignments.reduce((sum, a) => sum + Number(a.kg_assigned || 0), 0) -
    Number(previousForAssignment || 0) +
    kg_assigned;
  if (orderUsed > Number(order.total_weight_kg)) {
    throw new Error("Assigned kg exceeds the order's total weight.");
  }

  if (slotAssignments.length > 0 && slotAssignments[0]?.id !== assignmentId && slotAssignments[0]?.id !== existingOrderAssignment?.id) {
    throw new Error("This slot already has an order assigned.");
  }

  if (assignmentId) {
    const { error } = await client
      .from("order_slots")
      .update({ order_id, slot_id: resolvedSlotId, kg_assigned })
      .eq("id", assignmentId);
    if (error) throw new Error(error.message);
  } else {
    if (existingOrderAssignment) {
      const { error } = await client
        .from("order_slots")
        .update({ slot_id: resolvedSlotId, kg_assigned })
        .eq("id", existingOrderAssignment.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await client.from("order_slots").insert({ order_id, slot_id: resolvedSlotId, kg_assigned });
      if (error) throw new Error(error.message);
    }
  }

  const { error: statusError } = await client.from("orders").update({ status: "scheduled" }).eq("id", order_id);
  if (statusError) throw new Error(statusError.message);

  redirect(ORDERS_PATH);
}

export async function deleteAssignment(formData: FormData) {
  const assignmentId = formData.get("assignment_id")?.toString();
  if (!assignmentId) throw new Error("Missing assignment id");

  const client = supabaseServerClient;
  const { data: orderSlot, error: slotLookupError } = await client
    .from("order_slots")
    .select("order_id")
    .eq("id", assignmentId)
    .maybeSingle();
  if (slotLookupError) throw new Error(slotLookupError.message);

  const { error } = await client.from("order_slots").delete().eq("id", assignmentId);
  if (error) throw new Error(error.message);

  if (orderSlot?.order_id) {
    const { error: statusError } = await client
      .from("orders")
      .update({ status: "unassigned" })
      .eq("id", orderSlot.order_id);
    if (statusError) throw new Error(statusError.message);
  }

  redirect(ORDERS_PATH);
}

export async function archiveOrder(formData: FormData) {
  const orderId = formData.get("order_id")?.toString();
  if (!orderId) throw new Error("Missing order id");

  const client = supabaseServerClient;
  const { error } = await client.from("orders").update({ status: "archived" }).eq("id", orderId);
  if (error) throw new Error(error.message);

  redirect(ORDERS_PATH);
}

export async function unarchiveOrder(formData: FormData) {
  const orderId = formData.get("order_id")?.toString();
  if (!orderId) throw new Error("Missing order id");

  const client = supabaseServerClient;
  const { error } = await client.from("orders").update({ status: "pending" }).eq("id", orderId);
  if (error) throw new Error(error.message);

  redirect("/admin/orders/archived");
}

export async function markAdditionalItemShipped(formData: FormData) {
  const orderId = formData.get("order_id")?.toString();
  if (!orderId) throw new Error("Missing order id");

  const client = supabaseServerClient;
  const { error } = await client.from("orders").update({ status: "shipped" }).eq("id", orderId);
  if (error) throw new Error(error.message);

  redirect(ADDITIONAL_ITEMS_PATH);
}

export async function markAdditionalItemsShipped(formData: FormData) {
  const orderIdsRaw = formData.get("order_ids")?.toString() || "";
  const orderIds = orderIdsRaw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (orderIds.length === 0) throw new Error("Missing order ids");

  const client = supabaseServerClient;
  const { error } = await client
    .from("orders")
    .update({ status: "shipped" })
    .in("id", orderIds)
    .eq("design_type", "premade");
  if (error) throw new Error(error.message);

  redirect(ADDITIONAL_ITEMS_PATH);
}

export async function addOpenOverride(formData: FormData) {
  const date = formData.get("date")?.toString();
  if (!date) throw new Error("Date is required.");

  const client = supabaseServerClient;
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

  redirect(ORDERS_PATH);
}

export async function addManualBlock(formData: FormData) {
  const date = formData.get("date")?.toString();
  if (!date) throw new Error("Date is required.");

  const client = supabaseServerClient;
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

  redirect(ORDERS_PATH);
}

export async function removeManualBlock(formData: FormData) {
  const date = formData.get("date")?.toString();
  if (!date) throw new Error("Date is required.");

  const client = supabaseServerClient;
  const { error } = await client
    .from("production_blocks")
    .delete()
    .eq("start_date", date)
    .eq("end_date", date)
    .eq("reason", MANUAL_BLOCK_REASON);
  if (error) throw new Error(error.message);

  redirect(ORDERS_PATH);
}

export async function addQuoteBlock(formData: FormData) {
  const start_date = formData.get("start_date")?.toString();
  const end_date = formData.get("end_date")?.toString();
  if (!start_date) throw new Error("Start date is required.");
  const resolvedEnd = end_date && end_date.length > 0 ? end_date : start_date;

  const client = supabaseServerClient;
  const { error } = await client.from("quote_blocks").insert({
    start_date,
    end_date: resolvedEnd,
    reason: QUOTE_BLOCK_REASON,
  });
  if (error) throw new Error(error.message);

  redirect(ORDERS_PATH);
}

export async function removeQuoteBlock(formData: FormData) {
  const id = formData.get("id")?.toString();
  if (!id) throw new Error("Block id is required.");

  const client = supabaseServerClient;
  const { error } = await client.from("quote_blocks").delete().eq("id", id);
  if (error) throw new Error(error.message);

  redirect(ORDERS_PATH);
}
