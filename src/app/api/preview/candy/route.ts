import { NextResponse } from "next/server";

const DEFAULT_COLOR = "#b7b7b7";
const DEFAULT_TEXT = "#5f5f5f";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeHex(value: string | null, fallback: string) {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`;
  return fallback;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const mode = (searchParams.get("mode") ?? "solid").toLowerCase();
  const colorOne = normalizeHex(searchParams.get("colorOne"), DEFAULT_COLOR);
  const colorTwo = normalizeHex(searchParams.get("colorTwo"), colorOne);
  const textColor = normalizeHex(searchParams.get("textColor"), DEFAULT_TEXT);
  const heartColor = normalizeHex(searchParams.get("heartColor"), textColor);
  const designText = (searchParams.get("designText") ?? "").trim().slice(0, 18).toUpperCase();
  const lineOne = (searchParams.get("lineOne") ?? "").trim().slice(0, 12).toUpperCase();
  const lineTwo = (searchParams.get("lineTwo") ?? "").trim().slice(0, 12).toUpperCase();
  const showHeart = searchParams.get("showHeart") === "1";
  const logoUrl = (searchParams.get("logoUrl") ?? "").trim();

  const fill =
    mode === "rainbow"
      ? "url(#rainbow)"
      : mode === "two_colour"
        ? "url(#split)"
        : colorOne;
  const pinstripe =
    mode === "pinstripe"
      ? `<circle cx="300" cy="200" r="160" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="18" stroke-dasharray="2 16" />`
      : "";

  const logoNode = logoUrl
    ? `<image href="${escapeXml(logoUrl)}" x="210" y="110" width="180" height="180" preserveAspectRatio="xMidYMid slice" clip-path="url(#logoClip)" />`
    : "";

  const weddingTextNode =
    lineOne || lineTwo
      ? `
      ${lineOne ? `<text x="300" y="178" text-anchor="middle" font-size="30" font-weight="700" fill="${textColor}">${escapeXml(lineOne)}</text>` : ""}
      ${showHeart ? `<text x="300" y="214" text-anchor="middle" font-size="38" fill="${heartColor}">♥</text>` : ""}
      ${lineTwo ? `<text x="300" y="250" text-anchor="middle" font-size="30" font-weight="700" fill="${textColor}">${escapeXml(lineTwo)}</text>` : ""}
    `
      : "";

  const singleTextNode =
    !weddingTextNode && !logoNode && designText
      ? `<text x="300" y="210" text-anchor="middle" font-size="42" font-weight="700" fill="${textColor}">${escapeXml(designText)}</text>`
      : "";

  const heartOnlyNode =
    !weddingTextNode && !logoNode && !singleTextNode && showHeart
      ? `<text x="300" y="212" text-anchor="middle" font-size="46" fill="${heartColor}">♥</text>`
      : "";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="600" height="400" role="img" aria-label="Candy preview">
  <defs>
    <linearGradient id="rainbow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff3b30" />
      <stop offset="20%" stop-color="#ff9500" />
      <stop offset="40%" stop-color="#ffcc00" />
      <stop offset="60%" stop-color="#34c759" />
      <stop offset="80%" stop-color="#0a84ff" />
      <stop offset="100%" stop-color="#bf5af2" />
    </linearGradient>
    <linearGradient id="split" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${colorOne}" />
      <stop offset="50%" stop-color="${colorOne}" />
      <stop offset="50%" stop-color="${colorTwo}" />
      <stop offset="100%" stop-color="${colorTwo}" />
    </linearGradient>
    <clipPath id="logoClip">
      <circle cx="300" cy="200" r="88" />
    </clipPath>
  </defs>
  <rect width="600" height="400" fill="#ffffff" />
  <ellipse cx="300" cy="344" rx="210" ry="30" fill="rgba(20,20,20,0.12)" />
  <circle cx="300" cy="200" r="160" fill="${fill}" />
  ${pinstripe}
  <circle cx="300" cy="200" r="126" fill="#ffffff" />
  ${logoNode}
  ${weddingTextNode}
  ${singleTextNode}
  ${heartOnlyNode}
</svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

