"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AddPremadeToCartButton } from "@/components/AddPremadeToCartButton";
import { useCart, type CartItem, type CustomCartItem, type PremadeCartItem } from "@/components/CartProvider";
import { CandyPreview } from "@/app/quote/CandyPreview";
import { paletteSections } from "@/app/admin/settings/palette";
import type { ColorPaletteRow, LabelType, QuoteBlock } from "@/lib/data";
import type { CheckoutOrderPayload } from "@/lib/checkoutTypes";

type PremadeSuggestion = {
  id: string;
  name: string;
  description: string;
  price: number;
  weight_g: number;
  weightLabel: string;
  imageUrl: string;
  approx_pcs: number | null;
};

type PricingBreakdown = {
  basePrice: number;
  packagingPrice: number;
  labelsPrice: number;
  extrasPrice: number;
  urgencyFee: number;
  transactionFee: number;
  total: number;
  totalWeightKg: number;
  items: Array<{ label: string; amount: number }>;
};

type Props = {
  suggestions: PremadeSuggestion[];
  palette: ColorPaletteRow[];
  quoteBlocks: QuoteBlock[];
  labelTypes: LabelType[];
  urgencyFeePercent: number;
  urgencyPeriodDays: number;
  transactionFeePercent: number;
};

const AU_STATES = [
  { value: "ACT", label: "ACT" },
  { value: "NSW", label: "NSW" },
  { value: "NT", label: "NT" },
  { value: "QLD", label: "QLD" },
  { value: "SA", label: "SA" },
  { value: "TAS", label: "TAS" },
  { value: "VIC", label: "VIC" },
  { value: "WA", label: "WA" },
];

type SquarePayments = {
  card: () => Promise<{ attach: (selector: string) => Promise<void>; tokenize: () => Promise<{ status: string; token?: string }> }>;
  applePay: (request: unknown) => Promise<{ attach: (selector: string) => Promise<void>; tokenize: () => Promise<{ status: string; token?: string }> }>;
  googlePay: (request: unknown) => Promise<{ attach: (selector: string) => Promise<void>; tokenize: () => Promise<{ status: string; token?: string }> }>;
  paymentRequest: (request: unknown) => unknown;
};

declare global {
  interface Window {
    Square?: { payments: (appId: string, locationId: string) => SquarePayments };
    paypal?: {
      Buttons: (options: Record<string, unknown>) => { render: (selector: string | HTMLElement) => void };
    };
  }
}

const SQUARE_APP_ID = process.env.NEXT_PUBLIC_SQUARE_APP_ID || "";
const SQUARE_LOCATION_ID = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID || "";
const SQUARE_ENV = process.env.NEXT_PUBLIC_SQUARE_ENV || "production";
const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";
const PAYPAL_ENV = process.env.NEXT_PUBLIC_PAYPAL_ENV || "production";

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatWeight(weight_g: number) {
  if (!Number.isFinite(weight_g)) return "";
  if (weight_g >= 1000) {
    const kg = weight_g / 1000;
    return `${kg % 1 === 0 ? kg.toFixed(0) : kg.toFixed(1)}kg`;
  }
  return `${weight_g}g`;
}

function formatPackagingLabel(label?: string | null) {
  if (!label) return "Packaging";
  const parts = label.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) return parts.join(" ");
  return label.replace(/\s+/g, " ").trim();
}

const LABEL_SHAPE_LABELS: Record<LabelType["shape"], string> = {
  square: "Square",
  rectangular: "Rectangular",
  circle: "Circle",
};

function formatLabelTypeLabel(labelType?: LabelType | null) {
  if (!labelType) return "";
  const shape = LABEL_SHAPE_LABELS[labelType.shape] ?? labelType.shape;
  const dimension = (labelType.dimensions || "").trim();
  return dimension ? `${shape} ${dimension}` : shape;
}

function SquarePayment({
  amount,
  canPay,
  getOrderPayload,
  onSuccess,
  onError,
}: {
  amount: number;
  canPay: boolean;
  getOrderPayload: () => CheckoutOrderPayload;
  onSuccess: (adminEmailWarning?: string | null) => void;
  onError: (stage: string, message: string) => void;
}) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [debugNote, setDebugNote] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const cardRef = useRef<Awaited<ReturnType<SquarePayments["card"]>> | null>(null);
  const appleRef = useRef<Awaited<ReturnType<SquarePayments["applePay"]>> | null>(null);
  const googleRef = useRef<Awaited<ReturnType<SquarePayments["googlePay"]>> | null>(null);
  const appleHandlerRef = useRef<(() => void) | null>(null);
  const googleHandlerRef = useRef<(() => void) | null>(null);
  const initializedRef = useRef(false);
  const initializingRef = useRef(false);
  const payloadRef = useRef(getOrderPayload);
  const canPayRef = useRef(canPay);

  useEffect(() => {
    payloadRef.current = getOrderPayload;
    canPayRef.current = canPay;
  }, [getOrderPayload, canPay]);

  const handleTokenize = async (
    tokenize: () => Promise<{ status: string; token?: string }>,
    methodTitle: string
  ) => {
    setSetupError(null);
    if (!canPayRef.current) {
      onError("validation", "Please complete all required fields before paying.");
      return;
    }
    setLoading(true);
    try {
      const tokenResult = await tokenize();
      if (tokenResult.status !== "OK" || !tokenResult.token) {
        throw new Error("Payment token failed.");
      }
      const response = await fetch("/api/payments/square", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: payloadRef.current(),
          sourceId: tokenResult.token,
          paymentMethodTitle: methodTitle,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Payment failed.");
      }
      const payload = (await response.json().catch(() => ({}))) as { adminEmailWarning?: string | null };
      onSuccess(payload.adminEmailWarning ?? null);
    } catch (error) {
      onError("charge", error instanceof Error ? error.message : "Payment failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initializedRef.current || initializingRef.current) return;
    if (!SQUARE_APP_ID || !SQUARE_LOCATION_ID) {
      setSetupError("Square is not configured.");
      return;
    }
    initializingRef.current = true;
    const scriptUrl =
      SQUARE_ENV === "sandbox" ? "https://sandbox.web.squarecdn.com/v1/square.js" : "https://web.squarecdn.com/v1/square.js";

    void (async () => {
      try {
        await loadScript(scriptUrl);
        if (!window.Square) throw new Error("Square SDK not available.");
        const payments = window.Square.payments(SQUARE_APP_ID, SQUARE_LOCATION_ID);
        const paymentRequest = payments.paymentRequest({
          countryCode: "AU",
          currencyCode: "AUD",
          total: { amount: amount.toFixed(2), label: "Total" },
        });

        const cardContainer = document.getElementById("square-card-container");
        const appleContainer = document.getElementById("square-apple-pay");
        const googleContainer = document.getElementById("square-google-pay");
        if (cardContainer) cardContainer.innerHTML = "";
        if (appleContainer) appleContainer.innerHTML = "";
        if (googleContainer) googleContainer.innerHTML = "";
        if (cardContainer && cardContainer.childNodes.length === 0) {
          const card = await payments.card();
          await card.attach("#square-card-container");
          cardRef.current = card;
        }

        try {
          const applePay = await payments.applePay(paymentRequest);
          if (!applePay || typeof (applePay as { attach?: unknown }).attach !== "function") {
            throw new Error("Apple Pay not available (attach missing).");
          }
          const appleNode = document.getElementById("square-apple-pay");
          if (appleNode && appleNode.childNodes.length === 0) {
            await applePay.attach("#square-apple-pay");
          }
          appleRef.current = applePay;
          setAppleAvailable(true);
          if (appleNode) {
            const handler = () => void handleTokenize(() => applePay.tokenize(), "Square - Apple Pay");
            appleHandlerRef.current = handler;
            appleNode.addEventListener("click", handler);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : JSON.stringify(error);
          appleRef.current = null;
          setAppleAvailable(false);
          setDebugNote(`Square Apple Pay unavailable: ${message || "applePay() init failed."}`);
        }

        try {
          const googlePay = await payments.googlePay(paymentRequest);
          if (!googlePay || typeof (googlePay as { attach?: unknown }).attach !== "function") {
            throw new Error("Google Pay not available (attach missing).");
          }
          const googleNode = document.getElementById("square-google-pay");
          if (googleNode && googleNode.childNodes.length === 0) {
            await googlePay.attach("#square-google-pay");
          }
          googleRef.current = googlePay;
          setGoogleAvailable(true);
          if (googleNode) {
            const handler = () => void handleTokenize(() => googlePay.tokenize(), "Square - Google Pay");
            googleHandlerRef.current = handler;
            googleNode.addEventListener("click", handler);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : JSON.stringify(error);
          googleRef.current = null;
          setGoogleAvailable(false);
          setDebugNote(`Square Google Pay unavailable: ${message || "googlePay() init failed."}`);
        }

        initializedRef.current = true;
        initializingRef.current = false;
        setReady(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Square setup failed.";
        setSetupError(message);
        onError("setup", message);
        setDebugNote(`Square setup error: ${message}`);
        initializingRef.current = false;
      }
    })();

    return () => {
      const appleNode = document.getElementById("square-apple-pay");
      if (appleNode && appleHandlerRef.current) {
        appleNode.removeEventListener("click", appleHandlerRef.current);
      }
      const googleNode = document.getElementById("square-google-pay");
      if (googleNode && googleHandlerRef.current) {
        googleNode.removeEventListener("click", googleHandlerRef.current);
      }
    };
  }, [amount, canPay]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-zinc-900">Pay by card or Apple Pay</h3>
      {setupError ? <p className="mt-2 text-sm text-red-600">{setupError}</p> : null}
      {debugNote ? <p className="mt-2 text-xs text-amber-600">{debugNote}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
        <span
          className={`rounded-full border px-2 py-1 ${
            appleAvailable ? "border-emerald-200 text-emerald-700" : "border-zinc-200 text-zinc-500"
          }`}
        >
          Apple Pay {appleAvailable ? "available" : "not available"}
        </span>
        <span
          className={`rounded-full border px-2 py-1 ${
            googleAvailable ? "border-emerald-200 text-emerald-700" : "border-zinc-200 text-zinc-500"
          }`}
        >
          Google Pay {googleAvailable ? "available" : "not available"}
        </span>
      </div>
      <div className="mt-4 space-y-4">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
          Wallets
        </div>
        <div className="flex w-full flex-col items-center gap-3">
          <div className="w-full max-w-md">
            <div
              id="square-apple-pay"
              className="w-full"
              style={{ display: appleAvailable ? "flex" : "none", justifyContent: "center" }}
            />
            {!appleAvailable ? (
              <div className="flex h-12 w-full items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                Apple Pay Unavailable
              </div>
            ) : null}
          </div>
          <div className="w-full max-w-md">
            <div
              id="square-google-pay"
              className="w-full"
              style={{ display: googleAvailable ? "flex" : "none", justifyContent: "center" }}
            />
            {!googleAvailable ? (
              <div className="flex h-12 w-full items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                Google Pay Unavailable
              </div>
            ) : null}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-3">
          <div id="square-card-container" />
        </div>
        <button
          type="button"
          data-primary-button
          disabled={!ready || loading}
          onClick={() => {
            if (!cardRef.current) return;
            void handleTokenize(() => cardRef.current!.tokenize(), "Square - Card");
          }}
          className="w-full rounded-full bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Processing..." : "Pay with card"}
        </button>
      </div>
    </div>
  );
}

function PayPalPayment({
  canPay,
  getOrderPayload,
  onSuccess,
  onError,
}: {
  canPay: boolean;
  getOrderPayload: () => CheckoutOrderPayload;
  onSuccess: (adminEmailWarning?: string | null) => void;
  onError: (stage: string, message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderedRef = useRef(false);
  const payloadRef = useRef(getOrderPayload);
  const canPayRef = useRef(canPay);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    payloadRef.current = getOrderPayload;
    canPayRef.current = canPay;
  }, [getOrderPayload, canPay]);

  useEffect(() => {
    if (renderedRef.current) return;
    if (!PAYPAL_CLIENT_ID) {
      setSetupError("PayPal is not configured.");
      return;
    }
    const sdkBase = PAYPAL_ENV === "sandbox" ? "https://www.sandbox.paypal.com" : "https://www.paypal.com";
    const scriptUrl = `${sdkBase}/sdk/js?client-id=${encodeURIComponent(
      PAYPAL_CLIENT_ID
    )}&currency=AUD&intent=capture&components=buttons`;

    void (async () => {
      try {
        await loadScript(scriptUrl);
        if (!window.paypal || !containerRef.current) return;
        if (containerRef.current.childNodes.length > 0) {
          renderedRef.current = true;
          return;
        }
        window.paypal
          .Buttons({
            onClick: () => {
              if (!canPayRef.current) {
                onError("validation", "Please complete all required fields before paying.");
                return false;
              }
              return true;
            },
            createOrder: async () => {
              const response = await fetch("/api/payments/paypal/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ order: payloadRef.current() }),
              });
              const data = (await response.json().catch(() => ({}))) as { orderId?: string; error?: string };
              if (!response.ok || !data.orderId) {
                throw new Error(data.error || "Unable to start PayPal.");
              }
              return data.orderId;
            },
            onApprove: async (data: { orderID?: string }) => {
              if (!data.orderID) throw new Error("PayPal order missing.");
              const response = await fetch("/api/payments/paypal/capture-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId: data.orderID, order: payloadRef.current() }),
              });
              const payload = (await response.json().catch(() => ({}))) as {
                ok?: boolean;
                error?: string;
                adminEmailWarning?: string | null;
              };
              if (!response.ok || !payload.ok) {
                throw new Error(payload.error || "PayPal capture failed.");
              }
              onSuccess(payload.adminEmailWarning ?? null);
            },
            onError: (err: unknown) => {
              onError("flow", err instanceof Error ? err.message : "PayPal failed.");
            },
          })
          .render(containerRef.current);
        renderedRef.current = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "PayPal setup failed.";
        setSetupError(message);
        onError("setup", message);
      }
    })();
  }, [canPay, getOrderPayload, onError, onSuccess]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-zinc-900">Pay with PayPal</h3>
      {setupError ? <p className="mt-2 text-sm text-red-600">{setupError}</p> : null}
      <div ref={containerRef} className="mt-4" />
    </div>
  );
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.loaded = "false";
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}


const isDateBlocked = (dateKey: string, blocks: QuoteBlock[]) => {
  return blocks.some((block) => dateKey >= block.start_date && dateKey <= block.end_date);
};

const dayLabelClass = "text-[10px] uppercase tracking-[0.2em] text-zinc-400";

const buildDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString(undefined, { month: "long", year: "numeric" });


function normalizeHex(value: string) {
  const trimmed = value.trim();
  if (!/^#?[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  return trimmed.startsWith("#") ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`;
}

function buildPaletteLabelMap(palette: ColorPaletteRow[]) {
  const labelMap = new Map<string, string>();
  paletteSections.forEach((section) => {
    section.items.forEach((item) => {
      const match = palette.find((row) => row.category === item.categoryKey && row.shade === item.shadeKey);
      const hex = normalizeHex(match?.hex ?? item.defaultValue);
      if (hex.startsWith("#")) {
        labelMap.set(hex, item.label);
      }
    });
  });
  return labelMap;
}

function formatJacketLabel(item: CustomCartItem) {
  const jacketValue = item.jacket || item.jacketType;
  if (!jacketValue) return "Single colour";
  if (jacketValue === "two_colour_pinstripe") return "Two colour + Pinstripe";
  if (jacketValue === "two_colour") return "Two colour";
  if (jacketValue === "pinstripe") return "Pinstripe";
  if (jacketValue === "rainbow") return "Rainbow";
  return jacketValue.replace(/_/g, " ");
}

function splitWeddingNames(value?: string | null) {
  const safe = (value || "").trim();
  if (!safe) return { lineOne: "", lineTwo: "" };
  const heartSplit = safe.split(/\s*\u2764\uFE0F?\s*/);
  if (heartSplit.length >= 2) {
    return { lineOne: heartSplit[0].trim(), lineTwo: heartSplit.slice(1).join(" ").trim() };
  }
  const altSplit = safe.split(/\s*&\s*|\s*\+\s*/);
  if (altSplit.length >= 2) {
    return { lineOne: altSplit[0].trim(), lineTwo: altSplit.slice(1).join(" ").trim() };
  }
  return { lineOne: safe, lineTwo: "" };
}

function formatColorValue(value: string | null | undefined, paletteMap?: Map<string, string>) {
  if (!value) return "";
  const normalized = normalizeHex(value);
  if (!normalized.startsWith("#")) {
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
  const label = paletteMap?.get(normalized);
  if (label) return label;
  return `Custom (${normalized.toUpperCase()})`;
}

function formatColorList(values: Array<string | null | undefined>, paletteMap?: Map<string, string>) {
  const parts = values.map((value) => formatColorValue(value, paletteMap)).filter(Boolean);
  return parts.join(" / ");
}

function CartItemRow({
  item,
  onRemove,
  onQuantityChange,
  pricing,
  dueDate,
  paletteMap,
  labelTypeMap,
}: {
  item: CartItem;
  onRemove: () => void;
  onQuantityChange?: (qty: number) => void;
  pricing?: PricingBreakdown;
  dueDate?: string;
  paletteMap?: Map<string, string>;
  labelTypeMap?: Map<string, LabelType>;
}) {
  if (item.type === "premade") {
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-200 bg-white p-3">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-16 w-16 rounded-lg border border-zinc-200 object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-16 w-16 rounded-lg border border-zinc-200 bg-zinc-50" />
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold text-zinc-900">{item.name}</p>
          <p className="text-xs text-zinc-500">{formatWeight(item.weight_g)}</p>
          <p className="text-sm font-semibold text-zinc-900">{formatMoney(item.price)}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={item.quantity}
            onChange={(event) => onQuantityChange?.(Number(event.target.value))}
            className="w-16 rounded border border-zinc-200 px-2 py-1 text-sm"
            aria-label={`Quantity for ${item.name}`}
          />
          <button
            type="button"
            data-neutral-button
            onClick={onRemove}
            className="rounded-md px-3 py-1 text-xs font-semibold"
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  const packagingLine = item.packagingLabel
    ? `${item.quantity} x ${formatPackagingLabel(item.packagingLabel)}`
    : `Qty ${item.quantity}`;
  const designKey = item.categoryId || item.designType || "";
  const isWeddingInitials = designKey === "weddings-initials";
  const isWeddingNames = designKey === "weddings-both-names";
  const isWedding = isWeddingInitials || isWeddingNames;
  const isBranded = designKey === "branded";
  const designValue = item.designText || item.title;
  const { lineOne, lineTwo } = isWedding ? splitWeddingNames(designValue) : { lineOne: "", lineTwo: "" };
  const jacketLabel = formatJacketLabel(item);
  const rawJacketValue = item.jacket || item.jacketType || "";
  const usesTwoColours = rawJacketValue === "two_colour" || rawJacketValue === "two_colour_pinstripe";
  const jacketColorsValue = formatColorList(
    usesTwoColours ? [item.jacketColorOne, item.jacketColorTwo] : [item.jacketColorOne],
    paletteMap
  );
  const jacketColorsDisplay = jacketLabel === "Rainbow" ? "Rainbow" : jacketColorsValue;
  const textColorValue = formatColorValue(item.textColor, paletteMap);
  const heartColorValue = formatColorValue(item.heartColor, paletteMap);
  const labelsValue =
    item.labelsCount != null ? `${item.labelsCount}` : item.labelImageUrl ? "Yes" : "No";
  const ingredientLabelsValue = item.ingredientLabelsOptIn ? "Yes" : "No";
  const labelSummary = `${labelsValue} / ${ingredientLabelsValue}`;
  const labelTypeLabel = item.labelTypeId ? formatLabelTypeLabel(labelTypeMap?.get(item.labelTypeId)) : "";
  const labelTypeDisplay = labelTypeLabel || item.labelTypeId || "";
  const previewMode =
    rawJacketValue === "rainbow"
      ? "rainbow"
      : rawJacketValue === "pinstripe"
        ? "pinstripe"
        : rawJacketValue === "two_colour" || rawJacketValue === "two_colour_pinstripe"
          ? "two_colour"
          : "";
  const previewShowPinstripe = rawJacketValue === "pinstripe" || rawJacketValue === "two_colour_pinstripe";
  const previewDesignText = isWedding ? undefined : designValue || undefined;
  const previewLineOne = isWedding ? (isWeddingInitials ? lineOne.toUpperCase() : lineOne) : undefined;
  const previewLineTwo = isWedding ? (isWeddingInitials ? lineTwo.toUpperCase() : lineTwo) : undefined;
  const previewLogoUrl = isBranded ? item.logoUrl : undefined;
  const detailRows = [
    { label: "Title", value: item.title },
    { label: "Packaging", value: packagingLine },
    { label: "Jacket type", value: jacketLabel },
    { label: "Jacket colours", value: jacketColorsDisplay },
    { label: "Text colour", value: textColorValue },
    { label: "Heart colour", value: heartColorValue },
    { label: "Flavour", value: item.flavor || "" },
    { label: "Label / Ingredient Label", value: labelSummary },
    { label: "Label type", value: labelTypeDisplay },
  ].filter((detail) => detail.value !== "");

  const handleRemove = () => {
    if (item.type === "custom") {
      const confirmed = window.confirm("Remove this custom order from the cart?");
      if (!confirmed) return;
    }
    onRemove();
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="flex items-start justify-end">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-zinc-900">
            {pricing?.total
              ? formatMoney(pricing.total)
              : item.totalPrice
                ? formatMoney(item.totalPrice)
                : "Price pending"}
          </p>
          <button
            type="button"
            data-neutral-button
            onClick={handleRemove}
            className="rounded-md px-3 py-1 text-xs font-semibold"
          >
            Remove
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <div className="space-y-2 text-xs text-zinc-600">
          {detailRows.map((detail) => (
            <div key={detail.label} className="flex items-start justify-between gap-3">
              <span className="text-zinc-500">{detail.label}</span>
              <span className="text-right text-zinc-800">{detail.value}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center rounded-lg border border-zinc-200 bg-white p-2">
          <CandyPreview
            designText={previewDesignText}
            lineOne={previewLineOne}
            lineTwo={previewLineTwo}
            showHeart={isWedding}
            mode={previewMode}
            showPinstripe={previewShowPinstripe}
            colorOne={item.jacketColorOne || ""}
            colorTwo={item.jacketColorTwo || ""}
            logoUrl={previewLogoUrl}
            textColor={item.textColor || undefined}
            heartColor={item.heartColor || undefined}
            isInitials={isWeddingInitials}
            dimensions={{ width: 240, height: 180 }}
          />
        </div>
      </div>
    </div>
  );
}

function PremadeCarousel({ items }: { items: PremadeSuggestion[] }) {
  const pageSize = 4;
  const pages = useMemo(() => {
    const chunks: PremadeSuggestion[][] = [];
    for (let i = 0; i < items.length; i += pageSize) {
      chunks.push(items.slice(i, i + pageSize));
    }
    return chunks;
  }, [items]);
  const [page, setPage] = useState(0);

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white/90 p-6 text-center text-sm text-zinc-600 shadow-sm">
        No recommendations available yet.
      </div>
    );
  }

  const canScroll = pages.length > 1;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        data-neutral-button
        disabled={!canScroll}
        onClick={() => setPage((current) => (current - 1 + pages.length) % pages.length)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white/90 text-xl font-semibold text-zinc-600 shadow-sm transition hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Previous recommendations"
      >
        {"<"}
      </button>
      <div className="flex-1 overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${page * 100}%)` }}
        >
          {pages.map((pageItems, index) => (
            <div key={`page-${index}`} className="min-w-full grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {pageItems.map((item) => (
                <article
                  key={item.id}
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 shadow-sm"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                    <AddPremadeToCartButton
                      className="absolute right-2 top-2"
                      item={{
                        premadeId: item.id,
                        name: item.name,
                        price: item.price,
                        weight_g: item.weight_g,
                        imageUrl: item.imageUrl,
                      }}
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 px-4 py-3 text-center">
                    <p className="text-sm font-bold text-[#e91e63]">{`${item.weightLabel} ${item.name}`}</p>
                    <p className="text-xl font-semibold text-zinc-900">{formatMoney(item.price)}</p>
                    <p className="text-sm text-zinc-500">{item.description}</p>
                    {item.approx_pcs ? (
                      <p className="text-sm text-zinc-500">Approx {item.approx_pcs} pcs</p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        data-neutral-button
        disabled={!canScroll}
        onClick={() => setPage((current) => (current + 1) % pages.length)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white/90 text-xl font-semibold text-zinc-600 shadow-sm transition hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Next recommendations"
      >
        {">"}
      </button>
    </div>
  );
}

function CheckoutDatePicker({
  value,
  onChange,
  blocks,
  urgencyFeePercent,
  urgencyPeriodDays,
  showUrgencyNotice,
}: {
  value: string;
  onChange: (next: string) => void;
  blocks: QuoteBlock[];
  urgencyFeePercent: number;
  urgencyPeriodDays: number;
  showUrgencyNotice: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const todayKey = useMemo(() => {
    const today = new Date();
    return buildDateKey(today);
  }, []);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const start = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (start.getDay() + 6) % 7;
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    return Array.from({ length: totalCells }, (_, idx) => {
      const day = idx - startOffset + 1;
      return new Date(year, month, day);
    });
  }, [calendarMonth]);

  const movePrev = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  const moveNext = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:border-zinc-300"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          Choose date
        </button>
        <input
          type="text"
          value={value}
          readOnly
          inputMode="none"
          placeholder="YYYY-MM-DD"
          className="w-full max-w-[220px] rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
        />
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-4 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Select a date</p>
                <h3 className="text-lg font-semibold text-zinc-900">Delivery or pickup date</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
              >
                Close
              </button>
            </div>
            {showUrgencyNotice && (
              <p className="mt-3 text-xs text-zinc-500">
                {`${Math.round(urgencyFeePercent * 100) / 100}% surcharge needed within ${urgencyPeriodDays} day${
                  urgencyPeriodDays === 1 ? "" : "s"
                }.`}
              </p>
            )}

            <div className="mt-4 rounded-xl border border-zinc-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={movePrev}
                    className="rounded border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={moveNext}
                    className="rounded border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                  >
                    Next
                  </button>
                </div>
                <span className="text-sm font-semibold text-zinc-800">{formatMonthLabel(calendarMonth)}</span>
              </div>
              <div className={`mt-3 grid grid-cols-7 gap-2 ${dayLabelClass}`}>
                {"Mon Tue Wed Thu Fri Sat Sun".split(" ").map((day) => (
                  <div key={day} className="text-center">
                    {day}
                  </div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-2">
                {calendarDays.map((day) => {
                  const key = buildDateKey(day);
                  const inMonth = day.getMonth() === calendarMonth.getMonth();
                  if (!inMonth) {
                    return (
                      <div
                        key={key}
                        className="min-h-[48px] rounded-lg border border-transparent bg-transparent"
                      />
                    );
                  }
                  const isPastOrToday = key <= todayKey;
                  const blocked = isDateBlocked(key, blocks);
                  const disabled = blocked || isPastOrToday;
                  const isSelected = value === key;
                  const isToday = key === todayKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (disabled) return;
                        onChange(key);
                        setOpen(false);
                      }}
                      className={`min-h-[48px] rounded-lg border text-xs ${
                        inMonth ? "border-zinc-200 text-zinc-700" : "border-zinc-100 text-zinc-300"
                      } ${
                        disabled ? "cursor-not-allowed bg-zinc-100 text-zinc-400" : "bg-white hover:border-zinc-300"
                      } ${isSelected ? "ring-2 ring-zinc-900" : isToday ? "ring-1 ring-zinc-400" : ""}`}
                      aria-disabled={disabled}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CheckoutClient({
  suggestions,
  palette,
  quoteBlocks,
  labelTypes,
  urgencyFeePercent,
  urgencyPeriodDays,
  transactionFeePercent,
}: Props) {
  const { items, removeItem, updateQuantity, clearCart } = useCart();
  const paletteMap = useMemo(() => buildPaletteLabelMap(palette), [palette]);
  const labelTypeMap = useMemo(() => new Map(labelTypes.map((labelType) => [labelType.id, labelType])), [labelTypes]);
  const [dueDate, setDueDate] = useState("");
  const [pickup, setPickup] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [suburb, setSuburb] = useState("");
  const [postcode, setPostcode] = useState("");
  const [stateValue, setStateValue] = useState("");
  const customItems = useMemo(
    () => items.filter((item): item is CustomCartItem => item.type === "custom"),
    [items]
  );
  const premadeItems = useMemo(
    () => items.filter((item): item is PremadeCartItem => item.type === "premade"),
    [items]
  );
  const hasCustomItems = customItems.length > 0;
  const hasPremadeItems = premadeItems.length > 0;
  const hasItems = hasCustomItems || hasPremadeItems;
  const isDueDateBlocked = useMemo(
    () => Boolean(dueDate && isDateBlocked(dueDate, quoteBlocks)),
    [dueDate, quoteBlocks]
  );
  const isUrgencyWindow = useMemo(() => {
    if (!hasCustomItems) return false;
    if (!dueDate) return false;
    const due = new Date(dueDate);
    const now = new Date();
    if (Number.isNaN(due.getTime())) return false;
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= urgencyPeriodDays;
  }, [dueDate, hasCustomItems, urgencyPeriodDays]);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [adminEmailWarning, setAdminEmailWarning] = useState<string | null>(null);
  const [orderConfirmationVisible, setOrderConfirmationVisible] = useState(false);
  const [pricingOverrides, setPricingOverrides] = useState<Record<string, PricingBreakdown>>({});
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const buildExtrasForItem = (item: CustomCartItem) => {
    if (item.jacketExtras?.length) return item.jacketExtras;
    if (item.jacket === "two_colour_pinstripe") {
      return [{ jacket: "two_colour" as const }, { jacket: "pinstripe" as const }];
    }
    if (item.jacket === "two_colour") return [{ jacket: "two_colour" as const }];
    if (item.jacket === "pinstripe") return [{ jacket: "pinstripe" as const }];
    if (item.jacket === "rainbow") return [{ jacket: "rainbow" as const }];
    return [];
  };

  const fetchPricing = async (item: CustomCartItem, date?: string) => {
    if (!item.categoryId || !item.packagingOptionId || !item.quantity) return null;
    const extras = buildExtrasForItem(item);
    const payload = {
      categoryId: item.categoryId,
      packaging: [{ optionId: item.packagingOptionId, quantity: item.quantity }],
      labelsCount: item.labelsCount ?? 0,
      dueDate: date || undefined,
      extras: extras.length ? extras : undefined,
    };
    const res = await fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Unable to update pricing");
    }
    return (await res.json()) as PricingBreakdown;
  };

  useEffect(() => {
    let active = true;
    const needsReprice =
      Boolean(dueDate) ||
      customItems.some((item) => item.totalPrice == null || item.totalWeightKg == null);

    if (!customItems.length || !needsReprice) {
      setPricingOverrides({});
      setPricingError(null);
      setPricingLoading(false);
      return;
    }

    setPricingLoading(true);
    setPricingError(null);

    void (async () => {
      let errorMessage: string | null = null;
      const results = await Promise.all(
        customItems.map(async (item) => {
          try {
            return await fetchPricing(item, dueDate || undefined);
          } catch (error) {
            if (!errorMessage) {
              errorMessage = error instanceof Error ? error.message : "Unable to update pricing";
            }
            return null;
          }
        })
      );

      if (!active) return;
      const next: Record<string, PricingBreakdown> = {};
      results.forEach((result, index) => {
        if (result) next[customItems[index].id] = result;
      });
      setPricingOverrides(next);
      setPricingError(errorMessage);
      setPricingLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [customItems, dueDate]);

  useEffect(() => {
    if (!paymentSuccess) return;
    setOrderConfirmationVisible(true);
    const timeout = setTimeout(() => {
      setOrderConfirmationVisible(false);
    }, 6000);
    return () => clearTimeout(timeout);
  }, [paymentSuccess]);

  const cartPricing = useMemo(() => {
    let baseSubtotal = 0;
    let urgencyTotal = 0;
    let transactionTotal = 0;
    let count = 0;
    let premadeSubtotal = 0;
    let hasPending = false;
    const itemLines: Array<{ id: string; label: string; amount: number; pending?: boolean }> = [];

    for (const item of items) {
      count += item.quantity;
      if (item.type === "premade") {
        const amount = item.price * item.quantity;
        premadeSubtotal += amount;
        baseSubtotal += amount;
        itemLines.push({
          id: item.id,
          label: `${item.quantity} x ${item.name}`,
          amount,
        });
      } else {
        const override = pricingOverrides[item.id];
        if (override) {
          const baseAmount = override.basePrice + override.packagingPrice + override.labelsPrice + override.extrasPrice;
          baseSubtotal += baseAmount;
          urgencyTotal += override.urgencyFee;
          transactionTotal += override.transactionFee;
          itemLines.push({
            id: item.id,
            label: item.title || item.designText || "Custom order",
            amount: baseAmount,
          });
        } else if (item.totalPrice != null) {
          baseSubtotal += item.totalPrice;
          hasPending = true;
          itemLines.push({
            id: item.id,
            label: item.title || item.designText || "Custom order",
            amount: item.totalPrice,
            pending: true,
          });
        }
      }
    }

    transactionTotal += premadeSubtotal * (transactionFeePercent / 100);
    const total = baseSubtotal + urgencyTotal + transactionTotal;

    return { total, count, itemLines, urgencyTotal, transactionTotal, hasPending };
  }, [items, pricingOverrides, transactionFeePercent]);

  const addressDisabled = pickup;
  const addressInputClass = `mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm ${
    addressDisabled ? "bg-zinc-50 text-zinc-400" : "bg-white text-zinc-900"
  }`;

  const getMissingFields = () => {
    const missing: string[] = [];
    if (!hasItems) {
      missing.push("items");
      return missing;
    }
    if (hasCustomItems && !dueDate) missing.push("date required");
    if (hasCustomItems && isDueDateBlocked) missing.push("available date");
    if (!firstName.trim()) missing.push("first name");
    if (!lastName.trim()) missing.push("surname");
    if (!email.trim()) missing.push("email address");
    if (!phone.trim()) missing.push("phone number");
    if (!pickup) {
      if (!addressLine1.trim()) missing.push("address line 1");
      if (!suburb.trim()) missing.push("suburb or town");
      if (!postcode.trim()) missing.push("postcode");
      if (!stateValue.trim()) missing.push("state");
    }
    return missing;
  };

  const canPlace = hasItems && getMissingFields().length === 0;

  const buildOrderPayload = (): CheckoutOrderPayload => ({
    dueDate: dueDate || undefined,
    pickup,
    paymentPreference: null,
    customer: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      organizationName: organizationName.trim() || undefined,
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim(),
      suburb: suburb.trim(),
      postcode: postcode.trim(),
      state: stateValue,
    },
    customItems: customItems.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      categoryId: item.categoryId,
      packagingOptionId: item.packagingOptionId,
      quantity: item.quantity,
      packagingLabel: item.packagingLabel,
      jarLidColor: item.jarLidColor,
      labelsCount: item.labelsCount ?? null,
      labelImageUrl: item.labelImageUrl ?? null,
      labelTypeId: item.labelTypeId ?? null,
      ingredientLabelsOptIn: item.ingredientLabelsOptIn ?? false,
      jacket: item.jacket ?? null,
      jacketType: item.jacketType ?? null,
      jacketColorOne: item.jacketColorOne ?? null,
      jacketColorTwo: item.jacketColorTwo ?? null,
      textColor: item.textColor ?? null,
      heartColor: item.heartColor ?? null,
      flavor: item.flavor ?? null,
      logoUrl: item.logoUrl ?? null,
      designType: item.designType ?? null,
      designText: item.designText ?? null,
      jacketExtras: item.jacketExtras ?? [],
    })),
    premadeItems: premadeItems.map((item) => ({ premadeId: item.premadeId, quantity: item.quantity })),
  });

  const handlePaymentSuccess = (warning?: string | null) => {
    setPaymentSuccess(true);
    setPaymentError(null);
    setAdminEmailWarning(warning ?? null);
    clearCart();
  };

  const logPaymentFailure = async (provider: "square" | "paypal", stage: string, message: string) => {
    try {
      await fetch("/api/payments/log-failure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          stage,
          message,
          customerEmail: email.trim() || undefined,
          orderTotal: cartPricing.total,
        }),
      });
    } catch {
      // no-op for UI
    }
  };

  const handlePaymentError = (provider: "square" | "paypal", stage: string, message: string) => {
    setPaymentError(message);
    setAdminEmailWarning(null);
    void logPaymentFailure(provider, stage, message);
  };

  return (
    <div className="space-y-8">
      {orderConfirmationVisible ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
            <p className="text-lg font-semibold text-zinc-900">Check your email for order confirmation.</p>
            {adminEmailWarning ? (
              <p className="mt-2 text-sm text-rose-600">Admin email not wired up.</p>
            ) : null}
            <button
              type="button"
              data-neutral-button
              onClick={() => setOrderConfirmationVisible(false)}
              className="mt-4 rounded-full px-4 py-2 text-sm font-semibold"
            >
              OK
            </button>
          </div>
        </div>
      ) : null}
      {paymentSuccess ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-700">
          Payment received. Your order is confirmed.
        </div>
      ) : null}
      {paymentSuccess && adminEmailWarning ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center text-sm font-semibold text-rose-700">
          Admin email not wired up. Please contact us if you need help.
        </div>
      ) : null}
      <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900">Your cart</h2>
              {items.length > 0 ? (
                <button
                  type="button"
                  data-neutral-button
                  onClick={clearCart}
                  className="rounded-md px-3 py-1 text-xs font-semibold"
                >
                  Clear cart
                </button>
              ) : null}
            </div>
            {items.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">Your cart is empty.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {items.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    pricing={pricingOverrides[item.id]}
                    dueDate={dueDate || undefined}
                    onRemove={() => removeItem(item.id)}
                    onQuantityChange={(qty) => updateQuantity(item.id, qty)}
                    paletteMap={paletteMap}
                    labelTypeMap={labelTypeMap}
                  />
                ))}
              </div>
            )}
          </div>

          <section className="space-y-4">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
                Before you check out, you may also like...
              </p>
            </div>
            <PremadeCarousel items={suggestions} />
          </section>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-zinc-900">Date & delivery</h3>
            <div className="mt-3 space-y-3">
              <div className="block text-xs uppercase tracking-[0.2em] text-zinc-500">
                <p>Date required</p>
                <div className="mt-2">
                  <CheckoutDatePicker
                    value={dueDate}
                    onChange={setDueDate}
                    blocks={quoteBlocks}
                    urgencyFeePercent={urgencyFeePercent}
                    urgencyPeriodDays={urgencyPeriodDays}
                    showUrgencyNotice={hasCustomItems}
                  />
                </div>
                {dueDate && isUrgencyWindow && !isDueDateBlocked && (
                  <span className="mt-1 block text-xs text-amber-600">
                    {`${Math.round(urgencyFeePercent * 100) / 100}% surcharge if needed within ${urgencyPeriodDays} day${
                      urgencyPeriodDays === 1 ? "" : "s"
                    }.`}
                  </span>
                )}
                {isDueDateBlocked && (
                  <span className="mt-1 block text-xs text-red-600">
                    This date is unavailable. Please choose another.
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Pickup or delivery</p>
                <div className="flex w-full overflow-hidden rounded-full border border-[#e91e63] bg-[#fedae1] divide-x divide-[#e91e63]">
                  <button
                    type="button"
                    data-segmented
                    data-active={!pickup ? "true" : "false"}
                    onClick={() => setPickup(false)}
                    className="flex-1 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition"
                  >
                    Delivery
                  </button>
                  <button
                    type="button"
                    data-segmented
                    data-active={pickup ? "true" : "false"}
                    onClick={() => setPickup(true)}
                    className="flex-1 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition"
                  >
                    Pickup
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-zinc-900">Your details</h3>
            <div className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500">
                  First name*
                  <input
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className="mt-2 w-full rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                  />
                </label>
                <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Surname*
                  <input
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className="mt-2 w-full rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Email address*
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-2 w-full rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                  />
                </label>
                <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Phone number*
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="mt-2 w-full rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                  />
                </label>
              </div>
              <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500">
                Organisation name
                <input
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  className="mt-2 w-full rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                />
              </label>
              <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500">
                Address line 1*
                <input
                  value={addressLine1}
                  onChange={(event) => setAddressLine1(event.target.value)}
                  className={addressInputClass}
                  disabled={addressDisabled}
                />
              </label>
              <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500">
                Address line 2
                <input
                  value={addressLine2}
                  onChange={(event) => setAddressLine2(event.target.value)}
                  className={addressInputClass}
                  disabled={addressDisabled}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Suburb or town*
                  <input
                    value={suburb}
                    onChange={(event) => setSuburb(event.target.value)}
                    className={addressInputClass}
                    disabled={addressDisabled}
                  />
                </label>
                <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Postcode*
                  <input
                    value={postcode}
                    onChange={(event) => setPostcode(event.target.value)}
                    className={addressInputClass}
                    disabled={addressDisabled}
                  />
                </label>
                <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500">
                  State*
                  <select
                    value={stateValue}
                    onChange={(event) => setStateValue(event.target.value)}
                    className={addressInputClass}
                    disabled={addressDisabled}
                  >
                    <option value="">Select state</option>
                    {AU_STATES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </div>

          {!paymentSuccess ? (
            <>
              <SquarePayment
                amount={cartPricing.total}
                canPay={canPlace}
                getOrderPayload={buildOrderPayload}
                onSuccess={handlePaymentSuccess}
                onError={(stage, message) => handlePaymentError("square", stage, message)}
              />
              <PayPalPayment
                canPay={canPlace}
                getOrderPayload={buildOrderPayload}
                onSuccess={handlePaymentSuccess}
                onError={(stage, message) => handlePaymentError("paypal", stage, message)}
              />
            </>
          ) : null}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Order summary</h2>
          <div className="mt-4 space-y-2 text-sm text-zinc-600">
            <div className="flex items-center justify-between">
              <span>Items</span>
              <span>{cartPricing.count}</span>
            </div>
            <div className="flex items-center justify-between font-semibold text-zinc-900">
              <span>Total</span>
              <span>{pricingLoading ? "Updating..." : formatMoney(cartPricing.total)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowBreakdown((current) => !current)}
            className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500"
          >
            {showBreakdown ? "Hide price breakdown" : "View price breakdown"}
          </button>
          {showBreakdown && (
            <div className="mt-3 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
              {cartPricing.itemLines.length === 0 ? (
                <p>No items yet.</p>
              ) : (
                cartPricing.itemLines.map((line) => (
                  <div key={line.id} className="flex items-center justify-between gap-3">
                    <span>
                      {line.label}
                      {line.pending ? " (pricing pending)" : ""}
                    </span>
                    <span className="text-zinc-900">{formatMoney(line.amount)}</span>
                  </div>
                ))
              )}
              {cartPricing.urgencyTotal > 0 ? (
                <div className="flex items-center justify-between gap-3">
                  <span>Urgency surcharge</span>
                  <span className="text-zinc-900">{formatMoney(cartPricing.urgencyTotal)}</span>
                </div>
              ) : null}
              {cartPricing.transactionTotal > 0 ? (
                <div className="flex items-center justify-between gap-3">
                  <span>Card surcharge</span>
                  <span className="text-zinc-900">{formatMoney(cartPricing.transactionTotal)}</span>
                </div>
              ) : null}
              {cartPricing.hasPending ? (
                <p className="text-[11px] text-zinc-500">
                  Custom order pricing updates once a date is selected.
                </p>
              ) : null}
              <div className="flex items-center justify-between gap-3 border-t border-zinc-200 pt-2 text-sm font-semibold text-zinc-900">
                <span>Total</span>
                <span>{formatMoney(cartPricing.total)}</span>
              </div>
            </div>
          )}
          {pricingError ? <p className="mt-2 text-xs text-red-600">{pricingError}</p> : null}
          {paymentError ? <p className="mt-2 text-xs text-red-600">{paymentError}</p> : null}
          {paymentSuccess ? (
            <p className="mt-2 text-xs font-semibold text-emerald-600">Payment confirmed.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
