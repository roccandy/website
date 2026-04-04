"use client";

import { useState } from "react";

type Props = {
  name: string;
  defaultValue: string;
  rows?: number;
  readOnly?: boolean;
  placeholder?: string;
};

export function HtmlEditorField({
  name,
  defaultValue,
  rows = 12,
  readOnly = false,
  placeholder,
}: Props) {
  const [value, setValue] = useState(defaultValue);
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("edit")}
            className={`rounded border px-3 py-1 text-xs font-semibold ${mode === "edit" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 text-zinc-600 hover:border-zinc-300"}`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={`rounded border px-3 py-1 text-xs font-semibold ${mode === "preview" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 text-zinc-600 hover:border-zinc-300"}`}
          >
            Preview
          </button>
        </div>
      </div>
      <p className="text-xs text-zinc-500">Use `H2` and `H3` only here. The page `H1` is already provided by the site template.</p>

      {mode === "edit" ? (
        <textarea
          name={name}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={rows}
          readOnly={readOnly}
          placeholder={placeholder}
          className="w-full rounded border border-zinc-200 px-3 py-2 font-mono text-sm"
        />
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          {value.trim() ? (
            <div
              className="
                site-rich-content
                space-y-4 text-sm leading-relaxed
                [&_img]:max-h-56 [&_img]:rounded-lg
              "
              dangerouslySetInnerHTML={{ __html: value }}
            />
          ) : (
            <p className="text-sm text-zinc-500">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
