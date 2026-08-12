"use client";

import { useState } from "react";

export function BirthdayField({ defaultValue = "" }: { defaultValue?: string | null }) {
  const [birthday, setBirthday] = useState(defaultValue ?? "");

  return (
    <label className="space-y-1 text-sm text-zinc-700">
      <span className="text-xs text-zinc-500">Birthday</span>
      <div className="flex items-center gap-2">
        <input
          type="date"
          name="birthday"
          value={birthday}
          onChange={(event) => setBirthday(event.target.value)}
          className="min-w-0 flex-1 rounded border border-zinc-200 px-3 py-2 text-sm"
        />
        {birthday ? (
          <button
            type="button"
            onClick={() => setBirthday("")}
            className="shrink-0 rounded border border-zinc-200 px-2 py-2 text-xs font-semibold text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
          >
            Clear
          </button>
        ) : null}
      </div>
      {!birthday ? <span className="block text-[11px] text-zinc-500">None set</span> : null}
    </label>
  );
}
