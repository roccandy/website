"use client";

import { useRef, useState } from "react";

const SNIPPETS = [
  { label: "Paragraph", value: "<p>Write paragraph here.</p>" },
  { label: "H2", value: "<h2>Section heading</h2>" },
  { label: "H3", value: "<h3>Supporting heading</h3>" },
  { label: "List", value: "<ul>\n  <li>Point one</li>\n  <li>Point two</li>\n</ul>" },
  { label: "Link", value: '<p><a href="/contact">Link text</a></p>' },
  { label: "Image", value: '<p><img src="https://example.com/image.jpg" alt="Describe the image" /></p>' },
  { label: "FAQ", value: "<p><strong>Question?</strong><br />Answer.</p>" },
  { label: "CTA", value: '<p><a href="/design" class="cta-link">Start designing</a></p>' },
];

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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const insertSnippet = (snippet: string) => {
    if (readOnly || !textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${snippet}${value.slice(end)}`;
    setValue(next);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + snippet.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

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
        {!readOnly ? (
          <div className="flex flex-wrap gap-2">
            {SNIPPETS.map((snippet) => (
              <button
                key={snippet.label}
                type="button"
                onClick={() => insertSnippet(snippet.value)}
                className="rounded border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
              >
                {snippet.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {mode === "edit" ? (
        <textarea
          ref={textareaRef}
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
                max-w-none space-y-4 text-sm leading-relaxed text-zinc-700
                [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-zinc-900
                [&_h3]:mt-4 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-zinc-900
                [&_ul]:list-disc [&_ul]:pl-6
                [&_ol]:list-decimal [&_ol]:pl-6
                [&_a]:font-semibold [&_a]:text-[#ff6f95]
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
