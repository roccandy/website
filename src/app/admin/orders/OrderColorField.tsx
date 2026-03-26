"use client";

import {
  COLOR_FORMAT_OPTIONS,
  formatColorInput,
  getContrastTextColor,
  isHexColor,
  parseCmykInput,
  parseHexInput,
  parseRgbInput,
  sanitizeHexInput,
  toHexColor,
  type ColorFormat,
  type ColorOption,
} from "./orderColorUtils";

export type OrderColorFieldProps = {
  label: string;
  name: string;
  value: string;
  selectValue: string;
  options: ColorOption[];
  inputValue: string;
  format: ColorFormat;
  isCustom: boolean;
  isEditing: boolean;
  setValue: (value: string) => void;
  setInputValue: (value: string) => void;
  setFormat: (value: ColorFormat) => void;
  setIsCustom: (value: boolean) => void;
};

export default function OrderColorField({
  label,
  name,
  value,
  selectValue,
  options,
  inputValue,
  format,
  isCustom,
  isEditing,
  setValue,
  setInputValue,
  setFormat,
  setIsCustom,
}: OrderColorFieldProps) {
  const isCustomMode = isCustom;
  const normalized = value.trim();
  const showPreview = !isCustomMode && isHexColor(normalized);
  const placeholder = format === "hex" ? "#000000" : format === "rgb" ? "255, 0, 0" : "0, 100, 100, 0";

  if (!isEditing) {
    const swatchLabel = (() => {
      if (!normalized) return "-";
      if (!normalized.startsWith("#")) return normalized;
      const option = options.find((item) => item.value === normalized.toLowerCase());
      if (option?.label && option.label !== "Custom") return option.label;
      return normalized.toUpperCase();
    })();
    const swatchTextColor = showPreview ? getContrastTextColor(normalized) : "#111827";
    return (
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">{label}</p>
        {showPreview ? (
          <div className="relative mt-1">
            <div
              className="flex h-9 w-full items-center justify-center rounded border border-zinc-200"
              style={{ backgroundColor: normalized }}
            />
            <span
              className="pointer-events-none absolute inset-0 flex items-center justify-center px-2 text-center text-[11px] font-semibold"
              style={{
                color: swatchTextColor,
                textShadow:
                  swatchTextColor === "#ffffff"
                    ? "0 1px 2px rgba(0,0,0,0.55)"
                    : "0 1px 1px rgba(255,255,255,0.55)",
              }}
            >
              {swatchLabel}
            </span>
          </div>
        ) : (
          <p className="mt-1 text-sm text-zinc-900">{swatchLabel}</p>
        )}
      </div>
    );
  }

  return (
    <label className="block text-[11px] uppercase tracking-[0.18em] text-zinc-400">
      {label}
      <select
        value={selectValue}
        onChange={(event) => {
          const next = event.target.value;
          if (!next) {
            setValue("");
            setInputValue("");
            setIsCustom(false);
            return;
          }
          if (next === "custom") {
            const nextValue = toHexColor(value || "#000000");
            setValue(nextValue);
            setInputValue(formatColorInput(nextValue, format));
            setIsCustom(true);
            return;
          }
          setIsCustom(false);
          setValue(next);
          setInputValue(formatColorInput(next, format));
        }}
        className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
      >
        <option value="">Select colour</option>
        <option value="custom">Custom</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <input type="hidden" name={name} value={value} />
      {showPreview && (
        <div
          className="mt-2 h-9 w-full rounded border border-zinc-200"
          style={{ backgroundColor: normalized }}
        />
      )}
      {isCustomMode && (
        <div className="mt-2 space-y-2">
          <input
            type="color"
            value={toHexColor(value)}
            onChange={(event) => {
              const nextValue = toHexColor(event.target.value);
              setValue(nextValue);
              setInputValue(formatColorInput(nextValue, format));
            }}
            className="h-9 w-full cursor-pointer rounded border border-zinc-200 bg-white"
          />
          <input
            type="text"
            value={inputValue}
            onChange={(event) => {
              const raw = event.target.value;
              if (format === "hex") {
                const sanitized = sanitizeHexInput(raw).toLowerCase();
                setInputValue(sanitized);
                const parsed = parseHexInput(sanitized);
                if (parsed) setValue(parsed);
                return;
              }
              setInputValue(raw);
              const parsed = format === "rgb" ? parseRgbInput(raw) : parseCmykInput(raw);
              if (parsed) setValue(parsed);
            }}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
            placeholder={placeholder}
          />
          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Format</div>
          <select
            value={format}
            onChange={(event) => {
              const nextFormat = event.target.value as ColorFormat;
              setFormat(nextFormat);
              setInputValue(formatColorInput(value, nextFormat));
            }}
            className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
          >
            {COLOR_FORMAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </label>
  );
}
