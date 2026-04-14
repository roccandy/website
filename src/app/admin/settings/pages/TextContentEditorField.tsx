"use client";

import { useRef, useState } from "react";
import { CUSTOM_INTERNAL_LINK_VALUE, INTERNAL_LINK_OPTIONS } from "@/lib/internalLinkOptions";
import {
  convertHtmlToTextContent,
  renderTextContentToHtml,
  type TextContentIssue,
} from "@/lib/textContentEditor";

type Props = {
  name: string;
  defaultHtml: string;
  rows?: number;
  readOnly?: boolean;
  placeholder?: string;
  form?: string;
};

type LinkComposerMode = "internal" | "external";

type LinkComposerState = {
  mode: LinkComposerMode;
  label: string;
  href: string;
  useCustomInternalPath: boolean;
};

type SelectionRange = {
  start: number;
  end: number;
};

function ToolbarButton({
  label,
  onClick,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function normalizeInternalPath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/") || trimmed.startsWith("#") || trimmed.startsWith("?")) return trimmed;
  return `/${trimmed.replace(/^\/+/, "")}`;
}

export function TextContentEditorField({
  name,
  defaultHtml,
  rows = 12,
  readOnly = false,
  placeholder,
  form,
}: Props) {
  const [value, setValue] = useState(() => convertHtmlToTextContent(defaultHtml));
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [linkComposer, setLinkComposer] = useState<LinkComposerState | null>(null);
  const [selectionRange, setSelectionRange] = useState<SelectionRange>({ start: 0, end: 0 });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const preview = renderTextContentToHtml(value);

  function rememberSelection() {
    const element = textareaRef.current;
    if (!element) return { start: 0, end: 0 };
    const nextRange = {
      start: element.selectionStart ?? 0,
      end: element.selectionEnd ?? 0,
    };
    setSelectionRange(nextRange);
    return nextRange;
  }

  function replaceRange(nextText: string, start: number, end: number, nextCursorStart?: number, nextCursorEnd?: number) {
    const updated = `${value.slice(0, start)}${nextText}${value.slice(end)}`;
    setValue(updated);
    setLinkComposer(null);

    requestAnimationFrame(() => {
      const element = textareaRef.current;
      if (!element) return;
      element.focus();
      const selectionStart = nextCursorStart ?? start + nextText.length;
      const selectionEnd = nextCursorEnd ?? selectionStart;
      element.setSelectionRange(selectionStart, selectionEnd);
      setSelectionRange({ start: selectionStart, end: selectionEnd });
    });
  }

  function wrapSelection(prefix: string, suffix: string, placeholderText: string) {
    const range = rememberSelection();
    const selected = value.slice(range.start, range.end);
    const replacement = `${prefix}${selected || placeholderText}${suffix}`;
    const selectionStart = range.start + prefix.length;
    const selectionEnd = selectionStart + (selected || placeholderText).length;
    replaceRange(replacement, range.start, range.end, selectionStart, selectionEnd);
  }

  function prefixSelectedLines(prefixer: (line: string, index: number) => string) {
    const range = rememberSelection();
    const segment = value.slice(range.start, range.end);
    const segmentStart = value.lastIndexOf("\n", Math.max(0, range.start - 1)) + 1;
    const segmentEndCandidate = value.indexOf("\n", range.end);
    const segmentEnd = segmentEndCandidate === -1 ? value.length : segmentEndCandidate;
    const lineSlice = value.slice(segmentStart, segmentEnd);
    const lines = (segment || lineSlice).split("\n");
    const transformed = lines.map((line, index) => {
      if (!line.trim()) return line;
      return prefixer(line.trimStart(), index);
    });
    replaceRange(transformed.join("\n"), segmentStart, segmentEnd);
  }

  function insertParagraphBreak() {
    const range = rememberSelection();
    replaceRange("\n\n", range.start, range.end);
  }

  function openLinkComposer(mode: LinkComposerMode) {
    const range = rememberSelection();
    const selected = value.slice(range.start, range.end).trim();
    const defaultInternalHref = INTERNAL_LINK_OPTIONS[0]?.href ?? "/";
    setLinkComposer({
      mode,
      label: selected,
      href: mode === "internal" ? defaultInternalHref : "https://",
      useCustomInternalPath: false,
    });
  }

  function insertLink() {
    if (!linkComposer) return;
    const label = linkComposer.label.trim() || "Link text";
    const href =
      linkComposer.mode === "internal"
        ? linkComposer.useCustomInternalPath
          ? normalizeInternalPath(linkComposer.href)
          : linkComposer.href
        : linkComposer.href.trim();
    const range = selectionRange;
    replaceRange(`[${label}](${href})`, range.start, range.end);
  }

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
        <p className="text-xs text-zinc-500">New lines stay as new lines on the site.</p>
      </div>

      {!readOnly ? (
        <>
          <div className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <ToolbarButton label="H2" onClick={() => prefixSelectedLines((line) => `## ${line.replace(/^#{1,3}\s+/, "")}`)} />
            <ToolbarButton label="H3" onClick={() => prefixSelectedLines((line) => `### ${line.replace(/^#{1,3}\s+/, "")}`)} />
            <ToolbarButton label="Bold" onClick={() => wrapSelection("**", "**", "Bold text")} />
            <ToolbarButton label="Bullets" onClick={() => prefixSelectedLines((line) => `- ${line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "")}`)} />
            <ToolbarButton label="Numbers" onClick={() => prefixSelectedLines((line, index) => `${index + 1}. ${line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "")}`)} />
            <ToolbarButton label="Internal link" onClick={() => openLinkComposer("internal")} />
            <ToolbarButton label="Link" onClick={() => openLinkComposer("external")} />
            <ToolbarButton label="New paragraph" onClick={insertParagraphBreak} />
          </div>

          {linkComposer ? (
            <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 md:grid-cols-[1fr_1fr_auto]">
              <label className="space-y-1 text-sm text-zinc-700">
                <span className="text-xs text-zinc-500">Link text</span>
                <input
                  type="text"
                  value={linkComposer.label}
                  onChange={(event) => setLinkComposer({ ...linkComposer, label: event.target.value })}
                  className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 text-sm text-zinc-700">
                <span className="text-xs text-zinc-500">
                  {linkComposer.mode === "internal" ? "Internal path" : "Link destination"}
                </span>
                {linkComposer.mode === "internal" ? (
                  <div className="space-y-2">
                    <select
                      value={linkComposer.useCustomInternalPath ? CUSTOM_INTERNAL_LINK_VALUE : linkComposer.href}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (nextValue === CUSTOM_INTERNAL_LINK_VALUE) {
                          setLinkComposer({
                            ...linkComposer,
                            useCustomInternalPath: true,
                            href: linkComposer.useCustomInternalPath ? linkComposer.href : "",
                          });
                          return;
                        }

                        setLinkComposer({
                          ...linkComposer,
                          useCustomInternalPath: false,
                          href: nextValue,
                        });
                      }}
                      className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                    >
                      {INTERNAL_LINK_OPTIONS.map((option) => (
                        <option key={option.href} value={option.href}>
                          {option.label}
                        </option>
                      ))}
                      <option value={CUSTOM_INTERNAL_LINK_VALUE}>Custom path…</option>
                    </select>

                    {linkComposer.useCustomInternalPath ? (
                      <input
                        type="text"
                        value={linkComposer.href}
                        onChange={(event) => setLinkComposer({ ...linkComposer, href: event.target.value })}
                        placeholder="/design"
                        className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                      />
                    ) : null}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={linkComposer.href}
                    onChange={(event) => setLinkComposer({ ...linkComposer, href: event.target.value })}
                    placeholder="https://example.com"
                    className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                  />
                )}
              </label>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={insertLink}
                  className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                >
                  Insert
                </button>
                <button
                  type="button"
                  onClick={() => setLinkComposer(null)}
                  className="rounded border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-600 hover:border-zinc-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {preview.issues.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Formatting needs attention</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-amber-800">
            {preview.issues.map((issue: TextContentIssue) => (
              <li key={`${issue.line}-${issue.message}`}>Line {issue.line}: {issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs leading-relaxed text-zinc-500">
        Use plain text here. Supported formatting: <span className="font-semibold">H2</span>, <span className="font-semibold">H3</span>, <span className="font-semibold">bold</span>, bullet lists, numbered lists, internal links, and regular links. You can also type <span className="font-mono">## Heading</span>, <span className="font-mono">**bold**</span>, <span className="font-mono">- list item</span>, or <span className="font-mono">[Link text](/page-path)</span> directly.
      </p>

      {mode === "edit" ? (
        <textarea
          ref={textareaRef}
          form={form}
          name={name}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyUp={rememberSelection}
          onMouseUp={rememberSelection}
          onSelect={rememberSelection}
          rows={rows}
          readOnly={readOnly}
          placeholder={placeholder}
          className="w-full rounded border border-zinc-200 px-3 py-2 text-sm leading-relaxed"
        />
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          {preview.html ? (
            <div
              className="site-rich-content space-y-4 text-sm leading-relaxed [&_img]:max-h-56 [&_img]:rounded-lg"
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />
          ) : (
            <p className="text-sm text-zinc-500">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
