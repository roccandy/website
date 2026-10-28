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
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="flex items-start gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          name="show_quote_blockout_banner"
          checked={showBanner}
          onChange={(event) => setShowBanner(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
        />
        <span><span className="font-medium text-zinc-900">Show website delivery notice</span><span className="ml-1 text-xs text-zinc-500">(does not change availability)</span></span>
      </label>
      {!showBanner ? <input type="hidden" name="quote_blockout_months" value={months} /> : null}
      {showBanner ? (
        <label className="w-40 text-xs font-medium text-zinc-700">
            Show from (months before)
            <input
              type="number"
              name="quote_blockout_months"
              min={1}
              max={12}
              defaultValue={months}
              className="mt-1 w-full rounded border border-zinc-200 px-2 py-1.5 text-sm"
              required
            />
          </label>
      ) : null}
      <AdminSubmitButton
        type="submit"
        pendingLabel="Saving..."
        className="rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
      >
        Save notice
      </AdminSubmitButton>
    </form>
  );
}
