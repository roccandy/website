"use client";

import { useRef } from "react";
import type { ColorPaletteRow } from "@/lib/data";
import { paletteSections } from "@/app/admin/settings/palette";

export type PaletteOption = {
  id: string;
  label: string;
  hex: string;
};

export type PaletteGroup = {
  title: string;
  options: PaletteOption[];
};

export type Cmyk = {
  c: number;
  m: number;
  y: number;
  k: number;
};

export type Rgba = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export function getPaletteHex(
  palette: ColorPaletteRow[],
  category: string,
  shade: string,
  fallback: string,
) {
  const found = palette.find((row) => row.category === category && row.shade === shade);
  return found?.hex ?? fallback;
}

export function buildPaletteGroups(palette: ColorPaletteRow[]): PaletteGroup[] {
  const lookup = new Map(palette.map((row) => [`${row.category}:${row.shade}`, row.hex]));
  return paletteSections.map((section) => ({
    title: section.title,
    options: section.items.map((item) => ({
      id: item.name,
      label: item.label,
      hex: lookup.get(`${item.categoryKey}:${item.shadeKey}`) ?? item.defaultValue,
    })),
  }));
}

function clampChannel(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function clampByte(value: number) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function clampAlpha(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

export { clampByte, clampChannel };

export function hexToCmyk(hex: string): Cmyk | null {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const k = 1 - Math.max(r, g, b);
  if (k === 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }
  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);
  return {
    c: clampChannel(c * 100),
    m: clampChannel(m * 100),
    y: clampChannel(y * 100),
    k: clampChannel(k * 100),
  };
}

export function hexToRgba(hex: string, alpha = 1): Rgba | null {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
    a: clampAlpha(alpha),
  };
}

export function cmykToHex(cmyk: Cmyk): string {
  const c = clampChannel(cmyk.c) / 100;
  const m = clampChannel(cmyk.m) / 100;
  const y = clampChannel(cmyk.y) / 100;
  const k = clampChannel(cmyk.k) / 100;
  const r = Math.round(255 * (1 - c) * (1 - k));
  const g = Math.round(255 * (1 - m) * (1 - k));
  const b = Math.round(255 * (1 - y) * (1 - k));
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function rgbaToHex(rgba: Rgba): string {
  const r = clampByte(rgba.r);
  const g = clampByte(rgba.g);
  const b = clampByte(rgba.b);
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function normalizeHex(value: string, fallback: string) {
  const raw = value.trim().toLowerCase();
  if (!raw) return fallback;
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  if (/^#[0-9a-f]{3}$/.test(withHash)) {
    const [, r, g, b] = withHash;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^#[0-9a-f]{6}$/.test(withHash)) {
    return withHash;
  }
  return fallback;
}

export function parseHexInput(value: string): string | null {
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  if (/^#[0-9a-f]{3}$/.test(withHash)) {
    const [, r, g, b] = withHash;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^#[0-9a-f]{6}$/.test(withHash)) {
    return withHash;
  }
  return null;
}

export function sanitizeHexInput(value: string): string {
  const stripped = value.replace(/#/g, "").replace(/[^0-9a-f]/gi, "").slice(0, 6);
  return `#${stripped}`;
}

export function PalettePicker({
  label,
  value,
  onChange,
  groups,
  onCustom,
  placeholderLabel = "Select colour",
  placeholderSwatch,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  groups: PaletteGroup[];
  onCustom: () => void;
  placeholderLabel?: string;
  placeholderSwatch?: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const flat = groups.flatMap((group) => group.options);
  const hasValue = Boolean(value);
  const selected = hasValue ? flat.find((option) => option.hex.toLowerCase() === value.toLowerCase()) : undefined;
  const selectedLabel = hasValue ? selected?.label ?? "Custom" : placeholderLabel;
  const swatchValue = hasValue ? value : placeholderSwatch ?? "#e5e7eb";
  const handleSelect = (hex: string) => {
    onChange(hex);
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  };

  return (
    <details ref={detailsRef} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center gap-3 text-xs font-semibold text-zinc-700">
        <span className="normal-case tracking-[0.04em] text-zinc-500">{label}</span>
        <span className="ml-auto flex items-center gap-2 text-[11px] font-medium text-zinc-600">
          <span>{selectedLabel}</span>
          <span
            style={{
              width: 20,
              height: 20,
              backgroundColor: swatchValue,
              border: "1px solid #000",
              borderRadius: 9999,
              boxSizing: "border-box",
              flexShrink: 0,
              display: "inline-block",
            }}
          />
        </span>
      </summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="sr-only">{group.title}</p>
            <div className="mt grid grid-cols-3 gap-2 gap-2">
              {group.options.map((option) => {
                const isActive = option.hex.toLowerCase() === value.toLowerCase();
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelect(option.hex)}
                    className={`palette-swatch h-8 w-full rounded-full border ${
                      isActive ? "ring-2 ring-zinc-900 ring-offset-1" : ""
                    }`}
                    style={
                      {
                        backgroundColor: option.hex,
                        "--swatch": option.hex,
                        "--swatch-border": "#000000",
                      } as React.CSSProperties
                    }
                    aria-label={option.label}
                  >
                    <span className="sr-only">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div>
          <p className="sr-only">Custom</p>
          <button
            type="button"
            data-neutral-button
            className="mt flex h-9 w-full items-center justify-center rounded-full px-3 text-[11px] font-semibold hover:text-zinc-800"
            onClick={onCustom}
          >
            Custom colour
          </button>
        </div>
      </div>
    </details>
  );
}
