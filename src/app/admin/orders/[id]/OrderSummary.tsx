import Image from "next/image";
import type { ReactNode } from "react";
import { AdminLink } from "../../AdminNavigationFeedback";
import type {
  Category,
  ColorPaletteRow,
  LabelType,
  OrderRow,
  OrderSlot,
  PackagingOption,
  ProductionSlot,
} from "@/lib/data";
import { CandyPreview } from "@/app/quote/CandyPreview";
import { isAdminManagedCustomOrder } from "../scheduleVisibility";
import { resolveCandyPreviewJacket } from "../orderColorUtils";
import {
  batchWeightsForOrder,
  formatDate,
  formatMoney,
  formatOrderDescription,
  logoDownloadNameForOrder,
} from "../productionScheduleShared";
import { splitWeddingOrderDesign } from "./orderDetailCalculations";
import { orderWorkflow } from "../orderWorkflow";
import { CloseRefundedOrderAction, OrderActions } from "../OrderActions";
import { OrderPaymentConfirmation } from "../OrderPaymentConfirmation";

function Card({
  title,
  children,
  id,
}: {
  title: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <h3 className="mb-4 text-base font-semibold text-zinc-900">{title}</h3>
      {children}
    </section>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-800">
        {children === null || children === undefined || children === ""
          ? "Not recorded"
          : children}
      </dd>
    </div>
  );
}
const fields = "grid min-w-0 grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2";

export function OrderSummary({
  order,
  orders,
  categories,
  packagingOptions,
  palette,
  labelTypes,
  slots,
  assignments,
  today,
  canWrite,
}: {
  order: OrderRow;
  orders: OrderRow[];
  categories: Category[];
  packagingOptions: PackagingOption[];
  palette: ColorPaletteRow[];
  labelTypes: LabelType[];
  slots: ProductionSlot[];
  assignments: OrderSlot[];
  today: string;
  canWrite: boolean;
}) {
  const state = orderWorkflow(order, assignments, slots, today);
  const packaging = packagingOptions.find(
    (option) => option.id === order.packaging_option_id,
  );
  const category = categories.find(
    (category) => category.id === order.category_id,
  );
  const labelType = labelTypes.find((type) => type.id === order.label_type_id);
  const slotMap = new Map(slots.map((slot) => [slot.id, slot]));
  const batches = batchWeightsForOrder(order);
  const jacket = resolveCandyPreviewJacket(order);
  const wedding = order.category_id?.startsWith("weddings");
  const weddingText = splitWeddingOrderDesign(order.design_text);
  const color = (value: string | null) => {
    if (!value) return "Not recorded";
    const match = palette.find(
      (entry) => entry.hex.toLowerCase() === value.toLowerCase(),
    );
    return (
      <span className="inline-flex max-w-full items-center gap-2">
        <span
          className="h-4 w-4 shrink-0 rounded-full border border-zinc-200"
          style={{ backgroundColor: value }}
          aria-hidden="true"
        />
        {match ? `${match.category} ${match.shade}` : value}
      </span>
    );
  };
  const address = [
    order.address_line1,
    order.address_line2,
    [order.suburb, order.state, order.postcode].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join("\n");
  const customer =
    [order.first_name, order.last_name].filter(Boolean).join(" ") ||
    order.customer_name;
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Order overview
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-900">
              {state.label}
            </h2>
          </div>
          <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs text-emerald-800">
            Summary · read-only
          </span>
        </div>
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            ["Order total", formatMoney(order.total_price)],
            ["Required date", formatDate(order.due_date) || "Not recorded"],
            [
              "Production weight",
              `${Number(order.total_weight_kg || 0).toFixed(2)} kg`,
            ],
            [
              "Payment",
              state.fullRefund
                ? "Fully refunded"
                : state.partialRefund
                  ? "Partially refunded"
                  : state.paid
                    ? "Paid"
                    : state.internal
                      ? "Internal stock"
                      : "Unconfirmed",
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                {label}
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">
                {value}
              </p>
            </div>
          ))}
        </div>
        <OrderActions
          order={order}
          orders={orders}
          assignments={assignments}
          slots={slots}
          today={today}
          canWrite={canWrite}
          summary
        />
      </section>
      {state.hasRefund && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <strong>
            {state.partialRefund
              ? "Partial refund recorded"
              : "Refund recorded"}
            .
          </strong>{" "}
          {formatMoney(state.refundedCents / 100)} refunded against{" "}
          {formatMoney(order.total_price)}.{" "}
          {state.partialRefund
            ? `${formatMoney((state.totalCents - state.refundedCents) / 100)} was not refunded; this is not a new amount owed by the customer.`
            : ""}{" "}
          {!state.closed &&
            "The order is still open. Confirm whether any goods remain to make or fulfil; close it only when resolved."}
        </div>
      )}
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
        <div className="min-w-0 space-y-5">
          <Card title="Customer & fulfilment">
            <dl className={fields}>
              <Field label="Customer">{customer}</Field>
              <Field label="Organisation">{order.organization_name}</Field>
              <Field label="Email">
                {order.customer_email ? (
                  <a
                    href={`mailto:${order.customer_email}`}
                    className="text-emerald-800 hover:underline"
                  >
                    {order.customer_email}
                  </a>
                ) : null}
              </Field>
              <Field label="Phone">
                {order.phone ? (
                  <a
                    href={`tel:${order.phone}`}
                    className="text-emerald-800 hover:underline"
                  >
                    {order.phone}
                  </a>
                ) : null}
              </Field>
              <Field label="Fulfilment">
                {state.internal
                  ? "Internal stock run"
                  : order.pickup
                    ? "Customer collection"
                    : "Delivery"}
              </Field>
              <Field label="Address">{address || order.location}</Field>
              <Field label="Created">{formatDate(order.created_at)}</Field>
              <Field label="Required">{formatDate(order.due_date)}</Field>
              <Field label="Recorded status">
                {order.status.replaceAll("_", " ")}
              </Field>
              <Field label="Completed / closed">
                {formatDate(order.shipped_at || order.archived_at)}
              </Field>
            </dl>
          </Card>
          <Card title="Packaging & quantities">
            <dl className={fields}>
              <Field label="Product / category">
                {state.internal
                  ? "Internal pre-made stock"
                  : category?.name || order.category_id || order.design_type}
              </Field>
              <Field label="Description">
                {order.order_description ||
                  formatOrderDescription(order, packaging)}
              </Field>
              <Field label="Packaging">
                {packaging
                  ? `${packaging.type} · ${packaging.size}`
                  : order.packaging_option_id}
              </Field>
              <Field label="Quantity">{order.quantity}</Field>
              <Field label="Total weight">
                {Number(order.total_weight_kg).toFixed(2)} kg
              </Field>
              <Field label="Lid colour">{order.jar_lid_color}</Field>
              <Field label="Custom labels">
                {Number(order.labels_count || 0)}
              </Field>
              <Field label="Ingredient labels">
                {Number(order.ingredient_labels_count || 0)}
              </Field>
              <Field label="Label format">
                {labelType
                  ? `${labelType.shape} · ${labelType.dimensions || ""}`
                  : order.label_type_id || "None recorded"}
              </Field>
            </dl>
          </Card>
          <Card title="Production plan">
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                {batches.length} planned{" "}
                {batches.length === 1 ? "batch" : "batches"} ·{" "}
                {batches.map((weight) => `${weight.toFixed(2)} kg`).join(" + ")}
              </span>
              <span className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                Made recorded: {state.recordedMade ? "Yes" : "No"}
              </span>
            </div>
            {state.own.length ? (
              <ul className="space-y-2">
                {[...state.own]
                  .sort((a, b) =>
                    (slotMap.get(a.slot_id)?.slot_date || "").localeCompare(
                      slotMap.get(b.slot_id)?.slot_date || "",
                    ),
                  )
                  .map((assignment) => {
                    const slot = slotMap.get(assignment.slot_id);
                    return (
                      <li
                        key={assignment.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-100 p-3 text-xs text-zinc-600"
                      >
                        <span>
                          {slot
                            ? `${formatDate(slot.slot_date)} · Slot ${slot.slot_index}`
                            : "Slot date unavailable"}
                        </span>
                        <strong>
                          {Number(assignment.kg_assigned).toFixed(2)} kg
                        </strong>
                      </li>
                    );
                  })}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">
                No production slots assigned.
              </p>
            )}
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              {state.remainingKg.toFixed(2)} kg not allocated. Production dates
              are planning records, not proof that goods were made or sent.
            </p>
          </Card>
        </div>
        <div className="min-w-0 space-y-5">
          <Card title="Design & artwork">
            <div className="flex min-w-0 flex-wrap items-center gap-5">
              {!state.premade && (
                <div className="max-w-full overflow-hidden rounded-xl bg-zinc-50 p-1">
                  <CandyPreview
                    designText={!wedding ? order.design_text || "" : undefined}
                    lineOne={wedding ? weddingText.lineOne : undefined}
                    lineTwo={wedding ? weddingText.lineTwo : undefined}
                    showHeart={Boolean(wedding)}
                    mode={jacket.mode}
                    showPinstripe={jacket.showPinstripe}
                    colorOne={order.jacket_color_one || "#b7b7b7"}
                    fillColor={order.candy_fill_color || undefined}
                    pinstripeColor={order.pinstripe_color || undefined}
                    colorTwo={order.jacket_color_two || "#b7b7b7"}
                    textColor={order.text_color || undefined}
                    heartColor={order.heart_color || undefined}
                    logoUrl={
                      order.design_type === "branded" ||
                      order.category_id === "branded"
                        ? order.logo_url
                        : undefined
                    }
                    isInitials={order.category_id === "weddings-initials"}
                    dimensions={{ width: 230, height: 171 }}
                    customTextVariant={
                      order.category_id === "custom-1-6"
                        ? "short"
                        : order.category_id === "custom-7-14"
                          ? "long"
                          : undefined
                    }
                  />
                </div>
              )}
              <dl className="min-w-0 flex-1 space-y-4">
                <Field label="Design text">{order.design_text}</Field>
                <Field label="Flavour">{order.flavor}</Field>
                <Field label="Jacket">
                  {(
                    order.jacket ||
                    order.jacket_type ||
                    "Single colour"
                  ).replaceAll("_", " ")}
                </Field>
              </dl>
            </div>
            <dl className={`${fields} mt-5`}>
              <Field label="Jacket colour one">
                {color(order.jacket_color_one)}
              </Field>
              <Field label="Jacket colour two">
                {color(order.jacket_color_two)}
              </Field>
              <Field label="Text colour">{color(order.text_color)}</Field>
              <Field label="Candy fill colour">{color(order.candy_fill_color || "#ffffff")}</Field>
              {jacket.showPinstripe ? <Field label="Pinstripe colour">{color(order.pinstripe_color || "#ffffff")}</Field> : null}
              <Field label="Heart colour">{color(order.heart_color)}</Field>
            </dl>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                {
                  label: "Uploaded logo",
                  url: order.logo_url,
                  filename: logoDownloadNameForOrder(order),
                },
                {
                  label: "Label artwork",
                  url: order.label_image_url,
                  filename: `order-${order.order_number || order.id}-label`,
                },
              ].map((asset) =>
                asset.url ? (
                  <div
                    key={asset.label}
                    className="min-w-0 rounded-xl border border-zinc-100 p-3"
                  >
                    <p className="mb-3 text-xs font-semibold text-zinc-600">
                      {asset.label}
                    </p>
                    <a
                      href={asset.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block"
                    >
                      <Image
                        src={asset.url}
                        width={200}
                        height={120}
                        unoptimized
                        alt={asset.label}
                        className="h-28 w-full rounded-lg bg-zinc-50 object-contain"
                      />
                    </a>
                    <a
                      href={asset.url}
                      download={asset.filename}
                      className="mt-3 inline-block text-xs font-semibold text-emerald-800 hover:underline"
                    >
                      Open / download original
                    </a>
                  </div>
                ) : (
                  <p
                    key={asset.label}
                    className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-400"
                  >
                    {asset.label}: none recorded
                  </p>
                ),
              )}
            </div>
          </Card>
          <Card title="Payment & pricing" id="order-payment">
            <dl className={fields}>
              <Field label="Total">{formatMoney(order.total_price)}</Field>
              <Field label="Payment status">
                {state.hasRefund
                  ? state.partialRefund
                    ? "Partially refunded"
                    : "Fully refunded"
                  : state.paid
                    ? "Paid"
                    : "Unconfirmed"}
              </Field>
              <Field label="Payment method">
                {order.payment_method || order.payment_provider}
              </Field>
              <Field label="Paid date">{formatDate(order.paid_at)}</Field>
              <Field label="Pricing subtotal">
                {order.admin_pricing_subtotal === null
                  ? "Not recorded"
                  : formatMoney(order.admin_pricing_subtotal)}
              </Field>
              <Field label="Discount">
                {order.admin_discount_type &&
                order.admin_discount_type !== "none"
                  ? order.admin_discount_type === "percent"
                    ? `${order.admin_discount_value ?? 0}%`
                    : formatMoney(order.admin_discount_value)
                  : "None"}
              </Field>
              <Field label="Price override">
                {order.admin_price_override === null
                  ? "None"
                  : formatMoney(order.admin_price_override)}
              </Field>
              <Field label="Invoice status">
                {order.square_invoice_status || "No Square invoice"}
              </Field>
              <Field label="Invoice title">{order.square_invoice_title}</Field>
              <Field label="Invoice due">
                {formatDate(order.square_invoice_due_date)}
              </Field>
              <Field label="Invoice sent">
                {formatDate(order.square_invoice_sent_at)}
              </Field>
              <Field label="Invoice issue">
                {order.square_invoice_error
                  ? "An invoice error is recorded. Open the invoice to review."
                  : "None recorded"}
              </Field>
              {state.hasRefund && (
                <>
                  <Field label="Refunded">
                    {formatMoney(state.refundedCents / 100)}
                  </Field>
                  <Field label="Not refunded (not a debt)">
                    {formatMoney(
                      Math.max(0, state.totalCents - state.refundedCents) / 100,
                    )}
                  </Field>
                  <Field label="Refund date">
                    {formatDate(order.refunded_at)}
                  </Field>
                  <Field label="Refund reason">{order.refund_reason}</Field>
                </>
              )}
            </dl>
            {canWrite && !state.closed && state.partialRefund && (
              <div className="mt-5 border-t border-zinc-100 pt-4">
                <p className="mb-3 text-xs leading-5 text-zinc-500">
                  If the refund resolved the order and no goods remain to make
                  or fulfil, close the workflow here. This does not issue
                  another refund.
                </p>
                <CloseRefundedOrderAction orderId={order.id} />
              </div>
            )}
            {canWrite &&
              !state.closed &&
              !state.hasRefund &&
              !state.paid &&
              isAdminManagedCustomOrder(order) && (
                <div className="mt-5 border-t border-zinc-100 pt-4">
                  <OrderPaymentConfirmation
                    id={order.id}
                    combined={Boolean(
                      order.square_invoice_id &&
                        orders.filter(
                          (item) =>
                            item.square_invoice_id === order.square_invoice_id,
                        ).length > 1,
                    )}
                  />
                </div>
              )}
          </Card>
          <Card title="Notes">
            <dl className="space-y-5">
              <Field label="Production / internal notes">{order.notes}</Field>
              <Field label="Customer note">{order.customer_note}</Field>
            </dl>
          </Card>
          <details className="rounded-xl border border-zinc-200 bg-white p-5">
            <summary className="cursor-pointer text-xs font-semibold text-zinc-500">
              Record references
            </summary>
            <dl className={`${fields} mt-4`}>
              <Field label="Order ID">{order.id}</Field>
              <Field label="Square invoice ID">{order.square_invoice_id}</Field>
              <Field label="Payment reference">
                {order.payment_transaction_id}
              </Field>
              <Field label="Legacy order ID">{order.woo_order_id}</Field>
              <Field label="Legacy status">{order.woo_order_status}</Field>
            </dl>
          </details>
        </div>
      </div>
      <p className="text-xs text-zinc-400">
        This page shows the saved record.{" "}
        {canWrite ? (
          <AdminLink
            href={`${state.href}?edit=1`}
            className="font-medium text-emerald-800 hover:underline"
          >
            Edit details to make changes.
          </AdminLink>
        ) : (
          "Changes require write access."
        )}
      </p>
    </div>
  );
}
