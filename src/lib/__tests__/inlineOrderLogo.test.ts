import { describe, expect, it } from "vitest";
import { inlineOrderLogo, productionLogoUrl } from "../inlineOrderLogo";
describe("private production logo URLs",()=>{
 it("keeps exact bytes while replacing repeated inline data with a versioned private URL",()=>{const image="data:image/png;base64,aGVsbG8=";expect(inlineOrderLogo(image)?.bytes.toString()).toBe("hello");const url=productionLogoUrl("order-1",image);expect(url).toMatch(/^\/api\/admin\/orders\/order-1\/artwork\/logo.png\?v=[a-f0-9]{16}$/);expect(productionLogoUrl("order-1","data:image/png;base64,d29ybGQ=")).not.toBe(url);});
 it("never fetches remote URLs or treats HTML as artwork",()=>{expect(productionLogoUrl("a","https://example.test/logo.png")).toBe("https://example.test/logo.png");expect(inlineOrderLogo("data:text/html;base64,WA==")).toBeNull();expect(inlineOrderLogo("https://example.test")).toBeNull();});
});
