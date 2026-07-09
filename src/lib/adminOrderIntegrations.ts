import { getPackagingOptions, type OrderRow, type PackagingOption } from "@/lib/data";
import { defaultSquareInvoiceNumber, squareInvoiceNumberWithSuffix } from "@/lib/squareInvoiceNumbers";

export type AdminIntegrationOrder = Pick<
  OrderRow,
  | "id"
  | "order_number"
  | "title"
  | "order_description"
  | "customer_name"
  | "customer_email"
  | "packaging_option_id"
  | "quantity"
  | "jar_lid_color"
  | "first_name"
  | "last_name"
  | "phone"
  | "organization_name"
  | "address_line1"
  | "address_line2"
  | "suburb"
  | "postcode"
  | "state"
  | "pickup"
  | "due_date"
  | "total_price"
  | "total_weight_kg"
  | "admin_batch_weights_kg"
  | "payment_method"
  | "notes"
  | "customer_note"
  | "square_invoice_title"
  | "square_customer_id"
  | "square_invoice_id"
  | "square_invoice_version"
>;

export type AdminInvoiceOrderInput = AdminIntegrationOrder & {
  invoiceOrders?: AdminIntegrationOrder[];
};

type SquareConfig = {
  accessToken: string;
  locationId: string;
  apiBase: string;
  version: string;
  currency: string;
};

type SquareRequestOptions = {
  method?: "DELETE" | "GET" | "POST" | "PUT";
  body?: unknown;
};

class SquareRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors: Array<{ detail?: string; code?: string; field?: string }> = [],
  ) {
    super(message);
    this.name = "SquareRequestError";
  }
}

type SquareCustomer = {
  id: string;
};

type SquareOrder = {
  id: string;
};

type SquareInvoice = {
  id: string;
  version?: number;
  status?: string;
  public_url?: string;
  created_at?: string;
  updated_at?: string;
};

export type AdminSquareInvoicePaymentMode = "card" | "bank_transfer";

export type AdminSquareInvoiceDraftResult = {
  customerId: string;
  squareOrderId: string;
  invoiceId: string;
  invoiceVersion: number | null;
  invoiceStatus: string | null;
  invoiceUrl: string | null;
  invoiceDueDate: string;
  invoiceCreatedAt: string | null;
};

export type AdminSquareInvoiceSendResult = {
  invoiceId: string;
  invoiceVersion: number | null;
  invoiceStatus: string | null;
  invoiceUrl: string | null;
  invoiceSentAt: string | null;
};

export type AdminSquareInvoiceReplacementResult = AdminSquareInvoiceSendResult & {
  customerId: string;
  squareOrderId: string;
  invoiceDueDate: string;
  invoiceCreatedAt: string | null;
};

export type AdminSquareInvoiceRemovalResult = {
  invoiceId: string;
  invoiceVersion: number | null;
  invoiceStatus: string | null;
  action: "canceled" | "deleted" | "skipped";
};

const DEFAULT_COUNTRY = "AU";
const CANCELABLE_INVOICE_STATUSES = new Set(["SCHEDULED", "UNPAID", "PARTIALLY_PAID"]);
const SKIPPABLE_INVOICE_STATUSES = new Set(["CANCELED", "FAILED", "REFUNDED"]);
const BANK_TRANSFER_PAYMENT_METHOD_LABEL = "Square bank transfer invoice";

function moneyToCents(value: number | null | undefined) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Order total is required before creating payment records.");
  }
  return Math.round(amount * 100);
}

function invoiceOrdersFor(order: AdminInvoiceOrderInput) {
  return order.invoiceOrders?.length ? order.invoiceOrders : [order];
}

function splitName(order: AdminIntegrationOrder) {
  const first = order.first_name?.trim();
  const last = order.last_name?.trim();
  if (first || last) {
    return { firstName: first ?? "", lastName: last ?? "" };
  }
  const [fallbackFirst, ...rest] = (order.customer_name ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: fallbackFirst ?? "",
    lastName: rest.join(" "),
  };
}

function buildBilling(order: AdminIntegrationOrder) {
  const { firstName, lastName } = splitName(order);
  return {
    first_name: firstName,
    last_name: lastName,
    email: order.customer_email?.trim() ?? "",
    phone: order.phone?.trim() ?? "",
    address_1: order.pickup ? "" : order.address_line1?.trim() ?? "",
    address_2: order.pickup ? "" : order.address_line2?.trim() ?? "",
    city: order.pickup ? "" : order.suburb?.trim() ?? "",
    state: order.pickup ? "" : order.state?.trim() ?? "",
    postcode: order.pickup ? "" : order.postcode?.trim() ?? "",
    country: DEFAULT_COUNTRY,
  };
}

function orderReference(order: Pick<AdminIntegrationOrder, "id" | "order_number">) {
  return order.order_number ? `#${order.order_number}` : `#${order.id.slice(0, 8)}`;
}

function orderTitle(order: Pick<AdminIntegrationOrder, "title" | "organization_name" | "customer_name">) {
  return order.title?.trim() || order.organization_name?.trim() || order.customer_name?.trim() || "Custom candy order";
}

export function defaultAdminSquareInvoiceTitle(
  order: Pick<AdminIntegrationOrder, "title" | "organization_name" | "customer_name" | "order_number" | "id"> & {
    invoiceOrders?: Array<Pick<AdminIntegrationOrder, "id" | "order_number" | "title" | "organization_name" | "customer_name">>;
  },
) {
  const invoiceOrders = order.invoiceOrders?.length ? order.invoiceOrders : null;
  if (invoiceOrders && invoiceOrders.length > 1) {
    const refs = invoiceOrders.map(orderReference).join(", ");
    const customer = order.organization_name?.trim() || order.customer_name?.trim();
    return `Personalised candy orders ${refs}${customer ? ` - ${customer}` : ""}`.trim();
  }
  return `Personalised ${orderTitle(order)} candy ${orderReference(order)}`.trim();
}

export function squareInvoicePaymentMethodLabel(mode: AdminSquareInvoicePaymentMode) {
  return mode === "bank_transfer" ? BANK_TRANSFER_PAYMENT_METHOD_LABEL : "Square invoice";
}

export function isBankTransferSquareInvoicePaymentMethod(value: string | null | undefined) {
  return value?.trim().toLowerCase() === BANK_TRANSFER_PAYMENT_METHOD_LABEL.toLowerCase();
}

function squareInvoicePaymentModeFromOrder(order: Pick<AdminIntegrationOrder, "payment_method">): AdminSquareInvoicePaymentMode {
  return isBankTransferSquareInvoicePaymentMethod(order.payment_method) ? "bank_transfer" : "card";
}

function acceptedPaymentMethodsForMode(mode: AdminSquareInvoicePaymentMode) {
  return mode === "bank_transfer"
    ? {
        card: false,
        square_gift_card: false,
        bank_account: true,
        buy_now_pay_later: false,
        cash_app_pay: false,
      }
    : {
        card: true,
        square_gift_card: false,
        bank_account: false,
        buy_now_pay_later: false,
        cash_app_pay: false,
      };
}

function formatQuantityForInvoice(quantity: number | null | undefined) {
  const value = Number(quantity);
  if (!Number.isFinite(value) || value <= 0) return "";
  return Number.isInteger(value) ? `${value}` : `${value.toFixed(2).replace(/\.?0+$/, "")}`;
}

function formatInvoicePackageSize(option: PackagingOption) {
  const size = option.size?.trim() ?? "";
  if (!option.type.toLowerCase().includes("jar")) return size;
  return size.replace(/\s*\(?\d+\s*g\)?$/i, "").trim() || size;
}

function formatLidLabel(value: string | null | undefined) {
  const lid = value?.trim();
  if (!lid) return "";
  if (/^#[0-9a-f]{6}$/i.test(lid) || /^[0-9a-f]{6}$/i.test(lid)) return "Custom Lid";
  return `${lid
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")} Lid`;
}

async function invoicePackagingLabel(order: AdminIntegrationOrder) {
  if (order.packaging_option_id) {
    const packagingOptions = await getPackagingOptions();
    const option = packagingOptions.find((item) => item.id === order.packaging_option_id);
    if (option) {
      const type = option.type?.trim() ?? "";
      const size = formatInvoicePackageSize(option);
      const parts = [type, size].filter(Boolean);
      if (type.toLowerCase().includes("jar")) {
        const lidLabel = formatLidLabel(order.jar_lid_color);
        if (lidLabel) parts.push(lidLabel);
      }
      const label = parts.join(" - ").trim();
      if (label) return label;
    }
  }
  return order.order_description?.trim() || order.title?.trim() || "Personalised candy";
}

async function invoiceOrderDescription(order: AdminIntegrationOrder) {
  const quantity = Number(order.quantity);
  const quantityLabel = formatQuantityForInvoice(quantity);
  const packagingLabel = await invoicePackagingLabel(order);
  return `${quantityLabel ? `${quantityLabel} x ` : ""}${packagingLabel}`.trim();
}

async function invoiceDescription(order: AdminInvoiceOrderInput) {
  const invoiceOrders = invoiceOrdersFor(order);
  const orderDescription = await invoiceOrderDescription(order);
  const groupedOrderDescriptions =
    invoiceOrders.length > 1
      ? await Promise.all(
          invoiceOrders.map(async (invoiceOrder) => {
            const description = await invoiceOrderDescription(invoiceOrder);
            return `${orderReference(invoiceOrder)} - ${description || orderTitle(invoiceOrder)}`;
          }),
        )
      : null;
  return [
    order.customer_note?.trim() ?? "",
    groupedOrderDescriptions ? "Thank you for your orders:" : `Thank you for your order: ${orderDescription}`,
    ...(groupedOrderDescriptions ?? []),
    "",
    "For Direct Deposits:",
    "Bsb: 086 006",
    "Account: 476028543",
    "Email receipt to admin@roccandy.com.au",
    "",
    "Please pay prior to pickup or despatch.",
    "Roc Candy Pty Ltd",
    "abn: 61076609035",
  ]
    .filter((line, index, lines) => line || (index > 0 && lines[index - 1]))
    .join("\n");
}

function getSquareConfig(): SquareConfig {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN?.trim();
  const locationId = process.env.SQUARE_LOCATION_ID?.trim();
  if (!accessToken || !locationId) {
    throw new Error("Square is not configured.");
  }
  return {
    accessToken,
    locationId,
    apiBase: process.env.SQUARE_API_BASE?.trim() || "https://connect.squareup.com",
    version: process.env.SQUARE_API_VERSION?.trim() || "2026-05-20",
    currency: process.env.SQUARE_CURRENCY?.trim() || "AUD",
  };
}

async function squareRequest<T>(path: string, options: SquareRequestOptions = {}): Promise<T> {
  const config = getSquareConfig();
  const response = await fetch(`${config.apiBase}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": config.version,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as {
    errors?: Array<{ detail?: string; code?: string; field?: string }>;
  };
  if (!response.ok) {
    const detail = data.errors?.[0]?.detail || data.errors?.[0]?.code || `Square request failed (${response.status}).`;
    throw new SquareRequestError(detail, response.status, data.errors ?? []);
  }
  return data as T;
}

function isSquareInvoiceNumberConflict(error: unknown) {
  if (!(error instanceof Error)) return false;
  const details =
    error instanceof SquareRequestError
      ? error.errors.flatMap((item) => [item.detail, item.code, item.field])
      : [];
  const text = [error.message, ...details].filter(Boolean).join(" ").toLowerCase();
  return text.includes("invoice_number") && (text.includes("unique") || text.includes("duplicate") || text.includes("already"));
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function invoiceDueDate(order: AdminInvoiceOrderInput) {
  const dueDate = invoiceOrdersFor(order)
    .map((invoiceOrder) => invoiceOrder.due_date)
    .filter((value): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value)))
    .sort()[0];
  if (dueDate) {
    const today = formatDateKey(new Date());
    return dueDate < today ? today : dueDate;
  }
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 7);
  return formatDateKey(fallback);
}

function daysUntil(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return 0;
  const target = new Date(year, month - 1, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function paymentReminders(dueDate: string) {
  const reminders: Array<{ relative_scheduled_days: number }> = [{ relative_scheduled_days: 1 }];
  if (daysUntil(dueDate) >= 3) {
    reminders.unshift({ relative_scheduled_days: -3 });
  }
  return reminders;
}

async function createSquareCustomer(order: AdminIntegrationOrder, idempotencySuffix?: string) {
  const { firstName, lastName } = splitName(order);
  const billing = buildBilling(order);
  const body = {
    idempotency_key: `rc-admin-customer-${order.id}${idempotencySuffix ? `-${idempotencySuffix}` : ""}`,
    given_name: firstName || undefined,
    family_name: lastName || undefined,
    company_name: order.organization_name?.trim() || undefined,
    email_address: order.customer_email?.trim() || undefined,
    phone_number: order.phone?.trim() || undefined,
    reference_id: order.id,
    address: billing.address_1
      ? {
          address_line_1: billing.address_1,
          address_line_2: billing.address_2 || undefined,
          locality: billing.city || undefined,
          administrative_district_level_1: billing.state || undefined,
          postal_code: billing.postcode || undefined,
          country: DEFAULT_COUNTRY,
        }
      : undefined,
  };
  const data = await squareRequest<{ customer?: SquareCustomer }>("/v2/customers", {
    method: "POST",
    body,
  });
  if (!data.customer?.id) {
    throw new Error("Square customer creation failed.");
  }
  return data.customer.id;
}

async function updateSquareCustomer(order: AdminIntegrationOrder, customerId: string) {
  const { firstName, lastName } = splitName(order);
  const billing = buildBilling(order);
  await squareRequest<{ customer?: SquareCustomer }>(`/v2/customers/${encodeURIComponent(customerId)}`, {
    method: "PUT",
    body: {
      given_name: firstName || undefined,
      family_name: lastName || undefined,
      company_name: order.organization_name?.trim() || undefined,
      email_address: order.customer_email?.trim() || undefined,
      phone_number: order.phone?.trim() || undefined,
      address: billing.address_1
        ? {
            address_line_1: billing.address_1,
            address_line_2: billing.address_2 || undefined,
            locality: billing.city || undefined,
            administrative_district_level_1: billing.state || undefined,
            postal_code: billing.postcode || undefined,
            country: DEFAULT_COUNTRY,
          }
        : undefined,
    },
  });
}

async function squareLineItemsForOrders(order: AdminInvoiceOrderInput, currency: string) {
  return Promise.all(
    invoiceOrdersFor(order).map(async (invoiceOrder) => {
      const title = `${orderReference(invoiceOrder)} - ${orderTitle(invoiceOrder)}`.trim();
      const description = await invoiceOrderDescription(invoiceOrder);
      return {
        name: title,
        quantity: "1",
        note: description || undefined,
        applied_taxes: [
          {
            tax_uid: "GST",
          },
        ],
        base_price_money: {
          amount: moneyToCents(invoiceOrder.total_price),
          currency,
        },
      };
    }),
  );
}

async function createSquareOrder(order: AdminInvoiceOrderInput, customerId: string, idempotencySuffix?: string) {
  const config = getSquareConfig();
  const lineItems = await squareLineItemsForOrders(order, config.currency);
  const data = await squareRequest<{ order?: SquareOrder }>("/v2/orders", {
    method: "POST",
    body: {
      idempotency_key: `rc-admin-order-${order.id}${idempotencySuffix ? `-${idempotencySuffix}` : ""}`,
      order: {
        location_id: config.locationId,
        customer_id: customerId,
        reference_id: order.order_number ?? order.id,
        source: {
          name: "Roc Candy Admin",
        },
        line_items: lineItems,
        taxes: [
          {
            uid: "GST",
            name: "GST",
            type: "INCLUSIVE",
            percentage: "10",
            scope: "LINE_ITEM",
          },
        ],
      },
    },
  });
  if (!data.order?.id) {
    throw new Error("Square order creation failed.");
  }
  return data.order.id;
}

async function createSquareInvoice(
  order: AdminInvoiceOrderInput,
  customerId: string,
  squareOrderId: string,
  idempotencySuffix?: string,
  paymentMode: AdminSquareInvoicePaymentMode = squareInvoicePaymentModeFromOrder(order),
) {
  const config = getSquareConfig();
  const dueDate = invoiceDueDate(order);
  const invoiceTitle = order.square_invoice_title?.trim() || defaultAdminSquareInvoiceTitle(order);
  const invoiceNumber = defaultSquareInvoiceNumber(order);
  const description = await invoiceDescription(order);
  const idempotencyKey = `rc-admin-invoice-${order.id}${idempotencySuffix ? `-${idempotencySuffix}` : ""}`;
  const createInvoice = (nextInvoiceNumber: string, nextIdempotencyKey: string) =>
    squareRequest<{ invoice?: SquareInvoice }>("/v2/invoices", {
      method: "POST",
      body: {
        idempotency_key: nextIdempotencyKey,
        invoice: {
          location_id: config.locationId,
          order_id: squareOrderId,
          invoice_number: nextInvoiceNumber,
          title: invoiceTitle,
          description,
          primary_recipient: {
            customer_id: customerId,
          },
          delivery_method: "EMAIL",
          accepted_payment_methods: acceptedPaymentMethodsForMode(paymentMode),
          payment_requests: [
            {
              request_type: "BALANCE",
              due_date: dueDate,
              reminders: paymentReminders(dueDate),
            },
          ],
        },
      },
    });
  let data: { invoice?: SquareInvoice };
  try {
    data = await createInvoice(invoiceNumber, idempotencyKey);
  } catch (error) {
    if (!isSquareInvoiceNumberConflict(error)) throw error;
    const fallbackInvoiceNumber = squareInvoiceNumberWithSuffix(invoiceNumber, idempotencySuffix || Date.now().toString(36));
    data = await createInvoice(fallbackInvoiceNumber, `${idempotencyKey}-number-retry`);
  }
  if (!data.invoice?.id) {
    throw new Error("Square invoice draft creation failed.");
  }
  return {
    invoice: data.invoice,
    dueDate,
  };
}

async function clearSquareInvoiceRecipient(orderId: string, invoiceId: string, invoiceVersion: number) {
  const data = await squareRequest<{ invoice?: SquareInvoice }>(`/v2/invoices/${encodeURIComponent(invoiceId)}`, {
    method: "PUT",
    body: {
      idempotency_key: `rc-admin-invoice-recipient-clear-${orderId}-${Date.now()}`,
      invoice: {
        version: invoiceVersion,
        primary_recipient: null,
      },
    },
  });
  if (!data.invoice?.id) {
    throw new Error("Square invoice recipient update failed.");
  }
  const nextVersion = Number(data.invoice.version);
  if (!Number.isFinite(nextVersion) || nextVersion < 0) {
    throw new Error("Square invoice recipient update returned no version.");
  }
  return nextVersion;
}

async function updateSquareInvoiceDraft(
  order: AdminInvoiceOrderInput,
  invoiceId: string,
  invoiceVersion: number,
  paymentMode: AdminSquareInvoicePaymentMode = squareInvoicePaymentModeFromOrder(order),
) {
  const dueDate = invoiceDueDate(order);
  const invoiceTitle = order.square_invoice_title?.trim() || defaultAdminSquareInvoiceTitle(order);
  const invoiceNumber = defaultSquareInvoiceNumber(order);
  const data = await squareRequest<{ invoice?: SquareInvoice }>(`/v2/invoices/${encodeURIComponent(invoiceId)}`, {
    method: "PUT",
    body: {
      idempotency_key: `rc-admin-invoice-update-${order.id}-${Date.now()}`,
      invoice: {
        version: invoiceVersion,
        invoice_number: invoiceNumber,
        title: invoiceTitle,
        description: await invoiceDescription(order),
        delivery_method: "EMAIL",
        accepted_payment_methods: acceptedPaymentMethodsForMode(paymentMode),
        primary_recipient: order.square_customer_id
          ? {
              customer_id: order.square_customer_id,
            }
          : undefined,
      },
    },
  });
  if (!data.invoice?.id) {
    throw new Error("Square invoice update failed.");
  }
  return { invoice: data.invoice, dueDate };
}

async function retrieveSquareInvoice(invoiceId: string) {
  const data = await squareRequest<{ invoice?: SquareInvoice }>(`/v2/invoices/${encodeURIComponent(invoiceId)}`);
  if (!data.invoice?.id) {
    throw new Error("Square invoice lookup failed.");
  }
  return data.invoice;
}

async function deleteSquareInvoice(invoiceId: string, invoiceVersion: number) {
  await squareRequest<Record<string, never>>(
    `/v2/invoices/${encodeURIComponent(invoiceId)}?version=${encodeURIComponent(String(invoiceVersion))}`,
    {
      method: "DELETE",
    },
  );
}

async function cancelSquareInvoice(invoiceId: string, invoiceVersion: number, orderId: string, idempotencySuffix?: string) {
  const data = await squareRequest<{ invoice?: SquareInvoice }>(
    `/v2/invoices/${encodeURIComponent(invoiceId)}/cancel`,
    {
      method: "POST",
      body: {
        invoice: {
          version: invoiceVersion,
        },
        idempotency_key: `rc-admin-invoice-cancel-${orderId}${idempotencySuffix ? `-${idempotencySuffix}` : ""}`,
      },
    },
  );
  if (!data.invoice?.id) {
    throw new Error("Square invoice cancellation failed.");
  }
  return data.invoice;
}

async function publishSquareInvoice(invoiceId: string, invoiceVersion: number, orderId: string, idempotencySuffix?: string) {
  const data = await squareRequest<{ invoice?: SquareInvoice }>(
    `/v2/invoices/${encodeURIComponent(invoiceId)}/publish`,
    {
      method: "POST",
      body: {
        version: invoiceVersion,
        idempotency_key: `rc-admin-invoice-publish-${orderId}${idempotencySuffix ? `-${idempotencySuffix}` : ""}`,
      },
    },
  );
  if (!data.invoice?.id) {
    throw new Error("Square invoice publish failed.");
  }
  return data.invoice;
}

export async function createAdminSquareInvoiceDraft(
  order: AdminInvoiceOrderInput,
  options: { idempotencySuffix?: string; paymentMode?: AdminSquareInvoicePaymentMode } = {},
): Promise<AdminSquareInvoiceDraftResult> {
  const customerId = order.square_customer_id || (await createSquareCustomer(order, options.idempotencySuffix));
  if (order.square_customer_id) {
    await updateSquareCustomer(order, order.square_customer_id);
  }
  const squareOrderId = await createSquareOrder(order, customerId, options.idempotencySuffix);
  const paymentMode = options.paymentMode ?? squareInvoicePaymentModeFromOrder(order);
  const { invoice, dueDate } = await createSquareInvoice(
    order,
    customerId,
    squareOrderId,
    options.idempotencySuffix,
    paymentMode,
  );
  return {
    customerId,
    squareOrderId,
    invoiceId: invoice.id,
    invoiceVersion: Number.isFinite(Number(invoice.version)) ? Number(invoice.version) : null,
    invoiceStatus: invoice.status ?? null,
    invoiceUrl: invoice.public_url ?? null,
    invoiceDueDate: dueDate,
    invoiceCreatedAt: invoice.created_at ?? new Date().toISOString(),
  };
}

export async function removeAdminSquareInvoice(
  order: Pick<AdminIntegrationOrder, "id" | "square_invoice_id" | "square_invoice_version">,
  options: { idempotencySuffix?: string } = {},
): Promise<AdminSquareInvoiceRemovalResult | null> {
  if (!order.square_invoice_id) return null;
  const invoice = await retrieveSquareInvoice(order.square_invoice_id);
  const invoiceVersion = Number(invoice.version ?? order.square_invoice_version);
  if (!Number.isFinite(invoiceVersion) || invoiceVersion < 0) {
    throw new Error("Square invoice version could not be retrieved.");
  }
  const status = invoice.status?.toUpperCase() ?? "";

  if (status === "DRAFT") {
    await deleteSquareInvoice(order.square_invoice_id, invoiceVersion);
    return {
      invoiceId: order.square_invoice_id,
      invoiceVersion,
      invoiceStatus: status,
      action: "deleted",
    };
  }

  if (CANCELABLE_INVOICE_STATUSES.has(status)) {
    const canceled = await cancelSquareInvoice(
      order.square_invoice_id,
      invoiceVersion,
      order.id,
      options.idempotencySuffix,
    );
    return {
      invoiceId: canceled.id,
      invoiceVersion: Number.isFinite(Number(canceled.version)) ? Number(canceled.version) : invoiceVersion,
      invoiceStatus: canceled.status ?? "CANCELED",
      action: "canceled",
    };
  }

  if (SKIPPABLE_INVOICE_STATUSES.has(status)) {
    return {
      invoiceId: order.square_invoice_id,
      invoiceVersion,
      invoiceStatus: status,
      action: "skipped",
    };
  }

  throw new Error(`Square invoice cannot be removed while it is ${status || "in its current state"}.`);
}

export async function createAndPublishAdminSquareInvoice(
  order: AdminInvoiceOrderInput,
  options: { idempotencySuffix?: string; paymentMode?: AdminSquareInvoicePaymentMode } = {},
): Promise<AdminSquareInvoiceReplacementResult> {
  const customerId = order.square_customer_id || (await createSquareCustomer(order, options.idempotencySuffix));
  if (order.square_customer_id) {
    await updateSquareCustomer(order, order.square_customer_id);
  }
  const squareOrderId = await createSquareOrder(order, customerId, options.idempotencySuffix);
  const paymentMode = options.paymentMode ?? squareInvoicePaymentModeFromOrder(order);
  const { invoice, dueDate } = await createSquareInvoice(
    order,
    customerId,
    squareOrderId,
    options.idempotencySuffix,
    paymentMode,
  );
  const invoiceVersion = Number(invoice.version);
  if (!Number.isFinite(invoiceVersion) || invoiceVersion < 0) {
    throw new Error("Square invoice version could not be retrieved.");
  }
  const published = await publishSquareInvoice(invoice.id, invoiceVersion, order.id, options.idempotencySuffix);
  return {
    customerId,
    squareOrderId,
    invoiceId: published.id,
    invoiceVersion: Number.isFinite(Number(published.version)) ? Number(published.version) : invoiceVersion,
    invoiceStatus: published.status ?? null,
    invoiceUrl: published.public_url ?? invoice.public_url ?? null,
    invoiceDueDate: dueDate,
    invoiceCreatedAt: invoice.created_at ?? new Date().toISOString(),
    invoiceSentAt: published.updated_at ?? new Date().toISOString(),
  };
}

export async function updateAndPublishAdminSquareInvoice(
  order: AdminInvoiceOrderInput,
  options: { paymentMode?: AdminSquareInvoicePaymentMode } = {},
): Promise<AdminSquareInvoiceSendResult> {
  if (!order.square_invoice_id) {
    throw new Error("Square invoice draft is missing.");
  }
  let invoiceVersion = Number(order.square_invoice_version);
  if (!Number.isFinite(invoiceVersion) || invoiceVersion < 0) {
    const squareInvoice = await retrieveSquareInvoice(order.square_invoice_id);
    invoiceVersion = Number(squareInvoice.version);
    if (!Number.isFinite(invoiceVersion) || invoiceVersion < 0) {
      throw new Error("Square invoice version could not be retrieved.");
    }
  }
  if (order.square_customer_id) {
    await updateSquareCustomer(order, order.square_customer_id);
  }
  const versionAfterRecipientClear = order.square_customer_id
    ? await clearSquareInvoiceRecipient(order.id, order.square_invoice_id, invoiceVersion)
    : invoiceVersion;
  const { invoice: updated } = await updateSquareInvoiceDraft(
    order,
    order.square_invoice_id,
    versionAfterRecipientClear,
    options.paymentMode ?? squareInvoicePaymentModeFromOrder(order),
  );
  const updatedVersion = Number(updated.version);
  if (!Number.isFinite(updatedVersion) || updatedVersion < 0) {
    throw new Error("Square invoice update returned no version.");
  }
  const published = await publishSquareInvoice(order.square_invoice_id, updatedVersion, order.id);
  return {
    invoiceId: published.id,
    invoiceVersion: Number.isFinite(Number(published.version)) ? Number(published.version) : updatedVersion,
    invoiceStatus: published.status ?? null,
    invoiceUrl: published.public_url ?? null,
    invoiceSentAt: published.updated_at ?? new Date().toISOString(),
  };
}
