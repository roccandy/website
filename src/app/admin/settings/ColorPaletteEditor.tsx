"use client";

import { useMemo, useState } from "react";
import { paletteSections } from "@/app/admin/settings/palette";

type ColorPaletteEditorProps = {
  initialValues: Record<string, string>;
};

type Cmyk = {
  c: number;
  m: number;
  y: number;
  k: number;
};

function normalizeHex(value: string, fallback: string) {
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

function hexToCmyk(hex: string): Cmyk | null {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    return null;
  }
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
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100),
  };
}

export function ColorPaletteEditor({ initialValues }: ColorPaletteEditorProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    paletteSections.forEach((section) => {
      section.items.forEach((item) => {
        const initial = initialValues[item.name] ?? item.defaultValue;
        next[item.name] = normalizeHex(initial, item.defaultValue);
      });
    });
    return next;
  });

  const cmykValues = useMemo(() => {
    const map = new Map<string, Cmyk | null>();
    Object.entries(values).forEach(([key, value]) => {
      map.set(key, hexToCmyk(value));
    });
    return map;
  }, [values]);

  return (
    <div className="space-y-6">
      {paletteSections.map((section) => (
        <div key={section.title} className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="admin-card-title text-zinc-900">{section.title}</h4>
            <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">Dark / Core / Light</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {section.items.map((item) => {
              const value = values[item.name] ?? item.defaultValue;
              const cmyk = cmykValues.get(item.name);
              return (
                <div key={item.name} className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-12 w-12 rounded-lg border border-zinc-200"
                      style={{ backgroundColor: value }}
                      aria-hidden="true"
                    />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-zinc-700">{item.label}</p>
                      <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-2">
                        <input
                          type="text"
                          name={item.name}
                          value={value}
                          onChange={(event) => {
                            const nextValue = event.target.value.toLowerCase();
                            setValues((prev) => ({ ...prev, [item.name]: nextValue }));
                          }}
                          onBlur={(event) => {
                            const normalized = normalizeHex(event.target.value, item.defaultValue);
                            setValues((prev) => ({ ...prev, [item.name]: normalized }));
                          }}
                          className="w-full rounded border border-zinc-200 px-2 py-1 text-xs font-medium uppercase tracking-[0.08em]"
                        />
                        <input
                          type="color"
                          value={value}
                          onChange={(event) => {
                            const normalized = normalizeHex(event.target.value, item.defaultValue);
                            setValues((prev) => ({ ...prev, [item.name]: normalized }));
                          }}
                          aria-label={`${item.label} color picker`}
                          className="h-8 w-10 cursor-pointer rounded border border-zinc-200 bg-white"
                        />
                      </div>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                        {cmyk
                          ? `C ${cmyk.c}% M ${cmyk.m}% Y ${cmyk.y}% K ${cmyk.k}%`
                          : "C -- M -- Y -- K --"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
