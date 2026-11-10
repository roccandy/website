import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: null as null | { user: { role: string } },
  calls: [] as unknown[][],
  result: {
    data: [] as unknown[],
    count: 0,
    error: null as null | { message: string },
  },
}));
vi.mock("@/lib/adminAuth", () => ({
  getAdminSession: async () => mocks.session,
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdminClient: {
    from: (table: string) => {
      mocks.calls.push(["from", table]);
      const query = {
        select: (...args: unknown[]) => {
          mocks.calls.push(["select", ...args]);
          return query;
        },
        ilike: (...args: unknown[]) => {
          mocks.calls.push(["ilike", ...args]);
          return query;
        },
        order: () => query,
        range: (...args: unknown[]) => {
          mocks.calls.push(["range", ...args]);
          return Promise.resolve(mocks.result);
        },
      };
      return query;
    },
  },
}));
import { GET } from "./route";
describe("private on-demand design library", () => {
  beforeEach(() => {
    mocks.session = null;
    mocks.calls = [];
    mocks.result = { data: [], count: 0, error: null };
  });
  it.each([null, "seo", "production"])(
    "denies %s before querying stored artwork",
    async (role) => {
      mocks.session = role ? { user: { role } } : null;
      const response = await GET(
        new Request("https://studio.test/api/admin/design/library"),
      );
      expect(response.status).toBe(403);
      expect(mocks.calls).toEqual([]);
    },
  );
  it("escapes name searches, bounds pagination and prevents caching", async () => {
    mocks.session = { user: { role: "admin" } };
    const response = await GET(
      new Request(
        "https://studio.test/api/admin/design/library?q=Label%25_&page=-10",
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.calls).toContainEqual(["ilike", "name", "%Label\\%\\_%"]);
    expect(mocks.calls).toContainEqual(["range", 0, 23]);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({
      designs: [],
      count: 0,
      page: 0,
    });
  });
  it("reports a retryable failure without exposing database errors", async () => {
    mocks.session = { user: { role: "admin" } };
    mocks.result.error = { message: "internal database detail" };
    const response = await GET(
      new Request("https://studio.test/api/admin/design/library"),
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("internal database detail");
  });
});
