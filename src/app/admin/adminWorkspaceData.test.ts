import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({select:vi.fn(),range:vi.fn(),fail:false}));
vi.mock("server-only",()=>({}));
vi.mock("next/cache",()=>({unstable_cache:(fn:unknown)=>fn}));
vi.mock("@/lib/supabase/admin",()=>({supabaseAdminClient:{from:()=>({select:mocks.select})}}));
vi.mock("@/lib/data",()=>({getCategories:vi.fn(),getOrderSlots:vi.fn(),getProductionDayNotes:vi.fn(),getProductionSlots:vi.fn()}));
vi.mock("@/lib/pricing",()=>({buildPricingContext:vi.fn()}));
vi.mock("@/lib/adminActivity",()=>({listRecentAdminActivity:vi.fn()}));
vi.mock("@/lib/adminWorkspaceCache",()=>({ADMIN_WORKSPACE_TAG:"test",ADMIN_WORKSPACE_TTL:30}));
vi.mock("./today/todayData",()=>({getTodayHub:vi.fn()}));
import {PRODUCTION_ORDER_COLUMNS,readProductionOrders,readOrderForRemake} from "./adminWorkspaceData";
beforeEach(()=>{mocks.fail=false;mocks.range.mockClear();mocks.select.mockImplementation(()=>({order:()=>({range:(from:number,to:number)=>{mocks.range(from,to);return{error:mocks.fail?{message:"private error"}:null,data:Array.from({length:Math.max(0,Math.min(1001,to+1)-from)},(_,i)=>({id:String(from+i)}))};}})}));});
describe("lightweight production loading",()=>{
 it("keeps full fresh artwork for the one order being re-made",async()=>{const id="00000000-0000-4000-8000-000000000001";const order={id,label_image_url:"data:image/png;base64,aGVsbG8=",logo_url:"data:image/png;base64,d29ybGQ=",candy_fill_color:"#112233"};const eq=vi.fn(()=>({maybeSingle:async()=>({data:order,error:null})}));mocks.select.mockImplementationOnce(()=>({eq}));expect(await readOrderForRemake(id)).toBe(order);expect(eq).toHaveBeenCalledWith("id",id);expect(mocks.select).toHaveBeenCalledWith("*");});
 it("does not query an invalid remake id",async()=>{expect(await readOrderForRemake("not-an-id")).toBeNull();expect(mocks.select).not.toHaveBeenCalled();});
 it("omits unused label artwork but retains logo and scheduling/payment fields",()=>{expect(PRODUCTION_ORDER_COLUMNS.split(",")).not.toContain("label_image_url");for(const field of ["logo_url","square_invoice_id","paid_at","refunded_amount","admin_batch_weights_kg"])expect(PRODUCTION_ORDER_COLUMNS.split(",")).toContain(field);});
 it("paginates beyond database caps without dropping historical calendar entries",async()=>{const rows=await readProductionOrders();expect(rows).toHaveLength(1001);expect(mocks.range.mock.calls).toEqual([[0,499],[500,999],[1000,1499]]);expect(rows[0].label_image_url).toBeNull();});
 it("fails rather than showing partial or stale-looking success on a database error",async()=>{mocks.fail=true;await expect(readProductionOrders()).rejects.toThrow("Unable to load production orders");});
});
