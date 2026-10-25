import {describe,expect,it} from "vitest";
import {adminTabKey,cleanAdminLocation,isAdminReadView,isAdminWriteForm} from "./adminRoutePolicy";
describe("shared admin navigation policy",()=>{
 it("never mistakes a hydrated React save form for a GET search form",()=>{expect(isAdminWriteForm("get","javascript:throw new Error('React server action')")).toBe(true);expect(isAdminWriteForm("get","",true)).toBe(true);expect(isAdminWriteForm("post","/admin/settings")).toBe(true);expect(isAdminWriteForm("get","/admin/orders/archived")).toBe(false);});
 it.each(["/admin","/admin/orders/archived?page=3","/admin/customers?q=Joe","/admin/orders/invoices","/admin/stats-v2","/admin/settings/faqs","/admin/flavors"])("warms read view %s",href=>expect(isAdminReadView(href)).toBe(true));
 it.each(["/checkout","/admin/login","/admin/orders/new","/admin/orders/order-1?edit=1","/admin/orders/order-1/invoice?edit=1","/admin/settings/password","/admin/settings/users","https://other.test/admin"])("does not warm entry/edit/non-admin view %s",href=>expect(isAdminReadView(href)).toBe(false));
 it("remembers list/tool views, not a customer's or order's detail URL as the tab",()=>{expect(adminTabKey("/admin/orders/archived?page=2")).toBe("/admin/orders/archived");expect(adminTabKey("/admin/customers/customer-id")).toBeNull();expect(adminTabKey("/admin/settings/faqs")).toBe("/admin/settings/faqs");expect(adminTabKey("https://other.test/admin")).toBeNull();});
 it("preserves all view parameters but drops one-off toast text",()=>expect(cleanAdminLocation("/admin/orders/archived?view=uncompleted&page=2&q=candy&toast=success&message=Saved")).toBe("/admin/orders/archived?page=2&q=candy&view=uncompleted"));
});
