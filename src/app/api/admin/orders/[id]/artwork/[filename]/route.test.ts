import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({session:vi.fn(),from:vi.fn(),read:vi.fn()}));
vi.mock("@/lib/adminAuth",()=>({getAdminSession:mocks.session}));
vi.mock("@/lib/supabase/admin",()=>({supabaseAdminClient:{from:mocks.from}}));
import {GET} from "./route";
const params={params:Promise.resolve({id:"00000000-0000-0000-0000-000000000001",filename:"logo.png"})};
beforeEach(()=>{vi.clearAllMocks();mocks.session.mockResolvedValue({user:{role:"viewer"}});mocks.read.mockResolvedValue({data:{logo_url:"data:image/png;base64,aGVsbG8="},error:null});mocks.from.mockReturnValue({select:()=>({eq:()=>({maybeSingle:mocks.read})})});});
describe("private order artwork",()=>{
 it("requires a session before reading any order data",async()=>{mocks.session.mockResolvedValue(null);expect((await GET(new Request("http://localhost"),params)).status).toBe(401);expect(mocks.from).not.toHaveBeenCalled();});
 it("serves exact artwork privately with SVG-safe headers",async()=>{const r=await GET(new Request("http://localhost"),params);expect(r.status).toBe(200);expect(await r.text()).toBe("hello");expect(r.headers.get("cache-control")).toBe("private, max-age=30");expect(r.headers.get("content-security-policy")).toContain("sandbox");expect(r.headers.get("vary")).toBe("Cookie");});
 it("never redirects to or fetches arbitrary remote URLs",async()=>{mocks.read.mockResolvedValue({data:{logo_url:"https://internal.test"},error:null});expect((await GET(new Request("http://localhost"),params)).status).toBe(404);});
});
