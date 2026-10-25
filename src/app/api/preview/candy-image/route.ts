import { ImageResponse } from "next/og";
import { shortCandyTextScale } from "@/lib/candyTextSizing";
import { createElement } from "react";
import { safePreviewLogoSource } from "@/lib/previewImage";

export const runtime = "edge";

const DEFAULT_COLOR = "#b7b7b7";
const DEFAULT_TEXT = "#5f5f5f";
const PREVIEW_FONT_FAMILY = "Helvetica, Arial, sans-serif";
const SHORT_CUSTOM_TEXT_MAX_LENGTH = 6;
const LONG_CUSTOM_TEXT_MAX_LENGTH = 14;
const LONG_CUSTOM_TEXT_MAX_WORD_LENGTH = 10;
const PREVIEW_HEART = "❤️";

function normalizeHex(value: string | null, fallback: string) {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`;
  return fallback;
}

function splitWeddingNames(raw: string) {
  const text = raw.trim();
  if (!text) return { lineOne: "", lineTwo: "" };
  const separators = [" + ", " & ", " and ", "+", "&"];
  for (const sep of separators) {
    const escaped = sep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(escaped, "i"));
    if (parts.length >= 2) {
      return { lineOne: parts[0].trim(), lineTwo: parts.slice(1).join(" ").trim() };
    }
  }
  return { lineOne: text, lineTwo: "" };
}

function sanitizePreviewText(value: string, variant: string) {
  const upper = value.trim().toUpperCase();
  if (variant === "short") return upper.slice(0, SHORT_CUSTOM_TEXT_MAX_LENGTH);
  if (variant !== "long") return upper.slice(0, 18);

  let letters = 0;
  return upper
    .replace(/\s+/g, " ")
    .trimStart()
    .split(" ")
    .slice(0, 3)
    .map((word) => word.slice(0, LONG_CUSTOM_TEXT_MAX_WORD_LENGTH))
    .join(" ")
    .replace(/[^\s]/g, (char) => {
      if (letters >= LONG_CUSTOM_TEXT_MAX_LENGTH) return "";
      letters += 1;
      return char;
    })
    .trimEnd();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const mode = (searchParams.get("mode") ?? "solid").toLowerCase();
  const colorOne = normalizeHex(searchParams.get("colorOne"), DEFAULT_COLOR);
  const colorTwo = normalizeHex(searchParams.get("colorTwo"), colorOne);
  const fillColor = normalizeHex(searchParams.get("fillColor"), "#ffffff");
  const pinstripeColor = normalizeHex(searchParams.get("pinstripeColor"), "#ffffff");
  const textColor = normalizeHex(searchParams.get("textColor"), DEFAULT_TEXT);
  const heartColor = normalizeHex(searchParams.get("heartColor"), textColor);
  const customTextVariant = (searchParams.get("customTextVariant") ?? "").toLowerCase();
  const rawDesignText = sanitizePreviewText(searchParams.get("designText") ?? "", customTextVariant);
  const rawLineOne = (searchParams.get("lineOne") ?? "").trim().slice(0, 12);
  const rawLineTwo = (searchParams.get("lineTwo") ?? "").trim().slice(0, 12);
  const showHeart = searchParams.get("showHeart") === "1";
  const showPinstripe = searchParams.get("showPinstripe") === "1";
  const isInitials = searchParams.get("isInitials") === "1";
  const logoUrl = safePreviewLogoSource(searchParams.get("logoUrl"));

  const weddingSplit = !rawLineOne && !rawLineTwo && customTextVariant !== "short" ? splitWeddingNames(rawDesignText) : { lineOne: rawLineOne, lineTwo: rawLineTwo };
  const lineOne = weddingSplit.lineOne.toUpperCase();
  const lineTwo = weddingSplit.lineTwo.toUpperCase();
  const designText = rawDesignText.toUpperCase();
  const isWedding = Boolean(lineOne || lineTwo);
  // Short custom text previously fell through the 30px single-name fallback.
  // Keep that six-character baseline while scaling shorter designs explicitly.
  const singleTextSize = customTextVariant === "short" ? `${30 * shortCandyTextScale(designText)}px` : designText.length > 12 ? "32px" : designText.length > 9 ? "36px" : "40px";

  const outerBackground =
    mode === "rainbow"
      ? "linear-gradient(135deg, #ff3b30 0%, #ff9500 18%, #ffcc00 36%, #34c759 54%, #0a84ff 72%, #bf5af2 100%)"
      : mode === "two_colour"
        ? `linear-gradient(90deg, ${colorOne} 0%, ${colorOne} 50%, ${colorTwo} 50%, ${colorTwo} 100%)`
        : colorOne;

  // ImageResponse does not support CSS dotted borders. Draw the pinstripes as
  // SVG so both single- and two-colour jackets produce a valid email PNG.
  const pinstripeRing = createElement("svg", {
    width: 320, height: 320, viewBox: "0 0 320 320",
    style: { position: "absolute", top: 0, left: 0 },
  }, createElement("circle", {
    cx: 160, cy: 160, r: 139, fill: "none", stroke: pinstripeColor,
    strokeWidth: 14, strokeDasharray: "2 16",
  }));

  const root = createElement(
    "div",
    {
      style: {
        width: "600px",
        height: "400px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        background: "#ffffff",
        fontFamily: PREVIEW_FONT_FAMILY,
      },
    },
    createElement("div", {
      style: {
        position: "absolute",
        width: "420px",
        height: "54px",
        bottom: "36px",
        borderRadius: "50%",
        background: "rgba(12,12,12,0.15)",
        filter: "blur(2px)",
      },
    }),
    createElement(
      "div",
      {
        style: {
          width: "320px",
          height: "320px",
          borderRadius: "999px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: outerBackground,
          border: "1px solid rgba(0,0,0,0.06)",
          position: "relative",
          overflow: "hidden",
        },
      },
      mode === "pinstripe"
        ? pinstripeRing
        : null,
      createElement(
        "div",
        {
          style: {
            width: "250px",
            height: "250px",
            borderRadius: "999px",
            background: fillColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            textAlign: "center",
            padding: "18px",
            gap: "8px",
          },
        },
        logoUrl
          ? createElement("img", {
              src: logoUrl,
              alt: "Logo",
              width: 168,
              height: 168,
              style: { borderRadius: "16px", objectFit: "contain" },
            })
          : isWedding && isInitials
            ? createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "14px",
                    color: textColor,
                    fontWeight: 700,
                    lineHeight: 1,
                  },
                },
                createElement("span", { style: { fontSize: "42px" } }, lineOne),
                showHeart ? createElement("span", { style: { color: heartColor, fontSize: "34px" } }, PREVIEW_HEART) : null,
                createElement("span", { style: { fontSize: "42px" } }, lineTwo)
              )
            : isWedding
              ? [
                  lineOne
                    ? createElement(
                        "div",
                        {
                          style: {
                            color: textColor,
                            fontSize: "30px",
                            fontWeight: 700,
                            lineHeight: 1.05,
                          },
                        },
                        lineOne
                      )
                    : null,
                  showHeart
                    ? createElement(
                        "div",
                        {
                          style: {
                            color: heartColor,
                            fontSize: "34px",
                            fontWeight: 700,
                            lineHeight: 1,
                          },
                        },
                        PREVIEW_HEART
                      )
                    : null,
                  lineTwo
                    ? createElement(
                        "div",
                        {
                          style: {
                            color: textColor,
                            fontSize: "30px",
                            fontWeight: 700,
                            lineHeight: 1.05,
                          },
                        },
                        lineTwo
                      )
                    : null,
                ]
              : createElement(
                  "div",
                  {
                    style: {
                      color: textColor,
                      fontSize: singleTextSize,
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                      lineHeight: 1.05,
                      maxWidth: "218px",
                      textAlign: "center",
                      whiteSpace: "nowrap",
                    },
                  },
                  designText || (showHeart ? PREVIEW_HEART : "")
                )
      ),
      showPinstripe && mode !== "pinstripe"
        ? pinstripeRing
        : null
    )
  );

  return new ImageResponse(root, {
    width: 600,
    height: 400,
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}
