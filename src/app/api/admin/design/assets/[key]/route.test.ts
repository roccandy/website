import { beforeEach, describe, expect, it, vi } from "vitest";
import { designAssetKey, designImageHref, emptyCandyDesign, newDesignLayer } from "@/lib/candyDesign";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { CandyDesignSvg } from "@/components/CandyDesignSvg";
const {session,download}=vi.hoisted(()=>({session:vi.fn(),download:vi.fn()}));
vi.mock("@/lib/adminAuth",()=>({getAdminSession:session}));
vi.mock("@/lib/supabase/admin",()=>({supabaseAdminClient:{storage:{from:()=>({download})}}}));
import { GET } from "./route";
const key="a".repeat(64)+".png";
describe("private design artwork",()=>{
 beforeEach(()=>{session.mockResolvedValue({user:{role:"admin"}});download.mockResolvedValue({data:new Blob(["png"]),error:null});});
 it("recognises only bounded asset references, including compatible legacy bucket URLs",()=>{expect(designAssetKey(`candy-asset:${key}`)).toBe(key);expect(designAssetKey("candy-asset:../../secret")).toBeNull();expect(designAssetKey(`https://other.test/${key}`)).toBeNull();expect(designImageHref(`candy-asset:${key}`)).toBe(`/api/admin/design/assets/${key}`);});
 it("renders authenticated image URLs in admin previews",()=>{const design=emptyCandyDesign();design.layers=[{...newDesignLayer("image","art"),image:`candy-asset:${key}`}];const svg=renderToStaticMarkup(createElement(CandyDesignSvg,{design}));expect(svg).toContain(`/api/admin/design/assets/${key}`);expect(svg).not.toContain("object/public");});
 it.each([null,{user:{role:"seo"}}])("blocks unapproved readers",async(user)=>{session.mockResolvedValue(user);expect((await GET(new Request("http://localhost"),{params:Promise.resolve({key})})).status).toBe(403);expect(download).not.toHaveBeenCalled();});
 it("rejects arbitrary storage paths",async()=>{expect((await GET(new Request("http://localhost"),{params:Promise.resolve({key:"../private"})})).status).toBe(404);expect(download).not.toHaveBeenCalled();});
 it("delivers artwork only with private no-store caching",async()=>{const response=await GET(new Request("http://localhost"),{params:Promise.resolve({key})});expect(response.status).toBe(200);expect(response.headers.get("Cache-Control")).toBe("private, no-store");expect(download).toHaveBeenCalledWith(key);});
});
