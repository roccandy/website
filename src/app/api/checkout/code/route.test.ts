import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ limit: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ getClientIp: () => "test-ip", rateLimit: mocks.limit }));
import { POST } from "./route";
beforeEach(() => mocks.limit.mockReturnValue({ ok: true }));
const request = (code: unknown) => new Request("http://localhost/api/checkout/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
it("validates codes server-side without exposing the code in its response", async () => {
  const response = await POST(request("FH*#HK@NXsh83D=-S"));
  expect(await response.json()).toEqual({ valid: true });
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("does not accept client flags or a nearly matching code", async () => {
  for (const code of [true, { valid: true }, "FH*#HK@NXsh83D=-X"]) expect(await (await POST(request(code))).json()).toEqual({ valid: false });
});
it("rate limits attempts", async () => {
  mocks.limit.mockReturnValue({ ok: false, retryAfterSeconds: 120 });
  const response = await POST(request("wrong"));
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("120");
});
it("handles malformed input without exposing a stack trace", async () => {
  const response = await POST(new Request("http://localhost/api/checkout/code", { method: "POST", body: "{" }));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "Unable to check this code." });
});
