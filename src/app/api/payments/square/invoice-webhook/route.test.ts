import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({update:vi.fn(),invalidate:vi.fn(),lookup:vi.fn(),from:vi.fn()}));
vi.mock("@/lib/supabase/admin",()=>({supabaseAdminClient:{from:mocks.from}}));
vi.mock("@/lib/email",()=>({getOrdersRecipients:()=>[],sendOrderEmail:vi.fn()}));
vi.mock("@/lib/refunds",()=>({resolveSquareInvoicePaymentId:mocks.lookup}));
vi.mock("@/lib/adminWorkspaceCache",()=>({invalidateAdminWorkspace:mocks.invalidate}));
import {POST} from "./route";
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("SQUARE_INVOICE_WEBHOOK_SIGNATURE_KEY","test-key");vi.stubEnv("SQUARE_INVOICE_WEBHOOK_URL","https://local.test/webhook");mocks.lookup.mockResolvedValue({paymentId:"payment-1"});mocks.update.mockReturnValue({in:vi.fn().mockResolvedValue({error:null})});mocks.from.mockReturnValue({select:()=>({eq:vi.fn().mockResolvedValue({data:[{id:"order-1",paid_at:null,status:"scheduled"}],error:null})}),update:mocks.update});});
afterEach(()=>vi.unstubAllEnvs());
function request(status:string){const body=JSON.stringify({type:"invoice.payment_made",created_at:"2026-10-25T02:00:00Z",data:{object:{invoice:{id:"invoice-1",status,version:4}}}});const signature=createHmac("sha256","test-key").update("https://local.test/webhook"+body).digest("base64");return new Request("https://local.test/webhook",{method:"POST",body,headers:{"x-square-hmacsha256-signature":signature}});}
describe("Square payment reconciliation",()=>{
 it("marks full payment without resetting scheduling/completion status",async()=>{expect((await POST(request("PAID"))).status).toBe(200);expect(mocks.update.mock.calls[0][0]).toMatchObject({paid_at:"2026-10-25T02:00:00Z",square_invoice_status:"PAID"});expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("status");expect(mocks.invalidate).toHaveBeenCalled();});
 it.each(["PARTIALLY_PAID","PAYMENT_PENDING"])("does not mark %s paid",async status=>{expect((await POST(request(status))).status).toBe(200);expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("paid_at");expect(mocks.lookup).not.toHaveBeenCalled();});
 it("rejects unsigned requests before any database access",async()=>{expect((await POST(new Request("https://local.test/webhook",{method:"POST",body:"{}"}))).status).toBe(401);expect(mocks.from).not.toHaveBeenCalled();});
});
