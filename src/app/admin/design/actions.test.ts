import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyCandyDesign, studioCandyDesign } from "@/lib/candyDesign";
const { access, rpc, persist, activity, revalidate } = vi.hoisted(() => ({
  access: vi.fn(),
  rpc: vi.fn(),
  persist: vi.fn(),
  activity: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/adminAuth", () => ({ requireAdminWriteAccess: access }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdminClient: { rpc } }));
vi.mock("@/lib/candyDesignExport", () => ({ persistDesignAssets: persist }));
vi.mock("@/lib/adminActivity", () => ({ logAdminActivity: activity }));
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));
import { saveCandyDesign } from "./actions";
describe("design library saves", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.mockResolvedValue({ user: { email: "staff@example.test" } });
    persist.mockImplementation(async (d) => d);
    rpc.mockResolvedValue({
      data: { id: "77777777-7777-4777-8777-777777777777", revision: 3 },
      error: null,
    });
  });
  it("requires write access before touching artwork or the database", async () => {
    access.mockRejectedValue(new Error("Read only"));
    expect(await saveCandyDesign(emptyCandyDesign())).toEqual({
      ok: false,
      error: "Read only",
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });
  it("persists complex jackets as v2 immutable revisions without flattening the document", async () => {
    const design = studioCandyDesign(); design.jacket.advanced!.segments = 12;
    design.layers[0].opacity = 0.7;
    const result = await saveCandyDesign(design);
    expect(result.ok && result.design).toMatchObject({ schemaVersion: 2, jacket: { advanced: { segments: 12 } }, layers: [{ opacity: 0.7 }] });
    expect(rpc.mock.calls[0][1].p_document.jacket.advanced.segments).toBe(12);
    expect(rpc.mock.calls[0][1].p_document.schemaVersion).toBe(2);
  });
  it("checks the expected revision and records an attributable library update", async () => {
    const design = emptyCandyDesign();
    design.source = { id: "77777777-7777-4777-8777-777777777777", revision: 2 };
    const result = await saveCandyDesign(design);
    expect(rpc).toHaveBeenCalledWith(
      "save_candy_design",
      expect.objectContaining({
        p_id: design.source.id,
        p_revision: 2,
        p_actor: "staff@example.test",
      }),
    );
    expect(rpc.mock.calls[0][1].p_document).not.toHaveProperty("source");
    expect(result.ok && result.design.source.revision).toBe(3);
    expect(activity).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "candy-design",
        action: "updated",
      }),
    );
  });
  it("save copy creates a separate record even when starting from an older revision", async () => {
    const design = emptyCandyDesign();
    design.source = { id: "77777777-7777-4777-8777-777777777777", revision: 1 };
    await saveCandyDesign(design, true);
    expect(rpc).toHaveBeenCalledWith(
      "save_candy_design",
      expect.objectContaining({ p_id: null, p_revision: 0 }),
    );
  });
  it("reports conflicts without claiming the work was saved or changing the supplied snapshot", async () => {
    const design = emptyCandyDesign();
    const original = JSON.stringify(design);
    rpc.mockResolvedValue({
      data: null,
      error: {
        message: "This design has changed in another tab. Save a copy.",
      },
    });
    expect(await saveCandyDesign(design)).toEqual({
      ok: false,
      error: "This design has changed in another tab. Save a copy.",
    });
    expect(JSON.stringify(design)).toBe(original);
    expect(activity).not.toHaveBeenCalled();
  });
});
