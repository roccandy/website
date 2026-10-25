import { describe, expect, it, vi } from "vitest";
const invalidate=vi.hoisted(()=>vi.fn());
vi.mock("next/cache",()=>({revalidateTag:invalidate}));
import { invalidateAdminWorkspace, ADMIN_WORKSPACE_TTL, ADMIN_WORKSPACE_TAG } from "../adminWorkspaceCache";
describe("admin workspace cache",()=>{
 it("bounds snapshots to 30 seconds and immediately expires them on writes",()=>{expect(ADMIN_WORKSPACE_TTL).toBe(30);invalidateAdminWorkspace();expect(invalidate).toHaveBeenCalledWith(ADMIN_WORKSPACE_TAG,{expire:0});});
 it("never reports a successful payment as failed due to cache invalidation",()=>{invalidate.mockImplementationOnce(()=>{throw Error("cache offline")});expect(()=>invalidateAdminWorkspace()).not.toThrow();});
});
