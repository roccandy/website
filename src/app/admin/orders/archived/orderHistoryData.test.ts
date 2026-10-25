import {beforeEach,describe,expect,it,vi} from "vitest";
const rpc=vi.hoisted(()=>vi.fn());
vi.mock("server-only",()=>({}));
vi.mock("next/cache",()=>({unstable_cache:(fn:unknown)=>fn}));
vi.mock("@/lib/supabase/admin",()=>({supabaseAdminClient:{rpc}}));
vi.mock("@/lib/adminWorkspaceCache",()=>({ADMIN_WORKSPACE_TAG:"test",ADMIN_WORKSPACE_TTL:30}));
import {getOrderHistoryPage} from "./orderHistoryData";
beforeEach(()=>rpc.mockReset());
describe("database-paged order history",()=>{
 it("passes filters/sort to the database and requests only 50 complete groups",async()=>{rpc.mockResolvedValue({data:{orders:[],slots:[],assignments:[],groupKeys:[],total:1200,page:2,pageSize:50},error:null});const data=await getOrderHistoryPage("uncompleted","customer","asc","candy",2);expect(data.total).toBe(1200);expect(rpc).toHaveBeenCalledWith("admin_order_history_page",{p_view:"uncompleted",p_sort:"customer",p_direction:"asc",p_query:"candy",p_page:2,p_page_size:50});});
 it("bounds search input",async()=>{rpc.mockResolvedValue({data:{orders:[]},error:null});await getOrderHistoryPage("all","order","desc","x".repeat(500),1);expect(rpc.mock.calls[0][1].p_query).toHaveLength(200);});
 it("does not fall back to downloading every order when the query fails",async()=>{rpc.mockResolvedValue({data:null,error:{message:"private database details"}});await expect(getOrderHistoryPage("all","order","desc","",1)).rejects.toThrow("Unable to load order history");expect(rpc).toHaveBeenCalledTimes(1);});
});
