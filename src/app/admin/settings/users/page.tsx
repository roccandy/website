import { redirect } from "next/navigation";
import { listAdminUsers } from "@/lib/adminUsers";
import { requireAdminSession } from "@/lib/adminAuth";
import { addAdminUser, deleteAdminUserAction, resetAdminUserPassword, updateAdminUserAction } from "./actions";
import { AdminSubmitButton } from "@/components/AdminSubmitButton";
import { BirthdayField } from "./BirthdayField";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type SearchParams = { updated?: string } | Promise<{ updated?: string }>;

export default async function AdminUsersPage({ searchParams }: { searchParams?: SearchParams }) {
  const session = await requireAdminSession();
  if (!session.user.canManageUsers) {
    redirect("/admin");
  }

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const users = await listAdminUsers();
  const wasUpdated = resolvedSearchParams?.updated === "1";

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Site settings</p>
        <h1 className="admin-page-title text-zinc-900">Admin users</h1>
        <p className="text-sm text-zinc-600">Give each person their own password and assign viewer, SEO, production, editor, or admin access.</p>
      </div>

      {session.user.isBootstrap ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          You are signed in with the bootstrap env login. Create a permanent admin user below, then sign in with that user.
        </div>
      ) : null}

      {wasUpdated ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Admin users updated.
        </div>
      ) : null}

      <form action={addAdminUser} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Add admin user</h2>
            <p className="text-xs text-zinc-500">Create an account with its own access level and password.</p>
          </div>
          <AdminSubmitButton
            type="submit"
            pendingLabel="Saving..."
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Add user
          </AdminSubmitButton>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-1 text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">Email</span>
            <input type="email" name="email" className="w-full rounded border border-zinc-200 px-3 py-2 text-sm" required />
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">Display name</span>
            <input type="text" name="display_name" className="w-full rounded border border-zinc-200 px-3 py-2 text-sm" />
          </label>
          <BirthdayField />
          <label className="space-y-1 text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">Password</span>
            <input type="password" name="password" minLength={8} className="w-full rounded border border-zinc-200 px-3 py-2 text-sm" required />
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">Role</span>
            <select name="role" defaultValue="editor" className="w-full rounded border border-zinc-200 px-3 py-2 text-sm">
              <option value="viewer">Viewer</option>
              <option value="seo">SEO</option>
              <option value="production">Production</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>
      </form>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">Existing users</h2>
          <span className="text-xs text-zinc-500">{users.length} total</span>
        </div>
        {users.map((user) => (
          <div key={user.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <form action={updateAdminUserAction} className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[minmax(13rem,1.5fr)_minmax(9rem,1fr)_minmax(10rem,1fr)_8rem_auto]">
              <input type="hidden" name="id" value={user.id} />
              <label className="space-y-1 text-sm text-zinc-700">
                <span className="text-xs text-zinc-500">Email</span>
                <input value={user.email} disabled className="w-full rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500" />
              </label>
              <label className="space-y-1 text-sm text-zinc-700">
                <span className="text-xs text-zinc-500">Display name</span>
                <input
                  type="text"
                  name="display_name"
                  defaultValue={user.display_name ?? ""}
                  className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                />
              </label>
              <BirthdayField defaultValue={user.birthday} />
              <label className="space-y-1 text-sm text-zinc-700">
                <span className="text-xs text-zinc-500">Role</span>
                <select name="role" defaultValue={user.role} className="w-full rounded border border-zinc-200 px-3 py-2 text-sm">
                  <option value="viewer">Viewer</option>
                  <option value="seo">SEO</option>
                  <option value="production">Production</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <div className="flex items-center gap-3 pb-1.5">
                <label className="flex items-center gap-2 whitespace-nowrap text-sm text-zinc-700">
                  <input type="checkbox" name="is_active" defaultChecked={user.is_active} />
                  Active
                </label>
                <AdminSubmitButton
                  type="submit"
                  pendingLabel="Saving..."
                  className="rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                >
                  Save user
                </AdminSubmitButton>
              </div>
            </form>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3">
              <details className="group">
                <summary className="cursor-pointer text-xs font-semibold text-zinc-600 hover:text-zinc-900">Reset password</summary>
                <form action={resetAdminUserPassword} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={user.id} />
                  <input
                    type="password"
                    name="password"
                    minLength={8}
                    placeholder="New password"
                    className="w-52 rounded border border-zinc-200 px-3 py-2 text-sm"
                    required
                  />
                  <AdminSubmitButton
                    type="submit"
                    pendingLabel="Updating..."
                    className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-400 hover:text-zinc-900"
                  >
                    Update password
                  </AdminSubmitButton>
                </form>
              </details>

              <form action={deleteAdminUserAction}>
                <input type="hidden" name="id" value={user.id} />
                <button
                  type="submit"
                  className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:border-red-300 hover:text-red-700"
                >
                  Delete user
                </button>
              </form>
            </div>
          </div>
        ))}

        {users.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 shadow-sm">
            No database-backed admin users yet. Create the first one above.
          </div>
        ) : null}
      </div>
    </section>
  );
}
