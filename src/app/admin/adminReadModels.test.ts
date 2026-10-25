import {beforeEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({rpc:vi.fn(),cacheOptions:[] as unknown[],customers:vi.fn(),invoices:vi.fn(),stats:vi.fn(),orders:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("next/cache",()=>({unstable_cache:(fn:unknown,_keys:unknown,options:unknown)=>{m.cacheOptions.push(options);return fn;}}));
vi.mock("@/lib/adminWorkspaceCache",()=>({ADMIN_WORKSPACE_TTL:30,ADMIN_WORKSPACE_TAG:"workspace"}));
vi.mock("@/lib/supabase/admin",()=>({supabaseAdminClient:{rpc:m.rpc}}));
vi.mock("@/lib/customerHistory",()=>({listCustomerSummaries:m.customers}));
vi.mock("./orders/invoices/invoiceData",()=>({getInvoices:m.invoices}));
vi.mock("./stats-v2/statsData",()=>({getStatsDataset:m.stats}));
vi.mock("./adminWorkspaceData",()=>({readProductionOrders:m.orders}));
vi.mock("@/lib/data",()=>({getOrderSlots:vi.fn(),getProductionSlots:vi.fn(),getProductionDayNotes:vi.fn()}));
import {getCachedCustomerTotals,getCachedCustomerList,getCachedInvoices,getCachedStatsDataset} from "./adminReadModels";
beforeEach(()=>m.rpc.mockReset());
describe("admin-wide read models",()=>{
 it("gives the non-Today tabs the same bounded lifetime and invalidation tag",()=>{expect(m.cacheOptions.length).toBeGreaterThanOrEqual(6);for(const options of m.cacheOptions)expect(options).toEqual({revalidate:30,tags:["workspace"]});});
 it("delegates customer, invoice and stats reads without caching role/session decisions",async()=>{await getCachedCustomerList({query:"candy",limit:50});await getCachedInvoices();await getCachedStatsDataset();expect(m.customers).toHaveBeenCalledWith({query:"candy",limit:50});expect(m.invoices).toHaveBeenCalled();expect(m.stats).toHaveBeenCalled();});
 it("gets customer totals from a database aggregate rather than reading all profiles",async()=>{m.rpc.mockResolvedValue({data:{totalCustomers:20000},error:null});expect((await getCachedCustomerTotals()).data.totalCustomers).toBe(20000);expect(m.rpc).toHaveBeenCalledWith("admin_customer_totals");});
 it("does not cache fabricated success when the aggregate fails",async()=>{m.rpc.mockResolvedValue({data:null,error:{message:"private"}});await expect(getCachedCustomerTotals()).rejects.toThrow("Unable to load customer totals");});
});
