export const OPEN_CART_DRAWER_EVENT = "roccandy:open-cart-drawer";

export function requestCartDrawerOpen() {
  window.dispatchEvent(new Event(OPEN_CART_DRAWER_EVENT));
}
