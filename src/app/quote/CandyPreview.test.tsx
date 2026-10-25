import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CandyPreview } from "./CandyPreview";

describe("CandyPreview admin colours", () => {
  const base = { mode: "pinstripe" as const, colorOne: "#123456", colorTwo: "#654321" };
  it("keeps white customer/legacy fill and pinstripe defaults", () => {
    const html = renderToStaticMarkup(createElement(CandyPreview, base));
    expect(html).toMatch(/r="444.797" style="fill:#ffffff/);
    expect(html).toContain('class="pinStripe" style="fill:#ffffff;opacity:1');
  });
  it("renders custom fill and pinstripe independently of the jacket", () => {
    const html = renderToStaticMarkup(createElement(CandyPreview, { ...base, fillColor: "#ffee99", pinstripeColor: "#ff1122" }));
    expect(html).toMatch(/r="444.797" style="fill:#ffee99/);
    expect(html).toContain('class="pinStripe" style="fill:#ff1122;opacity:1');
    expect(html).toContain('stop-color="#123456"');
  });
  it("hides pinstripes until selected, including combined two-colour jackets", () => {
    const hidden = renderToStaticMarkup(createElement(CandyPreview, { ...base, mode: "two_colour", pinstripeColor: "#ff1122" }));
    expect(hidden).toContain('class="pinStripe" style="fill:#ff1122;opacity:0');
    const shown = renderToStaticMarkup(createElement(CandyPreview, { ...base, mode: "two_colour", showPinstripe: true, pinstripeColor: "#ff1122" }));
    expect(shown).toContain('class="pinStripe" style="fill:#ff1122;opacity:1');
  });
});
