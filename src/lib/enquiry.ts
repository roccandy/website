export const ENQUIRY_INTERESTS = [
  "wedding",
  "branded",
  "custom-text",
  "pre-made",
  "general",
] as const;

export type EnquiryInterest = (typeof ENQUIRY_INTERESTS)[number];

export type WebsiteEnquiry = {
  name: string;
  email: string;
  phone: string | null;
  organisation: string | null;
  interest: EnquiryInterest;
  requiredDate: string | null;
  quantity: string | null;
  message: string;
  productContext: string | null;
  sourcePage: string | null;
};

export type EnquiryRequestBody = Partial<Record<keyof WebsiteEnquiry, unknown>> & {
  website?: unknown;
  startedAt?: unknown;
};

type EnquiryParseResult =
  | { ok: true; enquiry: WebsiteEnquiry; isSpam: false }
  | { ok: true; enquiry: null; isSpam: true }
  | { ok: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function cleanSingleLine(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanMessage(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n?/g, "\n").trim().slice(0, maxLength);
}

function optionalSingleLine(value: unknown, maxLength: number) {
  const cleaned = cleanSingleLine(value, maxLength);
  return cleaned || null;
}

function normalizeSourcePage(value: unknown) {
  const cleaned = cleanSingleLine(value, 300);
  if (!cleaned) return null;

  try {
    const parsed = new URL(cleaned, "https://roccandy.com.au");
    if (parsed.hostname !== "roccandy.com.au" && parsed.hostname !== "www.roccandy.com.au") {
      return null;
    }
    return `${parsed.pathname}${parsed.search}`.slice(0, 300);
  } catch {
    return cleaned.startsWith("/") ? cleaned : null;
  }
}

function normalizeInterest(value: unknown): EnquiryInterest {
  const cleaned = cleanSingleLine(value, 40).toLowerCase();
  return ENQUIRY_INTERESTS.includes(cleaned as EnquiryInterest)
    ? (cleaned as EnquiryInterest)
    : "general";
}

export function enquiryInterestLabel(interest: EnquiryInterest) {
  const labels: Record<EnquiryInterest, string> = {
    wedding: "Wedding candy",
    branded: "Branded or logo candy",
    "custom-text": "Custom text candy",
    "pre-made": "Pre-made candy",
    general: "General enquiry",
  };
  return labels[interest];
}

export function buildEnquiryHref({
  interest,
  productContext,
  sourcePage,
}: {
  interest: EnquiryInterest;
  productContext: string;
  sourcePage: string;
}) {
  const params = new URLSearchParams({
    interest,
    product: productContext,
    source: sourcePage,
  });
  return `/contact?${params.toString()}#enquiry-form`;
}

export function parseEnquiryRequest(body: EnquiryRequestBody, now = Date.now()): EnquiryParseResult {
  const honeypot = cleanSingleLine(body.website, 200);
  if (honeypot) {
    return { ok: true, enquiry: null, isSpam: true };
  }

  const startedAt = Number(body.startedAt);
  if (
    Number.isFinite(startedAt) &&
    startedAt > 0 &&
    (now - startedAt < 1_000 || startedAt > now + 60_000 || now - startedAt > 24 * 60 * 60 * 1_000)
  ) {
    return { ok: true, enquiry: null, isSpam: true };
  }

  const name = cleanSingleLine(body.name, 100);
  const email = cleanSingleLine(body.email, 254).toLowerCase();
  const message = cleanMessage(body.message, 4_000);
  const requiredDate = optionalSingleLine(body.requiredDate, 10);

  if (name.length < 2) {
    return { ok: false, error: "Please enter your name." };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (message.length < 10) {
    return { ok: false, error: "Please tell us a little more about what you need." };
  }
  if (requiredDate && !ISO_DATE_PATTERN.test(requiredDate)) {
    return { ok: false, error: "Please enter a valid required date." };
  }

  return {
    ok: true,
    isSpam: false,
    enquiry: {
      name,
      email,
      phone: optionalSingleLine(body.phone, 40),
      organisation: optionalSingleLine(body.organisation, 150),
      interest: normalizeInterest(body.interest),
      requiredDate,
      quantity: optionalSingleLine(body.quantity, 100),
      message,
      productContext: optionalSingleLine(body.productContext, 200),
      sourcePage: normalizeSourcePage(body.sourcePage),
    },
  };
}
