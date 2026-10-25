import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("candy preview colours", () => {
  it("keeps white defaults", async () => {
    const html = await (await GET(new Request("http://localhost/api/preview/candy?mode=pinstripe"))).text();
    expect(html).toContain('r="126" fill="#ffffff"');
    expect(html).toContain('stroke="#ffffff"');
  });
  it("uses independently validated admin fill and pinstripe colours", async () => {
    const html = await (await GET(new Request("http://localhost/api/preview/candy?mode=two_colour&showPinstripe=1&fillColor=%23ffee99&pinstripeColor=%23ff1122"))).text();
    expect(html).toContain('r="126" fill="#ffee99"');
    expect(html).toContain('stroke="#ff1122"');
  });
  it("does not interpolate invalid colour markup", async () => {
    const html = await (await GET(new Request("http://localhost/api/preview/candy?fillColor=bad&pinstripeColor=bad&showPinstripe=1"))).text();
    expect(html).toContain('r="126" fill="#ffffff"');
    expect(html).toContain('stroke="#ffffff"');
  });
});
