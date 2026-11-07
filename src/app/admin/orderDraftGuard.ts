export type OrderDraftGuard = { save: () => Promise<boolean>; discard: () => Promise<boolean>; state: () => string };
export const orderDraftGuards = new WeakMap<HTMLFormElement, OrderDraftGuard>();
