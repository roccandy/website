import { beforeEach, describe, expect, it, vi } from "vitest";
const { access, session, from } = vi.hoisted(()=>({access:vi.fn(),session:vi.fn(),from:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/adminRevalidation",()=>({revalidateAdminPath:vi.fn()}));
vi.mock("@/lib/adminAuth",()=>({requireAdminWriteAccess:access,requireAdminSession:session}));
vi.mock("@/lib/supabase/admin",()=>({supabaseAdminClient:{from}}));
import { claimOrderDraft, completeOrderDraft, releaseOrderDraft } from "../adminOrderDraftStore";
import { orderDraftSourceFingerprint } from "../adminOrderDrafts";
import type { OrderRow } from "../data";
const id="77777777-7777-4777-8777-777777777777";
const payload={schemaVersion:1,orders:[{id:"one",fields:{},batchWeights:[]}],activeOrderId:"one"};
function query(result:unknown){const q:{[key:string]:ReturnType<typeof vi.fn>}={}; for(const name of ["select","eq","is","not","update"])q[name]=vi.fn().mockImplementation(()=>q);q.maybeSingle=vi.fn().mockResolvedValue(result);q.single=vi.fn().mockResolvedValue(result);q.then=vi.fn().mockImplementation((resolve)=>Promise.resolve(result).then(resolve));return q;}
function form(source?:string){const f=new FormData();f.set("order_draft_id",id);f.set("order_draft_revision","2");if(source)f.set("id",source);return f;}
describe("draft publication guard",()=>{
 beforeEach(()=>{access.mockResolvedValue({user:{canWrite:true}});session.mockResolvedValue({user:{canWrite:true}});});
 it("leaves ordinary saves alone after checking write access",async()=>{expect(await claimOrderDraft(new FormData())).toBeNull();expect(access).toHaveBeenCalled();expect(from).not.toHaveBeenCalled();});
 it.each([{completed_at:"now"},{discarded_at:"now"},{publishing_at:"now"}])("blocks already submitted/discarded/in-progress drafts: %j",async(status)=>{from.mockReturnValue(query({data:{id,revision:2,source_order_id:null,payload,...status},error:null}));await expect(claimOrderDraft(form())).rejects.toThrow();expect(from).toHaveBeenCalledTimes(1);});
 it("atomically claims the expected revision and rejects a competing submission",async()=>{const saved=query({data:{id,revision:2,source_order_id:null,payload},error:null});const claim=query({data:null,error:null});from.mockReturnValueOnce(saved).mockReturnValueOnce(claim);await expect(claimOrderDraft(form())).rejects.toThrow("another tab");expect(claim.eq).toHaveBeenCalledWith("revision",2);expect(claim.is).toHaveBeenCalledWith("publishing_at",null);});
 it("blocks a stale live-order snapshot before taking a publication lock",async()=>{const source={id:"source",title:"Original",status:"unassigned"} as OrderRow;from.mockReturnValueOnce(query({data:{id,revision:2,source_order_id:"source",source_fingerprint:orderDraftSourceFingerprint(source),payload},error:null})).mockReturnValueOnce(query({data:{...source,status:"scheduled"},error:null}));await expect(claimOrderDraft(form("source"))).rejects.toThrow("live order has changed");expect(from).toHaveBeenCalledTimes(2);});
 it("never releases a draft after orders have been saved, even when completion fails",async()=>{const claim={id,persisted:false};const q=query({error:{message:"Network lost"}});from.mockReturnValue(q);await expect(completeOrderDraft(claim,["order-one"])).rejects.toThrow("order was saved");expect(claim.persisted).toBe(true);from.mockClear();await releaseOrderDraft(claim);expect(from).not.toHaveBeenCalled();});
 it("releases a claim after validation failure before a business write",async()=>{const q=query({error:null});from.mockReturnValue(q);await releaseOrderDraft({id,persisted:false});expect(q.update).toHaveBeenCalledWith({publishing_at:null});});
});
