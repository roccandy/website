type PayPalAccessTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type PayPalOrderResponse = {
  id: string;
};

export type PayPalOrderDetails = {
  id: string;
  status: string;
  payer?: {
    name?: {
      given_name?: string;
      surname?: string;
    };
    email_address?: string;
  };
  purchase_units?: Array<{
    amount?: {
      currency_code?: string;
      value?: string;
    };
    shipping?: {
      name?: {
        full_name?: string;
      };
      address?: {
        address_line_1?: string;
        address_line_2?: string;
        admin_area_2?: string;
        admin_area_1?: string;
        postal_code?: string;
        country_code?: string;
      };
    };
  }>;
};

type PayPalCaptureResponse = {
  id: string;
  status: string;
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{ id: string; status: string }>;
    };
  }>;
};

function getPayPalApiBase() {
  const explicit = process.env.PAYPAL_API_BASE?.trim();
  if (explicit) return explicit;
  const env = (process.env.PAYPAL_ENV ?? process.env.NEXT_PUBLIC_PAYPAL_ENV ?? "production").toLowerCase();
  return env === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
}

function getPayPalCredentials() {
  const clientId =
    process.env.PAYPAL_CLIENT_ID?.trim() || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim();
  const secret = process.env.PAYPAL_SECRET?.trim();
  if (!clientId && !secret) {
    throw new Error("PayPal is not configured (missing PAYPAL_CLIENT_ID and PAYPAL_SECRET).");
  }
  if (!clientId) {
    throw new Error("PayPal is not configured (missing PAYPAL_CLIENT_ID).");
  }
  if (!secret) {
    throw new Error("PayPal is not configured (missing PAYPAL_SECRET).");
  }
  return { clientId, secret };
}

export async function getPayPalAccessToken(): Promise<string> {
  const { clientId, secret } = getPayPalCredentials();
  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const response = await fetch(`${getPayPalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = (await response.json().catch(() => ({}))) as PayPalAccessTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error("Unable to authenticate with PayPal.");
  }
  return data.access_token;
}

export async function createPayPalOrder(
  totalAmount: number,
  currency = "AUD",
  meta?: { customId?: string; description?: string }
) {
  const token = await getPayPalAccessToken();
  const response = await fetch(`${getPayPalApiBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      payment_source: {
        paypal: {
          experience_context: {
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
          },
        },
      },
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: totalAmount.toFixed(2),
          },
          custom_id: meta?.customId,
          description: meta?.description,
        },
      ],
    }),
  });
  const data = (await response.json().catch(() => ({}))) as PayPalOrderResponse;
  if (!response.ok || !data.id) {
    throw new Error("Unable to create PayPal order.");
  }
  return data;
}

export async function getPayPalOrder(orderId: string): Promise<PayPalOrderDetails> {
  const token = await getPayPalAccessToken();
  const response = await fetch(`${getPayPalApiBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = (await response.json().catch(() => ({}))) as PayPalOrderDetails;
  if (!response.ok || !data.id) {
    throw new Error("Unable to verify PayPal order details.");
  }
  return data;
}

export async function capturePayPalOrder(orderId: string) {
  const token = await getPayPalAccessToken();
  const response = await fetch(`${getPayPalApiBase()}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = (await response.json().catch(() => ({}))) as PayPalCaptureResponse;
  if (!response.ok || !data.id) {
    throw new Error("Unable to capture PayPal order.");
  }
  const captureId = data.purchase_units?.[0]?.payments?.captures?.[0]?.id;
  return { id: data.id, status: data.status, captureId };
}
