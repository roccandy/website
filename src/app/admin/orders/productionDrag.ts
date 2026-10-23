import type { OrderRow, OrderSlot, ProductionSlot } from "@/lib/data";
import { orderWorkflow } from "./orderWorkflow";

export const PRODUCTION_ORDER_DRAG_TYPE =
  "application/x-roccandy-production-order";
export type OrderDropPlan =
  | { kind: "assign"; kg: number }
  | { kind: "move"; assignment: OrderSlot }
  | { kind: "choose"; assignments: OrderSlot[] };
export function orderDropPlan(
  order: OrderRow,
  assignments: OrderSlot[],
  slots: ProductionSlot[],
  today: string,
): OrderDropPlan | null {
  const state = orderWorkflow(order, assignments, slots, today);
  if (
    state.closed ||
    state.hasRefund ||
    state.premade ||
    state.recordedMade ||
    ["failed", "test", "draft", "pending_payment"].includes(order.status)
  )
    return null;
  if (state.canDrag) return { kind: "assign", kg: state.nextKg };
  const slotMap = new Map(slots.map((slot) => [slot.id, slot]));
  const movable = state.own.filter(
    (assignment) => (slotMap.get(assignment.slot_id)?.slot_date ?? "") >= today,
  );
  if (movable.length === 1) return { kind: "move", assignment: movable[0] };
  if (movable.length > 1) return { kind: "choose", assignments: movable };
  return null;
}
