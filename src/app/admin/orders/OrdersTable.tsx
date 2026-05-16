"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ColorPaletteRow,
  Category,
  Flavor,
  OrderRow,
  OrderSlot,
  PackagingOption,
  ProductionSlot,
  SettingsRow,
} from "@/lib/data";
import type { PricingBreakdown } from "@/lib/pricing";
import { archiveOrderInline, markOrderAsPaid, upsertOrder } from "./actions";
import { ADMIN_PREMADE_CATEGORY_ID, ADMIN_PREMADE_ORDER_LABEL, isAdminPremadeOrder } from "@/lib/adminPremadeOrder";
import OrderColorField, { type OrderColorFieldProps } from "./OrderColorField";
import ProductionScheduleSection from "./ProductionScheduleSection";
import AssignmentCalendarModal from "./AssignmentCalendarModal";
import SplitAwareActionForm from "./SplitAwareActionForm";
import {
  buildColorOptions,
  buildPaletteOptions,
  formatColorInput,
  formatSizeLabel,
  isCustomPaletteValue,
  normalizeHex,
  selectValueForColor,
  type ColorFormat,
} from "./orderColorUtils";
import {
  canCompleteOrderForSlotDate,
  formatDate,
  formatDateInput,
  formatMoney,
  formatOrderDescription,
  formatQuantity,
  formatScheduleStatusLabel,
  getScheduleStatus,
  getPremadeSiblingMeta,
  productionCompletionActionLabel,
  splitCustomerName,
  statusBadge,
  weightLabel,
} from "./productionScheduleShared";
import { isAdminManagedCustomOrderUnpaid, isVisibleOnProductionSchedule } from "./scheduleVisibility";

type Props = {
  orders: OrderRow[];
  slots: ProductionSlot[];
  assignments: OrderSlot[];
  settings: SettingsRow;
  packagingOptions: PackagingOption[];
  categories: Category[];
  pricingBreakdowns: Record<string, PricingBreakdown | null>;
  flavors: Flavor[];
  palette: ColorPaletteRow[];
  initialSelectedId?: string | null;
};

const JACKET_OPTIONS = [
  { value: "", label: "Single colour" },
  { value: "two_colour", label: "Two colour" },
  { value: "pinstripe", label: "Pin stripe" },
  { value: "two_colour_pinstripe", label: "Two colour + Pin stripe" },
  { value: "rainbow", label: "Rainbow" },
];
const WEDDING_HEART = "❤️";
const normalizeWeddingHeartText = (value: string | null | undefined) =>
  (value ?? "").replace(/\s*[♥❤]\s*/g, ` ${WEDDING_HEART} `).replace(/\s+/g, " ").trim();
const isPartiallyRefundedOrder = (order: OrderRow) =>
  order.status === "partially-refunded" || order.woo_order_status === "partially-refunded";
const refundBadgeLabel = (order: OrderRow) => (isPartiallyRefundedOrder(order) ? "Partially refunded" : "Refunded");

export function OrdersTable({
  orders,
  slots,
  assignments,
  settings,
  packagingOptions,
  categories,
  pricingBreakdowns,
  flavors,
  palette,
  initialSelectedId = null,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [pickupMode, setPickupMode] = useState<"on" | "off">("off");
  const [jacketMode, setJacketMode] = useState<string>("");
  const [textColorValue, setTextColorValue] = useState("");
  const [heartColorValue, setHeartColorValue] = useState("");
  const [jacketColorOneValue, setJacketColorOneValue] = useState("");
  const [jacketColorTwoValue, setJacketColorTwoValue] = useState("");
  const [jarLidColorValue, setJarLidColorValue] = useState("");
  const [orderCategoryId, setOrderCategoryId] = useState("");
  const [packagingType, setPackagingType] = useState("");
  const [packagingSize, setPackagingSize] = useState("");
  const [quantityInput, setQuantityInput] = useState("");
  const [designTextInput, setDesignTextInput] = useState("");
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [assignmentModalOrderId, setAssignmentModalOrderId] = useState<string | null>(null);
  const [textColorCustom, setTextColorCustom] = useState(false);
  const [heartColorCustom, setHeartColorCustom] = useState(false);
  const [jacketColorOneCustom, setJacketColorOneCustom] = useState(false);
  const [jacketColorTwoCustom, setJacketColorTwoCustom] = useState(false);
  const [textColorFormat, setTextColorFormat] = useState<ColorFormat>("hex");
  const [heartColorFormat, setHeartColorFormat] = useState<ColorFormat>("hex");
  const [jacketColorOneFormat, setJacketColorOneFormat] = useState<ColorFormat>("hex");
  const [jacketColorTwoFormat, setJacketColorTwoFormat] = useState<ColorFormat>("hex");
  const [textColorInput, setTextColorInput] = useState("");
  const [heartColorInput, setHeartColorInput] = useState("");
  const [jacketColorOneInput, setJacketColorOneInput] = useState("");
  const [jacketColorTwoInput, setJacketColorTwoInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editKey, setEditKey] = useState(0);
  const designTextInputRef = useRef<HTMLInputElement | null>(null);
  const selected = useMemo(() => orders.find((o) => o.id === selectedId) ?? null, [orders, selectedId]);
  const showJacketColorTwo = jacketMode === "two_colour" || jacketMode === "two_colour_pinstripe";
  const colorOptions = useMemo(() => buildPaletteOptions(palette), [palette]);
  const packagingById = useMemo(() => new Map(packagingOptions.map((option) => [option.id, option])), [packagingOptions]);
  const paletteHexSet = useMemo(() => new Set(colorOptions.map((option) => option.value)), [colorOptions]);

  const syncEditableState = useCallback((order: OrderRow | null) => {
    if (!order) return;
    setPickupMode(order.pickup ? "on" : "off");
    setJacketMode(order.jacket ?? "");
    const nextTextColor = order.text_color ? normalizeHex(order.text_color) : "";
    const nextHeartColor = order.heart_color ? normalizeHex(order.heart_color) : "";
    const nextJacketColorOne = order.jacket_color_one ? normalizeHex(order.jacket_color_one) : "";
    const nextJacketColorTwo = order.jacket_color_two ? normalizeHex(order.jacket_color_two) : "";
    const nextJarLidColor = order.jar_lid_color ? normalizeHex(order.jar_lid_color) : "";
    const nextCategoryId = isAdminPremadeOrder(order) ? ADMIN_PREMADE_CATEGORY_ID : order.category_id ?? "";
    const nextPackagingOption = order.packaging_option_id ? packagingById.get(order.packaging_option_id) ?? null : null;
    setOrderCategoryId(nextCategoryId);
    setPackagingType(nextPackagingOption?.type ?? "");
    setPackagingSize(nextPackagingOption?.size ?? "");
    setQuantityInput(order.quantity ? String(order.quantity) : "");
    setDesignTextInput(
      nextCategoryId.startsWith("weddings")
        ? normalizeWeddingHeartText(order.design_text)
        : (order.design_text ?? ""),
    );
    setTextColorValue(nextTextColor);
    setHeartColorValue(nextHeartColor);
    setJacketColorOneValue(nextJacketColorOne);
    setJacketColorTwoValue(nextJacketColorTwo);
    setJarLidColorValue(nextJarLidColor);
    setTextColorCustom(isCustomPaletteValue(nextTextColor, paletteHexSet));
    setHeartColorCustom(isCustomPaletteValue(nextHeartColor, paletteHexSet));
    setJacketColorOneCustom(isCustomPaletteValue(nextJacketColorOne, paletteHexSet));
    setJacketColorTwoCustom(isCustomPaletteValue(nextJacketColorTwo, paletteHexSet));
    setTextColorFormat("hex");
    setHeartColorFormat("hex");
    setJacketColorOneFormat("hex");
    setJacketColorTwoFormat("hex");
    setTextColorInput(formatColorInput(nextTextColor, "hex"));
    setHeartColorInput(formatColorInput(nextHeartColor, "hex"));
    setJacketColorOneInput(formatColorInput(nextJacketColorOne, "hex"));
    setJacketColorTwoInput(formatColorInput(nextJacketColorTwo, "hex"));
  }, [packagingById, paletteHexSet]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (!selected) {
        setIsEditing(false);
        return;
      }
      syncEditableState(selected);
      setIsEditing(false);
      setEditKey((prev) => prev + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [selected, syncEditableState]);

  useEffect(() => {
    if (!selectedId) return;
    const frame = window.requestAnimationFrame(() => {
      const target =
        document.getElementById(`order-detail-${selectedId}`) ?? document.getElementById(`order-${selectedId}`);
      target?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedId]);

  useEffect(() => {
    if (!showJacketColorTwo) {
      queueMicrotask(() => {
        setJacketColorTwoValue("");
        setJacketColorTwoInput("");
        setJacketColorTwoFormat("hex");
        setJacketColorTwoCustom(false);
      });
    }
  }, [showJacketColorTwo]);
  const categoryOptions = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );
  const categoryLabelById = useMemo(
    () => new Map([...categories.map((category) => [category.id, category.name] as const), [ADMIN_PREMADE_CATEGORY_ID, ADMIN_PREMADE_ORDER_LABEL] as const]),
    [categories]
  );
  const jacketLabelByValue = useMemo(
    () => new Map(JACKET_OPTIONS.map((option) => [option.value, option.label])),
    []
  );
  const orderCategoryOptions = useMemo(() => {
    if (!orderCategoryId) return categoryOptions;
    if (categoryOptions.some((option) => option.id === orderCategoryId)) return categoryOptions;
    if (orderCategoryId === ADMIN_PREMADE_CATEGORY_ID) {
      return [{ id: ADMIN_PREMADE_CATEGORY_ID, name: ADMIN_PREMADE_ORDER_LABEL }, ...categoryOptions];
    }
    return [{ id: orderCategoryId, name: orderCategoryId }, ...categoryOptions];
  }, [categoryOptions, orderCategoryId]);
  const filteredPackagingOptions = useMemo(() => {
    if (!orderCategoryId) return [];
    return packagingOptions.filter((option) => option.allowed_categories?.includes(orderCategoryId));
  }, [orderCategoryId, packagingOptions]);
  const packagingTypes = useMemo(() => {
    const unique = new Set<string>();
    filteredPackagingOptions.forEach((option) => {
      if (option.type) unique.add(option.type);
    });
    return Array.from(unique);
  }, [filteredPackagingOptions]);
  useEffect(() => {
    queueMicrotask(() => {
      if (!orderCategoryId) {
        if (packagingType) setPackagingType("");
        if (packagingSize) setPackagingSize("");
        return;
      }
      if (packagingTypes.length === 0) {
        if (packagingType) setPackagingType("");
        if (packagingSize) setPackagingSize("");
        return;
      }
      if (!packagingType || !packagingTypes.includes(packagingType)) {
        setPackagingType(packagingTypes[0]);
        setPackagingSize("");
      }
    });
  }, [orderCategoryId, packagingTypes, packagingType, packagingSize]);
  const sizesForType = useMemo(() => {
    if (!packagingType) return [];
    const extractLeadingNumber = (value: string) => {
      const match = value.trim().match(/^(\d+)/);
      return match ? Number(match[1]) : null;
    };
    return filteredPackagingOptions
      .filter((option) => option.type === packagingType)
      .map((opt, index) => ({ opt, index }))
      .sort((a, b) => {
        const aNum = extractLeadingNumber(a.opt.size);
        const bNum = extractLeadingNumber(b.opt.size);
        if (aNum !== null && bNum !== null) {
          return aNum - bNum;
        }
        if (aNum !== null) return -1;
        if (bNum !== null) return 1;
        return a.index - b.index;
      })
      .map(({ opt }) => opt);
  }, [filteredPackagingOptions, packagingType]);
  useEffect(() => {
    queueMicrotask(() => {
      if (!packagingType) {
        if (packagingSize) setPackagingSize("");
        return;
      }
      if (sizesForType.length === 0) {
        if (packagingSize) setPackagingSize("");
        return;
      }
      if (!packagingSize || !sizesForType.some((option) => option.size === packagingSize)) {
        setPackagingSize(sizesForType[0].size);
      }
    });
  }, [packagingType, packagingSize, sizesForType]);
  const selectedPackagingOptionId = useMemo(() => {
    const found = sizesForType.find((option) => option.size === packagingSize);
    return found?.id ?? "";
  }, [sizesForType, packagingSize]);
  const selectedPackagingOption = useMemo(() => {
    if (!selectedPackagingOptionId) return null;
    return packagingOptions.find((option) => option.id === selectedPackagingOptionId) ?? null;
  }, [packagingOptions, selectedPackagingOptionId]);
  const isJarOption = useMemo(
    () => (selectedPackagingOption?.type ?? "").toLowerCase().includes("jar"),
    [selectedPackagingOption]
  );
  const availableLidColors = useMemo(
    () => (selectedPackagingOption?.lid_colors ?? []).filter(Boolean),
    [selectedPackagingOption]
  );
  const maxPackages = selectedPackagingOption?.max_packages ?? null;
  useEffect(() => {
    if (!selectedPackagingOption?.max_packages) return;
    const parsed = Number(quantityInput);
    if (!Number.isFinite(parsed)) return;
    const max = Number(selectedPackagingOption.max_packages);
    if (!Number.isFinite(max)) return;
    if (parsed <= max) return;
    queueMicrotask(() => {
      setQuantityInput(String(max));
    });
  }, [quantityInput, selectedPackagingOption?.max_packages]);
  useEffect(() => {
    queueMicrotask(() => {
      if (!isJarOption || availableLidColors.length === 0) {
        if (jarLidColorValue) setJarLidColorValue("");
        return;
      }
      if (!availableLidColors.includes(jarLidColorValue)) {
        setJarLidColorValue(availableLidColors[0]);
      }
    });
  }, [availableLidColors, isJarOption, jarLidColorValue]);
  const listOrders = useMemo(() => {
    const visible = orders.filter(isVisibleOnProductionSchedule);
    return [...visible].sort((a, b) => {
      const aDate = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
      const bDate = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
      if (aDate !== bDate) return aDate - bDate;
      return (a.order_number ?? a.id ?? "").localeCompare(b.order_number ?? b.id ?? "");
    });
  }, [orders]);
  const slotMap = useMemo(() => new Map(slots.map((s) => [s.id, s])), [slots]);
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
    () => listOrders.filter((order) => (assignmentsByOrderId.get(order.id) ?? []).length === 0),
    [assignmentsByOrderId, listOrders]
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
  const renderColorField = (props: Omit<OrderColorFieldProps, "isEditing">) => (
    <OrderColorField {...props} isEditing={isEditing} />
  );
  const insertWeddingHeart = useCallback(() => {
    const input = designTextInputRef.current;
    const heart = WEDDING_HEART;
    if (!input) {
      setDesignTextInput((current) => `${current}${current ? " " : ""}${heart}`);
      return;
    }

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const nextValue = `${designTextInput.slice(0, start)}${heart}${designTextInput.slice(end)}`;
    setDesignTextInput(nextValue);

    queueMicrotask(() => {
      input.focus();
      input.setSelectionRange(start + heart.length, start + heart.length);
    });
  }, [designTextInput]);

  return (
    <div className="space-y-4">
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              <tr>
                <th className="px-3 py-3 text-left">Order #</th>
                <th className="px-3 py-3 text-left">Title</th>
                <th className="px-3 py-3 text-left">Date required</th>
                <th className="px-3 py-3 text-left">Order description</th>
                <th className="px-3 py-3 text-left">Order weight</th>
                <th className="px-3 py-3 text-left">Pickup</th>
                <th className="px-3 py-3 text-left">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {visibleListOrders.map((order) => {
                const printTarget = order.id ?? order.order_number;
                const assignedSlotDate = assignmentByOrderId.get(order.id)?.slot?.slot_date ?? null;
                const scheduleStatus = getScheduleStatus(order, assignedSlotDate);
                const canCompleteFromSchedule = canCompleteOrderForSlotDate(order, assignedSlotDate);
                const premadeSiblingMeta = getPremadeSiblingMeta(orders, order);
                const isAdminPremade = isAdminPremadeOrder(order);
                const isAdminManagedCustomUnpaid = isAdminManagedCustomOrderUnpaid(order);
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
                              scheduleStatus
                            )}`}
                          >
                            {formatScheduleStatusLabel(scheduleStatus)}
                          </button>
                          {isAdminManagedCustomUnpaid ? (
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
                          {isAdminPremade ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Premade stock
                            </span>
                          ) : premadeSiblingMeta ? (
                            <a
                              href={premadeSiblingMeta.href}
                              onClick={(event) => event.stopPropagation()}
                              className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-700 transition hover:border-fuchsia-300"
                            >
                              Pre-made
                            </a>
                          ) : null}
                          {order.refunded_at ? (
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                              {refundBadgeLabel(order)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-zinc-800">{order.title ?? "Untitled"}</td>
                      <td className="px-3 py-2 text-zinc-700">{formatDate(order.due_date)}</td>
                      <td className="px-3 py-2 text-zinc-700">
                        {formatOrderDescription(order, packagingById.get(order.packaging_option_id ?? "") ?? null)}
                      </td>
                      <td className="px-3 py-2 text-zinc-700">{weightLabel(order.total_weight_kg)}</td>
                      <td className="px-3 py-2 text-zinc-700">{order.pickup ? "Pickup" : "Delivery"}</td>
                      <td className="px-3 py-2 text-zinc-700">{order.state ?? order.location ?? ""}</td>
                    </tr>
                    {selectedId === order.id && (
                      <tr className="bg-white">
                        <td colSpan={7} className="px-3 pb-4">
                          <div
                            id={`order-detail-${order.id}`}
                            className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700"
                          >
                            {(() => {
                              const nameFallback = splitCustomerName(order.customer_name);
                              const firstNameValue = (order.first_name ?? nameFallback.first).trim();
                              const lastNameValue = (order.last_name ?? nameFallback.last).trim();
                              const isDelivery = pickupMode === "off";
                              const pricing = pricingBreakdowns[order.id] ?? null;
                              const totalPrice = formatMoney(order.total_price ?? pricing?.total ?? null);
                              const weightG = Number.isFinite(Number(order.total_weight_kg ?? NaN))
                                ? Math.round(Number(order.total_weight_kg) * 1000)
                                : "";
                              const activeCategoryId =
                                orderCategoryId || (isAdminPremadeOrder(order) ? ADMIN_PREMADE_CATEGORY_ID : order.category_id || "");
                              const isWedding = activeCategoryId.startsWith("weddings");
                              const isBranded = activeCategoryId === "branded";
                              const textColorOptions = buildColorOptions(colorOptions, textColorValue);
                              const heartColorOptions = buildColorOptions(colorOptions, heartColorValue);
                              const jacketColorOneOptions = buildColorOptions(colorOptions, jacketColorOneValue);
                              const jacketColorTwoOptions = buildColorOptions(colorOptions, jacketColorTwoValue);
                              const textColorSelectValue = textColorCustom ? "custom" : selectValueForColor(textColorValue);
                              const heartColorSelectValue = heartColorCustom ? "custom" : selectValueForColor(heartColorValue);
                              const jacketColorOneSelectValue = jacketColorOneCustom
                                ? "custom"
                                : selectValueForColor(jacketColorOneValue);
                              const jacketColorTwoSelectValue = jacketColorTwoCustom
                                ? "custom"
                                : selectValueForColor(jacketColorTwoValue);
                              const flavorOptions =
                                order.flavor && !flavors.some((item) => item.name === order.flavor)
                                  ? [order.flavor, ...flavors.map((item) => item.name)]
                                  : flavors.map((item) => item.name);
                              const detailSectionLabelClass = isEditing
                                ? "text-xs uppercase tracking-[0.2em] text-zinc-500"
                                : "text-sm text-zinc-500 capitalize";
                              const detailLabelClass = isEditing
                                ? "block text-[11px] uppercase tracking-[0.18em] text-zinc-400"
                                : "block text-sm text-zinc-500 capitalize";
                              const detailMetaClass = isEditing
                                ? "text-[11px] uppercase tracking-[0.18em] text-zinc-400"
                                : "text-sm text-zinc-500 capitalize";
                              const detailValueClass = "mt-1 text-sm font-semibold text-zinc-900 capitalize";
                              const detailBodyValueClass = "text-sm font-semibold text-zinc-900 capitalize";

                              return (
                                <form key={`${order.id}-${editKey}`} action={upsertOrder} className="space-y-4">
                                  <input type="hidden" name="id" value={order.id} />
                                  <input type="hidden" name="status" value={order.status ?? "pending"} />
                                  <input type="hidden" name="redirect_to" value="/admin/orders" />
                                  <input type="hidden" name="toast_success" value="Order updated." />
                                  <input type="hidden" name="toast_error" value="Failed to update order." />
                                  <fieldset disabled={!isEditing} className="space-y-4">
                                  <div className="grid gap-6 md:grid-cols-3">
                                    <div className="space-y-3">
                                      <p className={detailSectionLabelClass}>Customer details</p>
                                      <div className="space-y-2">
                                        <label className={detailLabelClass}>
                                          Delivery / Pickup
                                          {isEditing ? (
                                            <select
                                              name="pickup"
                                              value={pickupMode}
                                              onChange={(event) =>
                                                setPickupMode(event.target.value === "on" ? "on" : "off")
                                              }
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                            >
                                              <option value="off">Delivery</option>
                                              <option value="on">Pickup</option>
                                            </select>
                                          ) : (
                                            <p className={detailValueClass}>
                                              {pickupMode === "on" ? "Pickup" : "Delivery"}
                                            </p>
                                          )}
                                        </label>
                                        <div className="grid gap-2 md:grid-cols-2">
                                          <label className={detailLabelClass}>
                                            First name
                                            {isEditing ? (
                                              <input
                                                name="first_name"
                                                defaultValue={firstNameValue}
                                                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                              />
                                            ) : (
                                              <p className={detailValueClass}>{firstNameValue || "-"}</p>
                                            )}
                                          </label>
                                          <label className={detailLabelClass}>
                                            Last name
                                            {isEditing ? (
                                              <input
                                                name="last_name"
                                                defaultValue={lastNameValue}
                                                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                              />
                                            ) : (
                                              <p className={detailValueClass}>{lastNameValue || "-"}</p>
                                            )}
                                          </label>
                                        </div>
                                        <label className={detailLabelClass}>
                                          Email
                                          {isEditing ? (
                                            <input
                                              type="email"
                                              name="customer_email"
                                              defaultValue={order.customer_email ?? ""}
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                            />
                                          ) : (
                                            <p className={detailValueClass}>{order.customer_email ?? "-"}</p>
                                          )}
                                        </label>
                                        <label className={detailLabelClass}>
                                          Phone
                                          {isEditing ? (
                                            <input
                                              type="tel"
                                              name="phone"
                                              defaultValue={order.phone ?? ""}
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                            />
                                          ) : (
                                            <p className={detailValueClass}>{order.phone ?? "-"}</p>
                                          )}
                                        </label>
                                        <div>
                                          <p className={detailMetaClass}>Address</p>
                                          {isDelivery ? (
                                            isEditing ? (
                                              <div className="mt-1 space-y-2">
                                                <input
                                                  name="address_line1"
                                                  defaultValue={order.address_line1 ?? ""}
                                                  className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                                  placeholder="Address line 1"
                                                />
                                                <input
                                                  name="address_line2"
                                                  defaultValue={order.address_line2 ?? ""}
                                                  className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                                  placeholder="Address line 2"
                                                />
                                                <div className="grid gap-2 md:grid-cols-3">
                                                  <input
                                                    name="suburb"
                                                    defaultValue={order.suburb ?? ""}
                                                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                                    placeholder="Suburb"
                                                  />
                                                  <input
                                                    name="state"
                                                    defaultValue={order.state ?? ""}
                                                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                                    placeholder="State"
                                                  />
                                                  <input
                                                    name="postcode"
                                                    defaultValue={order.postcode ?? ""}
                                                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                                    placeholder="Postcode"
                                                  />
                                                </div>
                                              </div>
                                            ) : (
                                              <div className={`mt-1 space-y-1 ${detailBodyValueClass}`}>
                                                <p>{order.address_line1?.trim() || "-"}</p>
                                                {order.address_line2?.trim() ? <p>{order.address_line2.trim()}</p> : null}
                                                <p>
                                                  {[order.suburb, order.state, order.postcode].filter(Boolean).join(" ") ||
                                                    "-"}
                                                </p>
                                              </div>
                                            )
                                          ) : (
                                            <>
                                              <p className={detailValueClass}>Pickup</p>
                                              <input type="hidden" name="address_line1" value="" />
                                              <input type="hidden" name="address_line2" value="" />
                                              <input type="hidden" name="suburb" value="" />
                                              <input type="hidden" name="state" value="" />
                                              <input type="hidden" name="postcode" value="" />
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="space-y-3">
                                      <p className={detailSectionLabelClass}>Order details</p>
                                      <div className="space-y-2">
                                        <div>
                                          <p className={detailMetaClass}>Order #</p>
                                          <p className={detailValueClass}>
                                            {order.order_number
                                              ? `#${order.order_number}`
                                              : order.id
                                                ? `#${order.id.slice(0, 8)}`
                                                : "-"}
                                          </p>
                                        </div>
                                        <label className={detailLabelClass}>
                                          Date required
                                          {isEditing ? (
                                            <input
                                              type="date"
                                              name="due_date"
                                              defaultValue={formatDateInput(order.due_date)}
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                            />
                                          ) : (
                                            <p className={detailValueClass}>{formatDate(order.due_date) || "-"}</p>
                                          )}
                                        </label>
                                        <div>
                                          <p className={detailMetaClass}>
                                            Date ordered
                                          </p>
                                          <p className={detailValueClass}>
                                            {formatDate(order.created_at) || "-"}
                                          </p>
                                        </div>
                                        <label className={detailLabelClass}>
                                          Order weight (g)
                                          {isEditing ? (
                                            <input
                                              type="number"
                                              name="order_weight_g"
                                              min={1}
                                              required
                                              defaultValue={weightG}
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                            />
                                          ) : (
                                            <p className={detailValueClass}>{weightG ? `${weightG}` : "-"}</p>
                                          )}
                                        </label>
                                        <label className={detailLabelClass}>
                                          Flavour
                                          {isEditing ? (
                                            <select
                                              name="flavor"
                                              defaultValue={order.flavor ?? ""}
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                            >
                                              <option value="">Select flavour</option>
                                              {flavorOptions.map((name) => (
                                                <option key={name} value={name}>
                                                  {name}
                                                </option>
                                              ))}
                                            </select>
                                          ) : (
                                            <p className={detailValueClass}>{order.flavor ?? "-"}</p>
                                          )}
                                        </label>
                                      </div>
                                      <div className="space-y-2">
                                        <p className={detailMetaClass}>
                                          Colours & info
                                        </p>
                                        <label className={detailLabelClass}>
                                          Text / design
                                          {isEditing ? (
                                            <div className="mt-1 flex items-center gap-2">
                                              <input
                                                ref={designTextInputRef}
                                                name="design_text"
                                                value={designTextInput}
                                                onChange={(event) => setDesignTextInput(event.target.value)}
                                                className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                              />
                                              {isWedding ? (
                                                <button
                                                  type="button"
                                                  onClick={insertWeddingHeart}
                                                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-base font-semibold text-rose-700 hover:border-rose-300"
                                                  aria-label="Insert heart"
                                                  title="Insert heart"
                                                >
                                                  {WEDDING_HEART}
                                                </button>
                                              ) : null}
                                            </div>
                                          ) : (
                                            <p className={detailValueClass}>{order.design_text ?? "-"}</p>
                                          )}
                                        </label>
                                        <label className={detailLabelClass}>
                                          Jacket
                                          {isEditing ? (
                                            <select
                                              name="jacket"
                                              value={jacketMode}
                                              onChange={(event) => setJacketMode(event.target.value)}
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                            >
                                              {JACKET_OPTIONS.map((option) => (
                                                <option key={option.value || "none"} value={option.value}>
                                                  {option.label}
                                                </option>
                                              ))}
                                            </select>
                                          ) : (
                                            <p className={detailValueClass}>
                                              {jacketLabelByValue.get(jacketMode) ?? jacketMode ?? "-"}
                                            </p>
                                          )}
                                        </label>
                                        <div className="grid gap-2 md:grid-cols-2">
                                          {renderColorField({
                                            label: "Jacket colour 1",
                                            name: "jacket_color_one",
                                            value: jacketColorOneValue,
                                            selectValue: jacketColorOneSelectValue,
                                            options: jacketColorOneOptions,
                                            inputValue: jacketColorOneInput,
                                            format: jacketColorOneFormat,
                                            isCustom: jacketColorOneCustom,
                                            setValue: setJacketColorOneValue,
                                            setInputValue: setJacketColorOneInput,
                                            setFormat: setJacketColorOneFormat,
                                            setIsCustom: setJacketColorOneCustom,
                                          })}
                                          {showJacketColorTwo && (
                                            renderColorField({
                                              label: "Jacket colour 2",
                                              name: "jacket_color_two",
                                              value: jacketColorTwoValue,
                                              selectValue: jacketColorTwoSelectValue,
                                              options: jacketColorTwoOptions,
                                              inputValue: jacketColorTwoInput,
                                              format: jacketColorTwoFormat,
                                              isCustom: jacketColorTwoCustom,
                                              setValue: setJacketColorTwoValue,
                                              setInputValue: setJacketColorTwoInput,
                                              setFormat: setJacketColorTwoFormat,
                                              setIsCustom: setJacketColorTwoCustom,
                                            })
                                          )}
                                        </div>
                                        {!showJacketColorTwo && (
                                          <input type="hidden" name="jacket_color_two" value="" />
                                        )}
                                        {!isBranded && (
                                          renderColorField({
                                            label: "Text colour",
                                            name: "text_color",
                                            value: textColorValue,
                                            selectValue: textColorSelectValue,
                                            options: textColorOptions,
                                            inputValue: textColorInput,
                                            format: textColorFormat,
                                            isCustom: textColorCustom,
                                            setValue: setTextColorValue,
                                            setInputValue: setTextColorInput,
                                            setFormat: setTextColorFormat,
                                            setIsCustom: setTextColorCustom,
                                          })
                                        )}
                                        {isWedding && (
                                          renderColorField({
                                            label: "Heart colour",
                                            name: "heart_color",
                                            value: heartColorValue,
                                            selectValue: heartColorSelectValue,
                                            options: heartColorOptions,
                                            inputValue: heartColorInput,
                                            format: heartColorFormat,
                                            isCustom: heartColorCustom,
                                            setValue: setHeartColorValue,
                                            setInputValue: setHeartColorInput,
                                            setFormat: setHeartColorFormat,
                                            setIsCustom: setHeartColorCustom,
                                          })
                                        )}
                                        <input type="hidden" name="order_description" value={order.order_description ?? ""} />
                                      </div>
                                    </div>

                                    <div className="space-y-3">
                                      <p className={detailSectionLabelClass}>Packaging info</p>
                                      <div className="space-y-2">
                                        <label className={detailLabelClass}>
                                          Order type
                                          {isEditing ? (
                                            <select
                                              name="category_id"
                                              value={orderCategoryId}
                                              onChange={(event) => setOrderCategoryId(event.target.value)}
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                            >
                                              <option value="">Select order type</option>
                                              {orderCategoryOptions.map((category) => (
                                                <option key={category.id} value={category.id}>
                                                  {category.name}
                                                </option>
                                              ))}
                                            </select>
                                          ) : (
                                            <p className={detailValueClass}>
                                              {orderCategoryId
                                                ? categoryLabelById.get(orderCategoryId) ?? orderCategoryId
                                                : "-"}
                                            </p>
                                          )}
                                        </label>
                                        <label className={detailLabelClass}>
                                          Packaging type
                                          {isEditing ? (
                                            <select
                                              value={packagingType}
                                              onChange={(event) => setPackagingType(event.target.value)}
                                              disabled={!orderCategoryId || packagingTypes.length === 0}
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                            >
                                              <option value="">
                                                {!orderCategoryId
                                                  ? "Select order type first"
                                                  : packagingTypes.length
                                                    ? "Select packaging type"
                                                    : "No packaging types"}
                                              </option>
                                              {packagingTypes.map((type) => (
                                                <option key={type} value={type}>
                                                  {type}
                                                </option>
                                              ))}
                                            </select>
                                          ) : (
                                            <p className={detailValueClass}>{packagingType || "-"}</p>
                                          )}
                                        </label>
                                        <label className={detailLabelClass}>
                                          Packaging size
                                          {isEditing ? (
                                            <select
                                              value={packagingSize}
                                              onChange={(event) => setPackagingSize(event.target.value)}
                                              disabled={!packagingType || sizesForType.length === 0}
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                            >
                                              <option value="">
                                                {!packagingType
                                                  ? "Select packaging type first"
                                                  : sizesForType.length
                                                    ? "Select size"
                                                    : "No sizes"}
                                              </option>
                                              {sizesForType.map((option) => (
                                                <option key={option.id} value={option.size}>
                                                  {formatSizeLabel(option.type, option.size)}
                                                </option>
                                              ))}
                                            </select>
                                          ) : (
                                            <p className={detailValueClass}>
                                              {packagingSize ? formatSizeLabel(packagingType, packagingSize) : "-"}
                                            </p>
                                          )}
                                        </label>
                                        <input type="hidden" name="packaging_option_id" value={selectedPackagingOptionId} />
                                        <label className={detailLabelClass}>
                                          Quantity
                                          {isEditing ? (
                                            <input
                                              type="number"
                                              name="quantity"
                                              min={1}
                                              max={Number.isFinite(maxPackages ?? NaN) ? Number(maxPackages) : undefined}
                                              value={quantityInput}
                                              onChange={(event) => setQuantityInput(event.target.value)}
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                            />
                                          ) : (
                                            <p className={detailValueClass}>
                                              {formatQuantity(Number(quantityInput) || order.quantity) || "-"}
                                            </p>
                                          )}
                                          {isEditing && Number.isFinite(maxPackages ?? NaN) && Number(maxPackages) > 0 ? (
                                            <p className="mt-1 text-[10px] font-semibold text-zinc-500">
                                              Max {Number(maxPackages)}
                                            </p>
                                          ) : null}
                                        </label>
                                        {isJarOption ? (
                                          <label className={detailLabelClass}>
                                            Lid colour
                                            {isEditing ? (
                                              <select
                                                name="jar_lid_color"
                                                value={jarLidColorValue}
                                                onChange={(event) => setJarLidColorValue(event.target.value)}
                                                disabled={availableLidColors.length === 0}
                                                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                              >
                                                <option value="">
                                                  {availableLidColors.length ? "Select lid colour" : "No lid options"}
                                                </option>
                                                {availableLidColors.map((lid) => (
                                                  <option key={lid} value={lid}>
                                                    {lid}
                                                  </option>
                                                ))}
                                              </select>
                                            ) : (
                                              <p className={detailValueClass}>{jarLidColorValue || "-"}</p>
                                            )}
                                          </label>
                                        ) : (
                                          <input type="hidden" name="jar_lid_color" value="" />
                                        )}
                                      </div>
                                      <div className="space-y-2">
                                        <p className={detailSectionLabelClass}>Pricing details</p>
                                        <div>
                                          <p className={detailMetaClass}>
                                            Payment method
                                          </p>
                                          <p className={detailValueClass}>{order.payment_method ?? "-"}</p>
                                        </div>
                                        {pricing ? (
                                          <div className="space-y-1 text-xs text-zinc-600">
                                            {pricing.items.map((item) => (
                                              <div key={item.label} className="flex items-center justify-between">
                                                <span>{item.label}</span>
                                                <span>{formatMoney(item.amount)}</span>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-xs text-zinc-500">Pricing breakdown unavailable.</p>
                                        )}
                                        <div className="flex items-center justify-between text-sm font-semibold text-zinc-900">
                                          <span>Total</span>
                                          <span>{totalPrice}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {order.notes && (
                                    <div>
                                      <p className={detailSectionLabelClass}>Notes</p>
                                      <p className={detailBodyValueClass}>{order.notes}</p>
                                    </div>
                                  )}
                                  </fieldset>
                                  <div className="flex flex-wrap items-center gap-2">
                                    {isEditing ? (
                                      <>
                                        <button
                                          type="submit"
                                          className="inline-flex items-center rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                                        >
                                          Save changes
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            syncEditableState(order);
                                            setIsEditing(false);
                                            setEditKey((prev) => prev + 1);
                                          }}
                                          className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                                        >
                                          Cancel
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          syncEditableState(order);
                                          setIsEditing(true);
                                          setEditKey((prev) => prev + 1);
                                        }}
                                        className="inline-flex items-center rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                                      >
                                        Edit
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setAssignmentModalOrderId(order.id)}
                                      className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:border-blue-300"
                                    >
                                      {assignedSlotDate ? "Change assignment" : "Assign"}
                                    </button>
                                    {printTarget ? (
                                      <a
                                        href={`/admin/orders/${encodeURIComponent(printTarget)}/print?id=${encodeURIComponent(printTarget)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                                      >
                                        Print order
                                      </a>
                                    ) : (
                                      <span className="text-xs text-zinc-500">Print unavailable</span>
                                    )}
                                    {isAdminManagedCustomUnpaid ? (
                                      <button
                                        type="submit"
                                        formNoValidate
                                        formAction={markOrderAsPaid}
                                        className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:border-emerald-300"
                                      >
                                        Mark as Paid
                                      </button>
                                    ) : null}
                                    {canCompleteFromSchedule ? (
                                      <SplitAwareActionForm
                                        action={archiveOrderInline}
                                        hiddenFields={[{ name: "order_id", value: order.id }]}
                                        buttonLabel={productionCompletionActionLabel(order)}
                                        buttonClassName="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:border-emerald-300"
                                        confirmMessage={`Confirm ${order.pickup ? "collection" : "delivery"} for this order? It will move out of the production schedule.`}
                                        companionMeta={premadeSiblingMeta}
                                      />
                                    ) : null}
                                  </div>
                                </form>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    )}
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
