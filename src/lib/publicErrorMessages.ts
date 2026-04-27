const GENERIC_PRICING_ERROR =
  "We couldn't calculate the latest price right now. Please refresh the page and try again.";

const GENERIC_CHECKOUT_ERROR =
  "We couldn't start checkout just now. Please refresh the page and try again.";

const GENERIC_PAYMENT_ERROR =
  "We couldn't process your payment just now. Please try again or use another payment method.";

function normalizeMessage(message?: string | null) {
  return (message ?? "").trim().toLowerCase();
}

function includesAny(message: string, values: string[]) {
  return values.some((value) => message.includes(value));
}

export function toPublicPricingError(message?: string | null) {
  const normalized = normalizeMessage(message);
  if (!normalized) return GENERIC_PRICING_ERROR;

  if (normalized.includes("too many")) {
    return "Too many requests were made just now. Please wait a moment and try again.";
  }

  if (normalized.includes("invalid payload")) {
    return "We couldn't calculate this price. Please refresh the page and try again.";
  }

  if (
    includesAny(normalized, [
      "invalid category",
      "invalid packaging option",
      "packaging not allowed for this category",
    ])
  ) {
    return "That candy or packaging option is no longer available. Please refresh the page and choose again.";
  }

  if (normalized.includes("packaging quantity out of range")) {
    return "That packaging quantity is unavailable. Please adjust it and try again.";
  }

  if (includesAny(normalized, ["total weight exceeds limit", "no pricing tier matches weight"])) {
    return "This combination is too large for one order. Please reduce the quantity or split it into multiple orders.";
  }

  if (
    includesAny(normalized, ["label count exceeds maximum", "label count exceeds supported ranges"])
  ) {
    return "The selected label quantity is too high for this order. Please reduce it and try again.";
  }

  if (normalized.includes("ingredient label count exceeds maximum")) {
    return "The selected ingredient label quantity is too high for this order. Please reduce it and try again.";
  }

  return GENERIC_PRICING_ERROR;
}

export function toPublicCheckoutError(message?: string | null) {
  const normalized = normalizeMessage(message);
  if (!normalized) return GENERIC_CHECKOUT_ERROR;

  if (normalized.includes("organisation name is required")) {
    return "Please enter your organisation name for this branded order.";
  }

  if (
    includesAny(normalized, [
      "customer details are required",
      "first name is required",
      "last name is required",
      "email address is required",
      "phone number is required",
    ])
  ) {
    return "Please complete your customer details before continuing.";
  }

  if (normalized.includes("cart is empty")) {
    return "Your cart is empty.";
  }

  if (normalized.includes("requested date is required")) {
    return "Please choose a required date before continuing.";
  }

  if (normalized.includes("selected date is unavailable")) {
    return "That requested date is no longer available. Please choose another date.";
  }

  if (normalized.includes("delivery address is incomplete")) {
    return "Please complete the delivery address before continuing.";
  }

  if (
    includesAny(normalized, [
      "custom item is missing category or packaging",
      "custom item pricing failed",
      "unable to update pricing",
    ])
  ) {
    return "One or more custom items need to be refreshed. Please review your cart and try again.";
  }

  if (
    includesAny(normalized, [
      "premade item not found",
      "not synced to woo",
      "one or more items in your cart are no longer available",
    ])
  ) {
    return "One or more items in your cart are no longer available. Please review your cart and try again.";
  }

  if (normalized.includes("invalid order total")) {
    return "We couldn't confirm your order total. Please refresh the page and try again.";
  }

  if (
    includesAny(normalized, [
      "max total kg is",
      "max total kg per settings is",
      "total weight exceeds limit",
    ])
  ) {
    return "One of the items in your cart is too large for one checkout. Please reduce the quantity or split it into multiple orders.";
  }

  if (normalized.includes("ingredient label count exceeds maximum")) {
    return "The selected ingredient label quantity is too high for this order. Please reduce it and try again.";
  }

  if (
    includesAny(normalized, [
      "woo custom product id is not configured",
      "woo sync is not configured",
      "woo payment url missing",
      "unable to create woo order",
      "unable to create paid woo order",
      "order payload is required",
      "payment details are required",
    ])
  ) {
    return GENERIC_CHECKOUT_ERROR;
  }

  return GENERIC_CHECKOUT_ERROR;
}

export function toPublicPaymentError(message?: string | null) {
  const normalized = normalizeMessage(message);
  if (!normalized) return GENERIC_PAYMENT_ERROR;

  if (normalized.includes("too many payment attempts")) {
    return "Too many payment attempts were made. Please wait a few minutes and try again.";
  }

  if (
    includesAny(normalized, [
      "declined",
      "insufficient funds",
      "insufficient_funds",
      "do not honor",
    ])
  ) {
    return "Your payment was declined. Please check your details or use another payment method.";
  }

  if (normalized.includes("expired")) {
    return "Your payment method appears to be expired. Please check your details or use another payment method.";
  }

  if (
    includesAny(normalized, [
      "supabase order insert failed",
      "finalising the order record",
      "finalizing the order record",
      "trouble finalising the order record",
      "trouble finalizing the order record",
      "order record could not be saved",
      "couldn't save the order record",
      "could not save the order record",
      "unable to save the order record",
    ])
  ) {
    return "Your payment was received, but we couldn't save the order record. Please keep your order number and contact us if you do not receive a confirmation email shortly.";
  }

  if (
    includesAny(normalized, [
      "unable to create woo order",
      "unable to create paid woo order",
      "could not create woo order",
      "could not create paid woo order",
    ])
  ) {
    return "We couldn't finish creating the order after payment was taken. Please try again or contact us with your order number.";
  }

  if (
    includesAny(normalized, [
      "cvv",
      "security code",
      "postal",
      "postcode",
      "zip",
      "verification",
      "avs",
    ])
  ) {
    return "Please check your payment details and try again.";
  }

  if (
    includesAny(normalized, [
      "square is not configured",
      "paypal is not configured",
      "missing paypal_client_id",
      "missing paypal_secret",
      "unable to authenticate with paypal",
    ])
  ) {
    return "This payment method is temporarily unavailable. Please choose another payment option or contact us.";
  }

  if (
    includesAny(normalized, [
      "failed to load http",
      "failed to load https",
      "sdk not available",
      "setup failed",
      "payment token failed",
    ])
  ) {
    return "We couldn't load the secure payment form. Please refresh the page and try again.";
  }

  if (
    includesAny(normalized, [
      "unable to create paypal order",
      "unable to capture paypal order",
      "unable to start paypal",
      "paypal order missing",
    ])
  ) {
    return "We couldn't connect to PayPal just now. Please try again or choose another payment method.";
  }

  if (
    includesAny(normalized, [
      "square payment failed",
      "payment failed",
      "unable to process square payment",
      "paypal failed",
    ])
  ) {
    return "We couldn't process your payment because the payment provider returned an error. Please try again or use another payment method.";
  }

  const checkoutMessage = toPublicCheckoutError(message);
  if (checkoutMessage !== GENERIC_CHECKOUT_ERROR) {
    return checkoutMessage;
  }

  return GENERIC_PAYMENT_ERROR;
}
