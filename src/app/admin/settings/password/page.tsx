import { requireAdminSession } from "@/lib/adminAuth";
import { changeOwnPasswordAction } from "./actions";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function AdminPasswordPage() {
  const session = await requireAdminSession();

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Site settings</p>
        <h1 className="text-3xl font-semibold text-zinc-900">My password</h1>
        <p className="text-sm text-zinc-600">Change the password for your own admin account.</p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm md:max-w-xl">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Signed-in account</p>
          <p className="text-sm font-semibold text-zinc-900">
            {session.user.name?.trim() || session.user.email?.trim() || "Admin user"}
          </p>
          {session.user.email ? <p className="text-sm text-zinc-600">{session.user.email}</p> : null}
        </div>
      </div>

      {session.user.isBootstrap ? (
        <div className="max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-sm">
          <p className="font-semibold">Bootstrap env login detected</p>
          <p className="mt-2 leading-relaxed text-amber-800">
            This temporary login uses the password stored in your environment variables, so it cannot be changed from
            inside the admin panel. Create a normal admin user in <span className="font-semibold">Admin Users</span>,
            then sign in with that account to manage your password here.
          </p>
        </div>
      ) : (
        <form action={changeOwnPasswordAction} className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm md:max-w-xl">
          <label className="space-y-1 text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">Current password</span>
            <input
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">New password</span>
            <input
              type="password"
              name="newPassword"
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">Confirm new password</span>
            <input
              type="password"
              name="confirmPassword"
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              required
            />
          </label>
          <div>
            <button
              type="submit"
              className="rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Update password
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
