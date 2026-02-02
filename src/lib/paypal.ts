type PayPalAccessTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type PayPalOrderResponse = {
  id: string;
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
  return process.env.PAYPAL_API_BASE?.trim() || "https://api-m.paypal.com";
}

function getPayPalCredentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const secret = process.env.PAYPAL_SECRET?.trim();
  if (!clientId || !secret) {
    throw new Error("PayPal is not configured.");
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

export async function createPayPalOrder(totalAmount: number, currency = "AUD") {
  const token = await getPayPalAccessToken();
  const response = await fetch(`${getPayPalApiBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: totalAmount.toFixed(2),
          },
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
