"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type {
  Category,
  OrderRow,
  OrderSlot,
  PackagingOption,
  ProductionDayNote,
  ProductionSlot,
  SettingsRow,
} from "@/lib/data";
import { archiveOrderInline, deleteOrderInline, markOrderAsPaid } from "./actions";
import { ADMIN_PREMADE_CATEGORY_ID, ADMIN_PREMADE_ORDER_LABEL, isAdminPremadeOrder } from "@/lib/adminPremadeOrder";
import OrderTitleWithLogo from "./OrderTitleWithLogo";
import ProductionScheduleSection from "./ProductionScheduleSection";
import AssignmentCalendarModal from "./AssignmentCalendarModal";
import SplitAwareActionForm from "./SplitAwareActionForm";
import {
  canCompleteOrderForSlotDates,
  formatBatchBreakdown,
  formatDate,
  formatDueDateDistance,
  formatMoney,
  formatOrderDescription,
  formatScheduleStatusLabel,
  getMultiAssignmentScheduleStatus,
  getPremadeSiblingMeta,
  logoDownloadNameForOrder,
  nextAssignableKgForOrder,
  productionCompletionActionLabel,
  splitCustomerName,
  statusBadge,
  weightLabel,
} from "./productionScheduleShared";
import {
  isAdminManagedCustomOrder,
  isAdminManagedCustomOrderUnpaid,
  isVisibleOnProductionSchedule,
} from "./scheduleVisibility";

type Props = {
  orders: OrderRow[];
  slots: ProductionSlot[];
  assignments: OrderSlot[];
  settings: SettingsRow;
  packagingOptions: PackagingOption[];
  categories: Category[];
  dayNotes: ProductionDayNote[];
  initialSelectedId?: string | null;
};

const JACKET_LABELS = new Map([
  ["", "Single colour"],
  ["two_colour", "Two colour"],
  ["pinstripe", "Pin stripe"],
  ["two_colour_pinstripe", "Two colour + pin stripe"],
  ["rainbow", "Rainbow"],
]);

function PackagingDescription({ value }: { value: string }) {
  const match = value.match(/^(\d+(?:\.\d+)?)\s+x\s+(.+)$/);
  if (!match) return <>{value || "-"}</>;
  return (
    <>
      <strong className="font-semibold text-zinc-900">{match[1]}</strong>
      {` x ${match[2]}`}
    </>
  );
}

function DetailField({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`grid min-w-0 grid-cols-[7.25rem_minmax(0,1fr)] items-start gap-2 ${className}`}>
      <dt className="pt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{label}</dt>
      <dd className="break-words text-xs font-semibold leading-5 text-zinc-900">{children || "-"}</dd>
    </div>
  );
}

const customerDisplayName = (order: OrderRow) => {
  const nameFallback = splitCustomerName(order.customer_name);
  const first = order.first_name?.trim() || nameFallback.first;
  const last = order.last_name?.trim() || nameFallback.last;
  return [first, last].filter(Boolean).join(" ") || order.customer_name || "-";
};

const designDisplay = (order: OrderRow) =>
  order.design_text?.trim() || order.title?.trim() || order.order_description?.trim() || "-";

export function OrdersTable({
  orders,
  slots,
  assignments,
  settings,
  packagingOptions,
  categories,
  dayNotes,
  initialSelectedId = null,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [assignmentModalOrderId, setAssignmentModalOrderId] = useState<string | null>(null);

  const packagingById = useMemo(
    () => new Map(packagingOptions.map((option) => [option.id, option])),
    [packagingOptions],
  );
  const categoryLabelById = useMemo(
    () =>
      new Map([
        ...categories.map((category) => [category.id, category.name] as const),
        [ADMIN_PREMADE_CATEGORY_ID, ADMIN_PREMADE_ORDER_LABEL] as const,
      ]),
    [categories],
  );
  const listOrders = useMemo(() => {
    const visible = orders.filter(isVisibleOnProductionSchedule);
    return [...visible].sort((a, b) => {
      const aDate = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
      const bDate = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
      if (aDate !== bDate) return aDate - bDate;
      return (a.order_number ?? a.id ?? "").localeCompare(b.order_number ?? b.id ?? "");
    });
  }, [orders]);
  const slotMap = useMemo(() => new Map(slots.map((slot) => [slot.id, slot])), [slots]);
  const assignmentByOrderId = useMemo(() => {
    const map = new Map<string, { assignment: OrderSlot; slot: ProductionSlot | null }>();
    assignments.forEach((assignment) => {
      if (map.has(assignment.order_id)) return;
      map.set(assignment.order_id, {
        assignment,
        slot: slotMap.get(assignment.slot_id) ?? null,
      });
    });
    return map;
  }, [assignments, slotMap]);
  const assignmentsByOrderId = useMemo(() => {
    const map = new Map<string, OrderSlot[]>();
    assignments.forEach((assignment) => {
      const list = map.get(assignment.order_id) ?? [];
      list.push(assignment);
      map.set(assignment.order_id, list);
    });
    return map;
  }, [assignments]);
  const assignedSlotDatesByOrderId = useMemo(() => {
    const map = new Map<string, string[]>();
    assignments.forEach((assignment) => {
      const slotDate = slotMap.get(assignment.slot_id)?.slot_date;
      if (!slotDate) return;
      const list = map.get(assignment.order_id) ?? [];
      list.push(slotDate);
      map.set(assignment.order_id, list);
    });
    return map;
  }, [assignments, slotMap]);
  const unassignedOrders = useMemo(
    () =>
      listOrders.filter((order) => {
        const orderAssignments = assignmentsByOrderId.get(order.id) ?? [];
        return nextAssignableKgForOrder(order, orderAssignments) > 0;
      }),
    [assignmentsByOrderId, listOrders],
  );
  const visibleListOrders = useMemo(
    () =>
      showAllOrders || (selectedId ? !listOrders.slice(0, 15).some((order) => order.id === selectedId) : false)
        ? listOrders
        : listOrders.slice(0, 15),
    [listOrders, selectedId, showAllOrders],
  );
  const assignmentModalOrder = useMemo(
    () => orders.find((order) => order.id === assignmentModalOrderId) ?? null,
    [assignmentModalOrderId, orders],
  );
  const assignmentModalAssignment = assignmentModalOrder
    ? assignmentByOrderId.get(assignmentModalOrder.id) ?? null
    : null;

  useEffect(() => {
    if (!selectedId) return;
    const frame = window.requestAnimationFrame(() => {
      const detail = document.getElementById(`order-detail-${selectedId}`);
      if (!detail) return;
      const rect = detail.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const margin = 16;

      if (rect.height + margin * 2 >= viewportHeight) {
        window.scrollTo({
          top: window.scrollY + rect.top - margin,
          behavior: "smooth",
        });
        return;
      }

      if (rect.bottom > viewportHeight - margin || rect.top < margin) {
        window.scrollBy({
          top: rect.bottom - viewportHeight + margin,
          behavior: "smooth",
        });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedId]);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            <tr>
              <th className="px-3 py-3 text-left">Order #</th>
              <th className="px-3 py-3 text-left">Title</th>
              <th className="px-3 py-3 text-left">Date required</th>
              <th className="px-3 py-3 text-left">Packaging</th>
              <th className="px-3 py-3 text-left">Weight</th>
              <th className="px-3 py-3 text-left">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {visibleListOrders.map((order) => {
              const printTarget = order.id ?? order.order_number;
              const assignedSlotDates = assignedSlotDatesByOrderId.get(order.id) ?? [];
              const scheduleStatus = getMultiAssignmentScheduleStatus(order, assignedSlotDates);
              const canCompleteFromSchedule = canCompleteOrderForSlotDates(order, assignedSlotDates);
              const premadeSiblingMeta = getPremadeSiblingMeta(orders, order);
              const isAdminPremade = isAdminPremadeOrder(order);
              const isAdminManagedCustom = isAdminManagedCustomOrder(order);
              const isAdminManagedCustomUnpaid = isAdminManagedCustomOrderUnpaid(order);
              const packagingOption = packagingById.get(order.packaging_option_id ?? "") ?? null;
              const packagingDescription = formatOrderDescription(order, packagingOption);
              const dueDateDistance = formatDueDateDistance(order.due_date);
              const categoryLabel = isAdminPremade
                ? ADMIN_PREMADE_ORDER_LABEL
                : order.category_id
                  ? categoryLabelById.get(order.category_id) ?? order.category_id
                  : "-";

              return (
                <Fragment key={order.id}>
                  <tr
                    id={`order-${order.id}`}
                    className={`cursor-pointer bg-white hover:bg-zinc-50 ${
                      selectedId === order.id ? "bg-zinc-50" : ""
                    }`}
                    onClick={() => setSelectedId((prev) => (prev === order.id ? null : order.id))}
                  >
                    <td className="px-3 py-2 font-semibold text-zinc-900">
                      <div className="flex items-center gap-2">
                        <span>
                          {order.order_number
                            ? `#${order.order_number}`
                            : order.id
                              ? `#${order.id.slice(0, 8)}`
                              : "-"}
                        </span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setAssignmentModalOrderId(order.id);
                          }}
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition hover:opacity-85 ${statusBadge(
                            scheduleStatus,
                          )}`}
                        >
                          {formatScheduleStatusLabel(scheduleStatus)}
                        </button>
                        {isAdminManagedCustom && order.square_invoice_id ? (
                          <Link
                            href={`/admin/orders/${order.id}/invoice`}
                            onClick={(event) => event.stopPropagation()}
                            className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                          >
                            Invoice
                          </Link>
                        ) : isAdminManagedCustomUnpaid ? (
                          <form
                            action={markOrderAsPaid}
                            className="inline-flex"
                            onSubmit={(event) => {
                              event.stopPropagation();
                              if (!window.confirm("Mark order as paid?")) {
                                event.preventDefault();
                              }
                            }}
                          >
                            <input type="hidden" name="id" value={order.id} />
                            <button
                              type="submit"
                              onClick={(event) => event.stopPropagation()}
                              className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                            >
                              Unpaid
                            </button>
                          </form>
                        ) : null}
                        {isAdminManagedCustom && order.square_invoice_error ? (
                          <span
                            className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700"
                            title={order.square_invoice_error}
                          >
                            Invoice warning
                          </span>
                        ) : null}
                        {isAdminPremade ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Premade stock
                          </span>
                        ) : premadeSiblingMeta ? (
                          <Link
                            href={premadeSiblingMeta.href}
                            onClick={(event) => event.stopPropagation()}
                            className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-700 transition hover:border-fuchsia-300"
                          >
                            Pre-made
                          </Link>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-zinc-800">
                      <OrderTitleWithLogo order={order} title={order.title ?? "Untitled"} />
                    </td>
                    <td className="px-3 py-2 text-zinc-700">
                      {formatDate(order.due_date)}
                      {dueDateDistance ? <span className="ml-2 text-zinc-400">{dueDateDistance}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-zinc-700">
                      <PackagingDescription value={packagingDescription} />
                    </td>
                    <td className="px-3 py-2 text-zinc-700">{weightLabel(order.total_weight_kg)}</td>
                    <td className="px-3 py-2 text-zinc-700">{order.state ?? order.location ?? ""}</td>
                  </tr>
                  {selectedId === order.id ? (
                    <tr className="bg-white">
                      <td colSpan={6} className="px-3 pb-4">
                        <div
                          id={`order-detail-${order.id}`}
                          className="mt-2 rounded-lg border border-zinc-200 bg-white p-4 text-xs text-zinc-700 shadow-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3">
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">Order summary</p>
                              <h3 className="mt-1 truncate text-sm font-semibold text-zinc-900">
                                {order.order_number ? `#${order.order_number}` : order.id.slice(0, 8)} ·{" "}
                                {order.title || categoryLabel}
                              </h3>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <Link
                                href={`/admin/orders/${order.id}`}
                                className="inline-flex items-center rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                              >
                                View details
                              </Link>
                              {printTarget ? (
                                <Link
                                  href={`/admin/orders/${encodeURIComponent(printTarget)}/print?id=${encodeURIComponent(printTarget)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                                >
                                  Print order
                                </Link>
                              ) : null}
                              {order.logo_url ? (
                                <a
                                  href={order.logo_url}
                                  download={logoDownloadNameForOrder(order)}
                                  className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                                >
                                  Download logo
                                </a>
                              ) : null}
                              {canCompleteFromSchedule ? (
                                <SplitAwareActionForm
                                  action={archiveOrderInline}
                                  hiddenFields={[{ name: "order_id", value: order.id }]}
                                  buttonLabel={productionCompletionActionLabel(order)}
                                  buttonClassName="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:border-emerald-300"
                                  confirmMessage={
                                    isAdminPremade
                                      ? "Confirm this premade batch is made? It will move out of the production schedule."
                                      : `Confirm ${order.pickup ? "collection" : "delivery"} for this order? It will move out of the production schedule.`
                                  }
                                  companionMeta={premadeSiblingMeta}
                                />
                              ) : null}
                              <SplitAwareActionForm
                                action={deleteOrderInline}
                                hiddenFields={[{ name: "order_id", value: order.id }]}
                                buttonLabel="Delete order"
                                buttonClassName="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:border-rose-300"
                                confirmMessage="Delete this order permanently? This also removes any production assignments and removes the linked Square invoice if there is one."
                              />
                            </div>
                          </div>

                          <dl className="mt-3 grid gap-x-6 gap-y-2 lg:grid-cols-2 xl:grid-cols-3">
                            <DetailField label="Total">{formatMoney(order.total_price)}</DetailField>
                            <DetailField label="Weight">
                              <span>
                                {weightLabel(order.total_weight_kg) || "-"}
                                {formatBatchBreakdown(order) ? (
                                  <span className="ml-2 font-medium text-zinc-500">{formatBatchBreakdown(order)}</span>
                                ) : null}
                              </span>
                            </DetailField>
                            <DetailField label="Packaging">
                              <PackagingDescription value={packagingDescription} />
                            </DetailField>
                            <DetailField label="Required">{formatDate(order.due_date) || "-"}</DetailField>
                            <DetailField label="Order type">{categoryLabel}</DetailField>
                            <DetailField label="Status">{formatScheduleStatusLabel(scheduleStatus)}</DetailField>
                          </dl>

                          <dl className="mt-3 grid gap-x-6 gap-y-2 border-t border-zinc-100 pt-3 lg:grid-cols-2 xl:grid-cols-3">
                            <DetailField label="Customer">{customerDisplayName(order)}</DetailField>
                            <DetailField label="Email">{order.customer_email || "-"}</DetailField>
                            <DetailField label="Phone">{order.phone || "-"}</DetailField>
                            <DetailField label="Organisation">{order.organization_name || "-"}</DetailField>
                            <DetailField label={isAdminPremade ? "Fulfilment" : order.pickup ? "Pickup" : "Delivery"} className="xl:col-span-2">
                              {isAdminPremade
                                ? "-"
                                : order.pickup
                                  ? "Pickup"
                                  : [order.address_line1, order.address_line2, order.suburb, order.state, order.postcode]
                                      .filter(Boolean)
                                      .join(", ") || "Delivery"}
                            </DetailField>
                          </dl>

                          <dl className="mt-3 grid gap-x-6 gap-y-2 border-t border-zinc-100 pt-3 lg:grid-cols-2 xl:grid-cols-3">
                            <DetailField label="Design" className="xl:col-span-2">{designDisplay(order)}</DetailField>
                            <DetailField label="Flavour">{order.flavor || "-"}</DetailField>
                            <DetailField label="Jacket">{JACKET_LABELS.get(order.jacket ?? "") ?? order.jacket ?? "-"}</DetailField>
                            <DetailField label="Custom labels">
                              {order.labels_count ? `Yes - ${order.labels_count}` : "No"}
                            </DetailField>
                            <DetailField label="Ingredient labels">
                              {order.ingredient_labels_count ? `Yes - ${order.ingredient_labels_count}` : "No"}
                            </DetailField>
                            <DetailField label="Payment">
                              <span>
                                {order.payment_method || order.payment_provider || "-"}
                                {isAdminManagedCustom && order.square_invoice_status ? (
                                  <span className="ml-2 font-medium text-zinc-500">
                                    Square invoice {order.square_invoice_status}
                                  </span>
                                ) : null}
                              </span>
                            </DetailField>
                          </dl>

                          {order.notes || order.customer_note ? (
                            <dl className="mt-3 grid gap-x-6 gap-y-2 border-t border-zinc-100 pt-3 md:grid-cols-2">
                              {order.notes ? (
                                <DetailField label="Production notes">
                                  <span className="whitespace-pre-wrap normal-case">{order.notes}</span>
                                </DetailField>
                              ) : null}
                              {order.customer_note ? (
                                <DetailField label="Customer note">
                                  <span className="whitespace-pre-wrap normal-case">{order.customer_note}</span>
                                </DetailField>
                              ) : null}
                            </dl>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {listOrders.length > 15 ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShowAllOrders((current) => !current)}
            className="rounded border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
          >
            {showAllOrders ? "Show fewer orders" : `Show all ${listOrders.length} orders`}
          </button>
        </div>
      ) : null}

      <ProductionScheduleSection
        orders={orders}
        slots={slots}
        assignments={assignments}
        settings={settings}
        unassignedOrders={unassignedOrders}
        dayNotes={dayNotes}
      />
      {assignmentModalOrder ? (
        <AssignmentCalendarModal
          order={assignmentModalOrder}
          allOrders={orders}
          assignment={assignmentModalAssignment}
          assignments={assignments}
          slots={slots}
          settings={settings}
          onClose={() => setAssignmentModalOrderId(null)}
        />
      ) : null}
    </div>
  );
}
