"use client";

import { AdminSubmitButton } from "@/components/AdminSubmitButton";
import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { productionColumnWidths } from "./productionColumnWidths";
import { useAdminViewState } from "../useAdminViewState";
import { AdminLink as Link } from "@/app/admin/AdminNavigationFeedback";
import { AlertTriangle } from "lucide-react";
import { compactKg, requiredDateUrgency } from "./productionRowPresentation";
import { productionPaymentStripRowSpans } from "./orderPaymentGroups";
import { OrderPaymentStrips } from "./OrderPaymentStrips";
import { orderSource } from "./orderSource";
import { orderDropPlan, PRODUCTION_ORDER_DRAG_TYPE } from "./productionDrag";
import type {
  Category,
  OrderRow,
  OrderSlot,
  PackagingOption,
  ProductionDayNote,
  ProductionSlot,
  SettingsRow,
} from "@/lib/data";
import { archiveOrderInline, markOrderAsPaid } from "./actions";
import { ADMIN_PREMADE_CATEGORY_ID, ADMIN_PREMADE_ORDER_LABEL, isAdminPremadeOrder } from "@/lib/adminPremadeOrder";
import { adminOrderRemakeHref } from "@/lib/adminOrderRemake";
import OrderTitleWithLogo from "./OrderTitleWithLogo";
import ProductionScheduleSection from "./ProductionScheduleSection";
import AssignmentCalendarModal from "./AssignmentCalendarModal";
import SplitAwareActionForm from "./SplitAwareActionForm";
import {
  canCompleteOrderForSlotDates,
  formatBatchBreakdown,
  formatDate,
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
  dateKey,
} from "./productionScheduleShared";
import {
  isAdminManagedCustomOrder,
  isAdminManagedCustomOrderUnpaid,
  isVisibleOnProductionScheduleWithAssignments,
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
  canWrite: boolean;
};

const JACKET_LABELS = new Map([
  ["", "Single colour"],
  ["two_colour", "Two colour"],
  ["pinstripe", "Pin stripe"],
  ["two_colour_pinstripe", "Two colour + pin stripe"],
  ["rainbow", "Rainbow"],
]);

const getProductionControlsHost = () => document.getElementById("admin-production-view-controls");
const subscribeToProductionControlsHost = (listener: () => void) => {
  if (getProductionControlsHost()) return () => {};
  const observer = new MutationObserver(() => {
    if (getProductionControlsHost()) {
      listener();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
};


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
  canWrite,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [assignmentModalOrderId, setAssignmentModalOrderId] = useState<string | null>(null);
  const [workspaceView, setWorkspaceView] = useAdminViewState<"both" | "calendar" | "orders">("production-view", "both", (value) => ["both", "calendar", "orders"].includes(value));
  const [draggingOrderId, setDraggingOrderId] = useState<string | null>(null);
  const orderListRef = useRef<HTMLDivElement>(null);
  const [orderListWidth, setOrderListWidth] = useState(464);
  const productionControlsHost = useSyncExternalStore(
    subscribeToProductionControlsHost,
    getProductionControlsHost,
    () => null,
  );

  useEffect(() => {
    const element = orderListRef.current;
    if (!element) return;
    const measure = () => {
      if (element.clientWidth > 0) setOrderListWidth(element.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const columnWidths = productionColumnWidths(orderListWidth);

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
  const slotMap = useMemo(() => new Map(slots.map((slot) => [slot.id, slot])), [slots]);
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
  const scheduleTodayKey = dateKey(new Date());
  const listOrders = useMemo(() => {
    const visible = orders.filter((order) =>
      isVisibleOnProductionScheduleWithAssignments(order, assignedSlotDatesByOrderId.get(order.id) ?? [], scheduleTodayKey),
    );
    return [...visible].sort((a, b) => {
      const aDate = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
      const bDate = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
      if (aDate !== bDate) return aDate - bDate;
      return (a.order_number ?? a.id ?? "").localeCompare(b.order_number ?? b.id ?? "");
    });
  }, [assignedSlotDatesByOrderId, orders, scheduleTodayKey]);
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
  const unassignedOrders = useMemo(
    () =>
      listOrders.filter((order) => {
        const orderAssignments = assignmentsByOrderId.get(order.id) ?? [];
        return nextAssignableKgForOrder(order, orderAssignments) > 0;
      }),
    [assignmentsByOrderId, listOrders],
  );
  const visibleListOrders = listOrders;
  const paymentSpans = productionPaymentStripRowSpans(visibleListOrders, selectedId);
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
      const orderList = orderListRef.current;
      const orderListRect = orderList?.getBoundingClientRect();
      const listMargin = 16;

      // In the split workspace, the order list has its own scroll area. Keep
      // an expanded row visible there rather than moving the whole page (and
      // therefore the calendar) to reveal it.
      if (orderList && orderListRect && orderList.scrollHeight > orderList.clientHeight) {
        if (rect.top < orderListRect.top + listMargin) {
          orderList.scrollBy({
            top: rect.top - orderListRect.top - listMargin,
            behavior: "smooth",
          });
        } else if (rect.bottom > orderListRect.bottom - listMargin) {
          orderList.scrollBy({
            top: rect.bottom - orderListRect.bottom + listMargin,
            behavior: "smooth",
          });
        }
        return;
      }

      const viewportHeight = window.innerHeight;
      const margin = 16;
      const topInset = (document.querySelector(".admin-workspace-header")?.getBoundingClientRect().height ?? 0) + margin;

      if (rect.height + topInset + margin >= viewportHeight || rect.top < topInset) {
        window.scrollTo({
          top: window.scrollY + rect.top - topInset,
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
  }, [selectedId, workspaceView]);

  const selectOrderFromCalendar = (orderId: string) => {
    setWorkspaceView("both");
    setSelectedId(orderId);
  };

  const productionViewControl = (
    <div aria-label="Production workspace view" className="inline-flex gap-1 rounded-lg border border-zinc-200 bg-white p-1">
      {([ ["both", "Both panels"], ["calendar", "Calendar only"], ["orders", "Order list"] ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={workspaceView === value} onClick={() => setWorkspaceView(value)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${workspaceView === value ? "bg-emerald-800 text-white" : "text-zinc-500 hover:bg-zinc-50"}`}>{label}</button>)}
    </div>
  );

  return (
    <div className="admin-production-workspace space-y-4">
      {productionControlsHost ? createPortal(productionViewControl, productionControlsHost) : null}
      <div className="admin-production-panels" data-view={workspaceView}>
      <div hidden={workspaceView === "calendar"} className="admin-production-order-panel min-w-0 space-y-4">
        <div ref={orderListRef} className="admin-production-order-list overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="admin-production-orders-table w-full min-w-[29rem] table-fixed text-[13px]">
          <colgroup>{columnWidths.map((width, index) => <col key={index} style={{ width }}/>)}</colgroup>
          <thead className="bg-zinc-50 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            <tr>
              <th className="whitespace-nowrap px-2 py-3 text-left">Order #</th>
              <th className="px-2 py-3 text-left">Title</th>
              <th className="px-2 py-3 text-left">Date required</th>
              <th className="px-2 py-3 text-left">Packaging</th>
              <th className="px-2 py-3 text-left">kg</th>
              <th className="px-2 py-3 text-left">State</th>
              <th className="w-3 p-0"><span className="sr-only">Payment and order source</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {visibleListOrders.map((order, orderIndex) => {
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
              const urgency = requiredDateUrgency(order.due_date, scheduleTodayKey);
              const paymentSpan = paymentSpans[orderIndex];
              const categoryLabel = isAdminPremade
                ? ADMIN_PREMADE_ORDER_LABEL
                : order.category_id
                  ? categoryLabelById.get(order.category_id) ?? order.category_id
                  : "-";
              const dragPlan = canWrite ? orderDropPlan(order, assignments, slots, scheduleTodayKey) : null;
              const source = orderSource(order);

              return (
                <Fragment key={order.id}>
                  <tr
                    id={`order-${order.id}`}
                    draggable={Boolean(dragPlan)}
                    data-order-source={source.key}
                    onMouseDown={(event) => { if (dragPlan && event.button === 0) window.getSelection()?.removeAllRanges(); }}
                    onDragStart={(event) => {
                      if (!dragPlan) { event.preventDefault(); return; }
                      event.dataTransfer.setData(PRODUCTION_ORDER_DRAG_TYPE, order.id);
                      event.dataTransfer.setData("text/plain", order.order_number || order.title || "Order");
                      event.dataTransfer.effectAllowed = "move";
                      setDraggingOrderId(order.id);
                    }}
                    onDragEnd={() => setDraggingOrderId(null)}
                    className={`admin-production-order-row bg-white hover:bg-zinc-50 ${dragPlan ? "select-none cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${
                      selectedId === order.id ? "bg-zinc-50" : ""
                    }`}
                    onClick={() => setSelectedId((prev) => (prev === order.id ? null : order.id))}
                  >
                    <td className="px-2 py-2 font-semibold text-zinc-900">
                      <div className="flex flex-col items-start gap-1">
                        <span className="whitespace-nowrap">
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
                        {isAdminManagedCustom && order.square_invoice_error ? (
                          <span title="Invoice warning — open the invoice to review"><AlertTriangle size={12} className="text-rose-600" aria-label="Invoice warning" /></span>
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
                    <td className="min-w-0 break-words px-2 py-2 text-zinc-800">
                      <OrderTitleWithLogo order={order} title={order.title ?? "Untitled"} />
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-zinc-700">
                      <span className="block">{formatDate(order.due_date)}</span>
                      {urgency ? <span className={`mt-0.5 block text-xs ${urgency.tone}`}>{urgency.label}</span> : null}
                    </td>
                    <td className="break-words px-2 py-2 text-zinc-700">
                      <PackagingDescription value={packagingDescription} />
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-zinc-700" title={formatBatchBreakdown(order) || `${order.total_weight_kg ?? "Unknown"} kg`}>{compactKg(order)}</td>
                    <td className="truncate px-2 py-2 text-xs text-zinc-700" title={order.state ?? order.location ?? ""}>{order.state ?? order.location ?? ""}</td>
                    {paymentSpan ? <td rowSpan={paymentSpan.rowSpan} data-payment-row-span={paymentSpan.rowSpan} className="relative w-3 min-w-3 p-0" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => {
                      // A shared invoice strip is a link, not an individual
                      // order drag handle. Keep dragging on each order's cells.
                      if (paymentSpan.rowSpan > 1) {
                        event.preventDefault();
                        event.stopPropagation();
                        event.currentTarget.querySelector("a")?.focus();
                      }
                    }}><OrderPaymentStrips orders={paymentSpan.orders}/></td> : null}
                  </tr>
                  {selectedId === order.id ? (
                    <tr className="bg-white">
                      <td colSpan={7} className="px-3 pb-4">
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
                              {canWrite && isAdminManagedCustomUnpaid && !order.square_invoice_id ? <form action={markOrderAsPaid} onSubmit={event=>{if(!window.confirm("Confirm payment has been independently verified. This records payment; it does not charge the customer."))event.preventDefault();}}><input type="hidden" name="id" value={order.id}/><AdminSubmitButton type="submit" className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800">Record payment received</AdminSubmitButton></form> : null}
                              <Link
                                href={`/admin/orders/${order.id}`}
                                className="inline-flex items-center rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                              >
                                View details
                              </Link>
                              {!isAdminPremade ? (
                                <Link
                                  href={adminOrderRemakeHref(order.id)}
                                  onClick={(event) => event.stopPropagation()}
                                  className="inline-flex items-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:border-sky-300"
                                >
                                  Re-make
                                </Link>
                              ) : null}
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
                              <button
                                type="button"
                                onClick={() => setAssignmentModalOrderId(order.id)}
                                className="inline-flex items-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:border-sky-300"
                              >
                                {(assignmentsByOrderId.get(order.id)?.length ?? 0) > 0 ? "Unassign" : "Assign"}
                              </button>
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

      </div>

      <div hidden={workspaceView === "orders"} className="min-w-0">
        <ProductionScheduleSection
          orders={orders}
          slots={slots}
          assignments={assignments}
          settings={settings}
          unassignedOrders={unassignedOrders}
          dayNotes={dayNotes}
          canWrite={canWrite}
          draggingOrderId={draggingOrderId}
          onOrderDragEnd={() => setDraggingOrderId(null)}
          onOrderSelect={selectOrderFromCalendar}
        />
      </div>
      </div>
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
