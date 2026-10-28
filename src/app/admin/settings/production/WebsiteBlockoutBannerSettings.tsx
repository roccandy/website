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
    <form data-protect-unsaved action={action} className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          name="show_quote_blockout_banner"
          checked={showBanner}
          onChange={(event) => setShowBanner(event.target.checked)}
          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
        />
        <span className="font-medium text-zinc-900">Show website delivery notice</span>
      </label>
      {!showBanner ? <input type="hidden" name="quote_blockout_months" value={months} /> : null}
      {showBanner ? (
        <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
            <span>Show from</span>
            <input
              type="number"
              name="quote_blockout_months"
              min={1}
              max={12}
              defaultValue={months}
              className="h-10 w-16 rounded border border-zinc-200 px-2 text-sm"
              required
            />
            <span>months before</span>
          </label>
      ) : null}
      <AdminSubmitButton
        type="submit"
        pendingLabel="Saving..."
        className="h-10 rounded-md border border-zinc-900 bg-zinc-900 px-4 text-xs font-semibold text-white hover:bg-zinc-800"
      >
        Save notice
      </AdminSubmitButton>
    </form>
  );
}
