import { redirect } from "next/navigation";
import { listAdminUsers } from "@/lib/adminUsers";
import { requireAdminSession } from "@/lib/adminAuth";
import { addAdminUser, deleteAdminUserAction, resetAdminUserPassword, updateAdminUserAction } from "./actions";

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
        <h1 className="text-3xl font-semibold text-zinc-900">Admin users</h1>
        <p className="text-sm text-zinc-600">Give each person their own password and assign viewer, SEO, editor, or admin access.</p>
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

      <form action={addAdminUser} className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm md:grid-cols-4">
        <label className="space-y-1 text-sm text-zinc-700">
          <span className="text-xs text-zinc-500">Email</span>
          <input type="email" name="email" className="w-full rounded border border-zinc-200 px-3 py-2 text-sm" required />
        </label>
        <label className="space-y-1 text-sm text-zinc-700">
          <span className="text-xs text-zinc-500">Display name</span>
          <input type="text" name="display_name" className="w-full rounded border border-zinc-200 px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1 text-sm text-zinc-700">
          <span className="text-xs text-zinc-500">Password</span>
          <input type="password" name="password" minLength={8} className="w-full rounded border border-zinc-200 px-3 py-2 text-sm" required />
        </label>
        <label className="space-y-1 text-sm text-zinc-700">
          <span className="text-xs text-zinc-500">Role</span>
          <select name="role" defaultValue="editor" className="w-full rounded border border-zinc-200 px-3 py-2 text-sm">
            <option value="viewer">Viewer</option>
            <option value="seo">SEO</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <div className="md:col-span-4">
          <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
            Add user
          </button>
        </div>
      </form>

      <div className="space-y-4">
        {users.map((user) => (
          <div key={user.id} className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm lg:grid-cols-[1.3fr,0.8fr,0.55fr]">
            <form action={updateAdminUserAction} className="grid gap-3 sm:grid-cols-3">
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
              <label className="space-y-1 text-sm text-zinc-700">
                <span className="text-xs text-zinc-500">Role</span>
                <select name="role" defaultValue={user.role} className="w-full rounded border border-zinc-200 px-3 py-2 text-sm">
                  <option value="viewer">Viewer</option>
                  <option value="seo">SEO</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2">
                <input type="checkbox" name="is_active" defaultChecked={user.is_active} />
                Active
              </label>
              <div className="sm:col-span-3">
                <button type="submit" className="rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
                  Save user
                </button>
              </div>
            </form>

            <form action={resetAdminUserPassword} className="space-y-3 rounded-lg border border-zinc-200 p-4">
              <input type="hidden" name="id" value={user.id} />
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Reset password</p>
                <input
                  type="password"
                  name="password"
                  minLength={8}
                  placeholder="New password"
                  className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <button type="submit" className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-400 hover:text-zinc-900">
                Update password
              </button>
            </form>

            <form action={deleteAdminUserAction} className="flex items-start justify-end">
              <input type="hidden" name="id" value={user.id} />
              <button
                type="submit"
                className="rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:border-red-300 hover:text-red-700"
              >
                Delete
              </button>
            </form>
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
