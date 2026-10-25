import {describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({path:vi.fn(),expire:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:mocks.path}));
vi.mock("../adminWorkspaceCache",()=>({invalidateAdminWorkspace:mocks.expire}));
import {revalidateAdminPath} from "../adminRevalidation";
describe("admin-wide save invalidation",()=>{it.each(["/admin/customers","/admin/packaging","/admin/settings/faqs","/admin/orders"])("refreshes related data and router entries for %s",path=>{revalidateAdminPath(path);expect(mocks.expire).toHaveBeenCalled();expect(mocks.path).toHaveBeenCalledWith(path,undefined);});});
