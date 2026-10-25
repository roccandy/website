import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

vi.mock("next/og", () => ({
  ImageResponse: class extends Response {
    constructor(element: ReactElement) { super(renderToStaticMarkup(element)); }
  },
}));

import { GET } from "./route";

describe("email PNG candy colour tree", () => {
  it.each([["W",57],["WWW",46.5],["WWWWW",39],["WWWWWW",30]])("matches short custom text scaling for %s",async(text,size)=>{
    const html=await(await GET(new Request(`http://localhost/api/preview/candy-image?designText=${text}&customTextVariant=short`))).text();
    expect(html).toContain(`font-size:${size}px`);
  });
  it.each(["mode=pinstripe", "mode=two_colour&showPinstripe=1"])("uses renderer-supported SVG pinstripes (%s)", async mode => {
    const html = await (await GET(new Request(`http://localhost/api/preview/candy-image?${mode}&fillColor=%23ffee99&pinstripeColor=%23123456`))).text();
    expect(html).toContain("background:#ffee99");
    expect(html).toContain('stroke="#123456"');
    expect(html).toContain('stroke-dasharray="2 16"');
    expect(html).not.toContain("dotted");
  });
  it("keeps white defaults and hides pinstripes when unselected", async () => {
    const html = await (await GET(new Request("http://localhost/api/preview/candy-image"))).text();
    expect(html).toContain("background:#ffffff");
    expect(html).not.toContain('stroke-dasharray');
  });
});
