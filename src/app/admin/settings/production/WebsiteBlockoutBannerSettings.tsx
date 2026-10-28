"use client";

import { useState } from "react";
import { AdminSubmitButton } from "@/components/AdminSubmitButton";

type Props = {
  enabled: boolean;
  months: number;
  action: (formData: FormData) => void | Promise<void>;
};

export function WebsiteBlockoutBannerSettings({ enabled, months, action }: Props) {
  const [showBanner, setShowBanner] = useState(enabled);

  return (
    <form action={action} className="space-y-3">
      <label className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
        <input
          type="checkbox"
          name="show_quote_blockout_banner"
          checked={showBanner}
          onChange={(event) => setShowBanner(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
        />
        <span>
          <span className="block font-semibold text-zinc-900">Show an availability notice on the website</span>
          <span className="mt-0.5 block text-xs text-zinc-500">
            Shows a delivery-paused or delivery-resumes message for saved production blocks. It does not change which dates are available.
          </span>
        </span>
      </label>
      {!showBanner ? <input type="hidden" name="quote_blockout_months" value={months} /> : null}
      {showBanner ? (
        <div className="grid gap-3 md:grid-cols-[260px_auto] md:items-end">
          <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Start showing the notice this many months before a block begins
            <input
              type="number"
              name="quote_blockout_months"
              min={1}
              max={12}
              defaultValue={months}
              className="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-sm"
              required
            />
          </label>
          <p className="text-xs leading-5 text-zinc-500">The notice appears for any saved block that begins within this window, and remains visible during the block.</p>
        </div>
      ) : null}
      <AdminSubmitButton
        type="submit"
        pendingLabel="Saving..."
        className="rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
      >
        Save website notice
      </AdminSubmitButton>
    </form>
  );
}
