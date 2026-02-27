import { ImageResponse } from "next/og";
import { createElement } from "react";

export const runtime = "edge";

const DEFAULT_COLOR = "#b7b7b7";
const DEFAULT_TEXT = "#5f5f5f";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const mode = (searchParams.get("mode") ?? "solid").toLowerCase();
  const colorOne = normalizeHex(searchParams.get("colorOne"), DEFAULT_COLOR);
  const colorTwo = normalizeHex(searchParams.get("colorTwo"), colorOne);
  const textColor = normalizeHex(searchParams.get("textColor"), DEFAULT_TEXT);
  const heartColor = normalizeHex(searchParams.get("heartColor"), textColor);
  const rawDesignText = (searchParams.get("designText") ?? "").trim().slice(0, 18);
  const rawLineOne = (searchParams.get("lineOne") ?? "").trim().slice(0, 12);
  const rawLineTwo = (searchParams.get("lineTwo") ?? "").trim().slice(0, 12);
  const showHeart = searchParams.get("showHeart") === "1";
  const logoUrl = (searchParams.get("logoUrl") ?? "").trim();

  const weddingSplit = !rawLineOne && !rawLineTwo ? splitWeddingNames(rawDesignText) : { lineOne: rawLineOne, lineTwo: rawLineTwo };
  const lineOne = weddingSplit.lineOne.toUpperCase();
  const lineTwo = weddingSplit.lineTwo.toUpperCase();
  const designText = rawDesignText.toUpperCase();
  const isWedding = Boolean(lineOne || lineTwo);

  const outerBackground =
    mode === "rainbow"
      ? "linear-gradient(135deg, #ff3b30 0%, #ff9500 18%, #ffcc00 36%, #34c759 54%, #0a84ff 72%, #bf5af2 100%)"
      : mode === "two_colour"
        ? `linear-gradient(90deg, ${colorOne} 0%, ${colorOne} 50%, ${colorTwo} 50%, ${colorTwo} 100%)`
        : colorOne;

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
        fontFamily: "Arial, sans-serif",
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
        ? createElement("div", {
            style: {
              position: "absolute",
              inset: "14px",
              borderRadius: "999px",
              border: "14px dotted rgba(255,255,255,0.9)",
            },
          })
        : null,
      createElement(
        "div",
        {
          style: {
            width: "250px",
            height: "250px",
            borderRadius: "999px",
            background: "#ffffff",
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
              style: { borderRadius: "16px", objectFit: "cover" },
            })
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
                      "♥"
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
                    fontSize: "40px",
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    lineHeight: 1.05,
                  },
                },
                designText || (showHeart ? "♥" : "")
              )
      )
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

