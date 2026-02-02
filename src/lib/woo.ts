import { createHmac, randomBytes } from "crypto";

type WooConfig = {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  authMethod: "query" | "oauth";
};

type WooRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
};

type WooProductUpsertInput = {
  id?: string | null;
  name: string;
  description: string;
  shortDescription?: string;
  price: number;
  salePrice?: number | null;
  imageUrl?: string;
  isActive: boolean;
  sku?: string | null;
  weightG?: number | null;
  availability?: string | null;
  brand?: string | null;
  googleProductCategory?: string | null;
  productCondition?: string | null;
  categoryName?: string | null;
};

function getWooConfig(): WooConfig {
  const baseUrl = process.env.WOO_BASE_URL?.trim();
  const consumerKey = process.env.WOO_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.WOO_CONSUMER_SECRET?.trim();
  const authMethodEnv = process.env.WOO_AUTH_METHOD?.trim().toLowerCase();
  if (!baseUrl || !consumerKey || !consumerSecret) {
    throw new Error("Woo sync is not configured.");
  }
  const isHttp = baseUrl.startsWith("http://");
  const authMethod =
    authMethodEnv === "oauth" || authMethodEnv === "query"
      ? (authMethodEnv as "query" | "oauth")
      : isHttp
        ? "oauth"
        : "query";
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    consumerKey,
    consumerSecret,
    authMethod,
  };
}

function buildNonce() {
  return randomBytes(16).toString("hex");
}

function buildOAuthUrl(url: URL, method: string, consumerKey: string, consumerSecret: string) {
  const oauthParams: Array<[string, string]> = [
    ["oauth_consumer_key", consumerKey],
    ["oauth_nonce", buildNonce()],
    ["oauth_signature_method", "HMAC-SHA1"],
    ["oauth_timestamp", Math.floor(Date.now() / 1000).toString()],
    ["oauth_version", "1.0"],
  ];
  const baseUrl = `${url.origin}${url.pathname}`;
  const allParams = [...url.searchParams.entries(), ...oauthParams];
  const normalized = allParams
    .map(([key, value]) => [encodeURIComponent(key), encodeURIComponent(value)] as const)
    .sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  const paramString = normalized.map(([key, value]) => `${key}=${value}`).join("&");
  const baseString = `${method.toUpperCase()}&${encodeURIComponent(baseUrl)}&${encodeURIComponent(paramString)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&`;
  const signature = createHmac("sha1", signingKey).update(baseString).digest("base64");
  const signedParams = new URLSearchParams([...allParams, ["oauth_signature", signature]]);
  const signedUrl = new URL(url.toString());
  signedUrl.search = signedParams.toString();
  return signedUrl;
}

async function wooRequest<T>(path: string, options: WooRequestOptions = {}): Promise<T> {
  const config = getWooConfig();
  const base = config.baseUrl.endsWith("/") ? config.baseUrl : `${config.baseUrl}/`;
  const normalizedPath = path.replace(/^\/+/, "");
  const method = options.method ?? "GET";
  const url = new URL(normalizedPath, base);
  const finalUrl =
    config.authMethod === "oauth"
      ? buildOAuthUrl(url, method, config.consumerKey, config.consumerSecret)
      : (() => {
          url.searchParams.set("consumer_key", config.consumerKey);
          url.searchParams.set("consumer_secret", config.consumerSecret);
          return url;
        })();
  const response = await fetch(finalUrl, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) {
    const message = data?.message || `Woo request failed (${response.status}).`;
    throw new Error(message);
  }
  return data as T;
}

let cachedWooCategory: { name: string; id: number } | null = null;

async function ensureWooCategoryId(categoryName: string): Promise<number> {
  const trimmed = categoryName.trim();
  if (!trimmed) {
    throw new Error("Woo category name is required.");
  }
  const normalized = trimmed.toLowerCase();
  if (cachedWooCategory && cachedWooCategory.name.toLowerCase() === normalized) {
    return cachedWooCategory.id;
  }
  const searchResults = await wooRequest<Array<{ id: number; name: string }>>(
    `/wp-json/wc/v3/products/categories?search=${encodeURIComponent(trimmed)}`
  );
  const match = searchResults.find((category) => category.name.trim().toLowerCase() === normalized);
  if (match) {
    cachedWooCategory = { name: match.name, id: match.id };
    return match.id;
  }
  const created = await wooRequest<{ id: number; name: string }>(`/wp-json/wc/v3/products/categories`, {
    method: "POST",
    body: { name: trimmed },
  });
  cachedWooCategory = { name: created.name ?? trimmed, id: created.id };
  return created.id;
}

export async function upsertWooProduct(input: WooProductUpsertInput): Promise<{ id: string }> {
  const price = Number(input.price);
  if (!Number.isFinite(price)) {
    throw new Error("Invalid Woo product price.");
  }
  const salePrice =
    input.salePrice != null && Number.isFinite(Number(input.salePrice)) ? Number(input.salePrice) : null;
  const weightNumber = input.weightG ? Number(input.weightG) : null;
  const weight =
    weightNumber && Number.isFinite(weightNumber) && weightNumber > 0
      ? (weightNumber / 1000).toString()
      : undefined;
  const availability = (input.availability ?? "").toLowerCase();
  const stockStatus =
    availability === "out_of_stock"
      ? "outofstock"
      : availability === "backorder" || availability === "preorder"
        ? "onbackorder"
        : "instock";
  const metaData: Array<{ key: string; value: string }> = [];
  if (input.brand) metaData.push({ key: "brand", value: input.brand });
  if (input.googleProductCategory) {
    metaData.push({ key: "google_product_category", value: input.googleProductCategory });
  }
  if (input.productCondition) metaData.push({ key: "condition", value: input.productCondition });
  if (input.availability) metaData.push({ key: "availability", value: input.availability });
  const categories = input.categoryName?.trim()
    ? [{ id: await ensureWooCategoryId(input.categoryName) }]
    : undefined;
  const payload = {
    name: input.name,
    type: "simple",
    status: input.isActive ? "publish" : "draft",
    catalog_visibility: input.isActive ? "visible" : "hidden",
    regular_price: price.toFixed(2),
    sale_price: salePrice && salePrice > 0 ? salePrice.toFixed(2) : undefined,
    description: input.description,
    short_description: input.shortDescription ?? input.description,
    sku: input.sku ?? undefined,
    manage_stock: false,
    stock_status: stockStatus,
    weight,
    images: input.imageUrl ? [{ src: input.imageUrl, alt: input.name }] : [],
    categories,
    meta_data: metaData.length > 0 ? metaData : undefined,
  };

  const path = input.id ? `/wp-json/wc/v3/products/${input.id}` : "/wp-json/wc/v3/products";
  const data = await wooRequest<{ id: number }>(path, {
    method: input.id ? "PUT" : "POST",
    body: payload,
  });

  return { id: String(data.id) };
}

type WooOrderLineItem = {
  product_id: number;
  name?: string;
  quantity: number;
  total?: string;
  meta_data?: Array<{ key: string; value: string }>;
};

type WooOrderAddress = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
};

export type WooOrderCreateInput = {
  status?: string;
  set_paid?: boolean;
  payment_method?: string;
  payment_method_title?: string;
  transaction_id?: string;
  billing?: WooOrderAddress;
  shipping?: WooOrderAddress;
  customer_note?: string;
  line_items: WooOrderLineItem[];
  meta_data?: Array<{ key: string; value: string }>;
};

export async function createWooOrder(input: WooOrderCreateInput): Promise<{
  id: number;
  status: string;
  order_key?: string;
  payment_url?: string;
}> {
  const data = await wooRequest<{ id: number; status: string; order_key?: string; payment_url?: string }>(
    "/wp-json/wc/v3/orders",
    {
      method: "POST",
      body: input,
    }
  );
  return data;
}
