import { beforeEach, describe, expect, it, vi } from "vitest";
const {access,rpc,from,activity,revalidate}=vi.hoisted(()=>({access:vi.fn(),rpc:vi.fn(),from:vi.fn(),activity:vi.fn(),revalidate:vi.fn()}));
vi.mock("@/lib/adminAuth",()=>({requireAdminWriteAccess:access}));
vi.mock("@/lib/supabase/admin",()=>({supabaseAdminClient:{rpc,from}}));
vi.mock("@/lib/adminActivity",()=>({logAdminActivity:activity}));
vi.mock("@/lib/adminRevalidation",()=>({revalidateAdminPath:revalidate}));
import { saveOrderDraft, discardOrderDraft } from "./draftActions";
const input=()=>({id:"77777777-7777-4777-8777-777777777777",revision:0,sourceOrderId:null,sourceFingerprint:null,payload:{schemaVersion:1,shared:{customer_email:""},orders:[{id:"one",fields:{title:"Incomplete",notes:"Private"},batchWeights:[]}],activeOrderId:"one"}});
describe("private order draft actions",()=>{
  beforeEach(()=>{access.mockResolvedValue({user:{email:"admin@example.test"}});rpc.mockResolvedValue({data:{id:input().id,revision:1,updated_at:"now",title:"Incomplete"},error:null});});
  it("requires write access before any database access",async()=>{access.mockRejectedValue(new Error("Read only"));expect(await saveOrderDraft(input())).toEqual({ok:false,error:"Read only"});expect(rpc).not.toHaveBeenCalled();expect(from).not.toHaveBeenCalled();});
  it("saves incomplete details through the draft RPC without creating or changing an order",async()=>{const result=await saveOrderDraft(input());expect(result.ok).toBe(true);expect(from).not.toHaveBeenCalled();expect(rpc).toHaveBeenCalledWith("save_admin_order_draft",expect.objectContaining({p_revision:0,p_source_order_id:null,p_actor:"admin@example.test"}));expect(activity).toHaveBeenCalledWith(expect.objectContaining({entityType:"order-draft",action:"saved"}));});
  it("keeps conflicts visible instead of reporting a save",async()=>{rpc.mockResolvedValue({data:null,error:{message:"Draft changed in another tab"}});expect(await saveOrderDraft({...input(),revision:1})).toEqual({ok:false,error:"Draft changed in another tab"});expect(activity).not.toHaveBeenCalled();});
  it("reports an existing live-order draft without overwriting it",async()=>{rpc.mockResolvedValue({data:null,error:{code:"23505"}});const result=await saveOrderDraft(input());expect(!result.ok&&result.error).toContain("already has a saved draft");});
  it("guards discard by revision and publishing state and only updates the draft table",async()=>{const query={eq:vi.fn(),is:vi.fn(),select:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data:{id:input().id},error:null})};query.eq.mockReturnValue(query);query.is.mockReturnValue(query);query.select.mockReturnValue(query);const update=vi.fn().mockReturnValue(query);from.mockReturnValue({update});expect((await discardOrderDraft(input().id,4)).ok).toBe(true);expect(from).toHaveBeenCalledWith("admin_order_drafts");expect(query.eq).toHaveBeenCalledWith("revision",4);expect(query.is).toHaveBeenCalledWith("publishing_at",null);expect(update).toHaveBeenCalledWith(expect.objectContaining({discarded_at:expect.any(String)}));});
});
