import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
vi.mock("../actions",()=>({upsertOrder:vi.fn(),upsertOrderInline:vi.fn()}));
vi.mock("../draftActions",()=>({saveOrderDraft:vi.fn(),discardOrderDraft:vi.fn()}));
vi.mock("@/app/admin/design/OrderDesignStudio",()=>({OrderDesignStudio:()=>null}));
vi.mock("../../AdminNavigationFeedback",()=>({useAdminNavigation:()=>null,AdminLink:({href,children,...props}:ComponentProps<"a">)=><a href={href} {...props}>{children}</a>}));
import { NewOrderForm } from "./NewOrderForm";
import { draftFormOrderDefaults, parseAdminOrderDraftPayload, type AdminOrderDraft } from "@/lib/adminOrderDrafts";
const draft={id:"77777777-7777-4777-8777-777777777777",revision:3,source_order_id:null,updated_at:"2026-11-07T12:00:00Z",payload:parseAdminOrderDraftPayload({schemaVersion:1,shared:{first_name:"Ada",customer_email:""},orders:[{id:"one",fields:{title:"Ada mockup",category_id:"custom-7-14",design_text:"ADA",quantity:"",notes:"Keep my production notes",order_weight_g:""},batchWeights:["","2"]},{id:"two",fields:{title:"Second design"},batchWeights:[]}],activeOrderId:"one"})} as AdminOrderDraft;
const props={categories:[{id:"custom-7-14",name:"Custom candy"}],packagingOptions:[],flavors:[],palette:[],premadeCandies:[],settings:{},orders:[],slots:[],assignments:[]} as unknown as ComponentProps<typeof NewOrderForm>;
describe("resumed draft form",()=>{
 it("renders unsent status, the saved title, notes and both tabs with incomplete quantity intact",()=>{
  const html=renderToStaticMarkup(<NewOrderForm {...props} initialDraft={draft} initialOrder={draftFormOrderDefaults(draft)} />);
  expect(html).toContain("Draft order saved — not sent to customer");
  expect(html).toContain('name="title"'); expect(html).toContain('value="Ada mockup"');
  expect(html).toContain("Keep my production notes");expect(html).toContain("Second design");
  expect(html).toContain('name="order_draft_revision" value="3"');
  expect(html).toContain("Save draft"); expect(html).toContain("Discard draft");
  expect(html).not.toContain('name="order_draft_state"');
 });
});
