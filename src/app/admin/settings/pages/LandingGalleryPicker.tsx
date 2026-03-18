"use client";

import { useMemo, useState } from "react";

type LibraryImage = {
  name: string;
  path: string;
  publicUrl: string;
  updatedAt: string | null;
};

type Props = {
  slug: string;
  initialImageUrls: string[];
  libraryImages: LibraryImage[];
  readOnly: boolean;
};

const SLOT_COUNT = 6;

function buildInitialSlots(imageUrls: string[]) {
  return Array.from({ length: SLOT_COUNT }, (_, index) => imageUrls[index] ?? "");
}

export function LandingGalleryPicker({ slug, initialImageUrls, libraryImages, readOnly }: Props) {
  const [slots, setSlots] = useState<string[]>(() => buildInitialSlots(initialImageUrls));
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  const selectedCount = useMemo(() => slots.filter(Boolean).length, [slots]);

  const updateSlot = (index: number, nextValue: string) => {
    setSlots((current) => current.map((value, slotIndex) => (slotIndex === index ? nextValue : value)));
  };

  const clearSlot = (index: number) => {
    updateSlot(index, "");
    if (activeSlot === index) {
      setActiveSlot(null);
    }
  };

  const moveSlot = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= SLOT_COUNT) return;
    setSlots((current) => {
      const next = [...current];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
    if (activeSlot === index) {
      setActiveSlot(target);
    } else if (activeSlot === target) {
      setActiveSlot(index);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-zinc-900">Landing page mini gallery</p>
        <p className="text-xs text-zinc-600">
          Upload images in the media library below, then place them into these 6 slots. This keeps the page editor
          simple without asking admins to paste raw URLs.
        </p>
        <p className="text-xs text-zinc-500">
          Selected: {selectedCount} / {SLOT_COUNT}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {slots.map((imageUrl, index) => {
          const isActive = activeSlot === index;
          return (
            <div
              key={`${slug}-gallery-slot-${index}`}
              className={`space-y-3 rounded-xl border bg-white p-3 shadow-sm ${
                isActive ? "border-zinc-900" : "border-zinc-200"
              }`}
            >
              <input type="hidden" name="galleryImageUrls" value={imageUrl} readOnly />

              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Slot {index + 1}</p>
                <div
                  className="aspect-[4/3] w-full rounded-lg border border-zinc-200 bg-zinc-100 bg-cover bg-center"
                  style={imageUrl ? { backgroundImage: `url("${imageUrl}")` } : undefined}
                >
                  {!imageUrl ? (
                    <div className="flex h-full items-center justify-center text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                      Empty
                    </div>
                  ) : null}
                </div>
              </div>

              {!readOnly ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveSlot(isActive ? null : index)}
                    className={`rounded border px-3 py-1.5 text-xs font-semibold ${
                      isActive
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                    }`}
                  >
                    {imageUrl ? "Replace" : "Choose"} image
                  </button>
                  <button
                    type="button"
                    onClick={() => clearSlot(index)}
                    disabled={!imageUrl}
                    className="rounded border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSlot(index, -1)}
                    disabled={index === 0}
                    className="rounded border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Move earlier
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSlot(index, 1)}
                    disabled={index === SLOT_COUNT - 1}
                    className="rounded border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Move later
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {!readOnly ? (
        activeSlot !== null ? (
          <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-900">Choose image for slot {activeSlot + 1}</p>
                <p className="text-xs text-zinc-600">Select from the existing media library.</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSlot(null)}
                className="rounded border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
              >
                Close
              </button>
            </div>

            {libraryImages.length === 0 ? (
              <p className="text-sm text-zinc-500">No library images uploaded yet. Upload one below first.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {libraryImages.map((image) => (
                  <button
                    key={image.path}
                    type="button"
                    onClick={() => {
                      updateSlot(activeSlot, image.publicUrl);
                      setActiveSlot(null);
                    }}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-left transition hover:border-zinc-300 hover:bg-white"
                  >
                    <div
                      className="mb-3 aspect-[4/3] w-full rounded-lg border border-zinc-200 bg-zinc-100 bg-cover bg-center"
                      style={{ backgroundImage: `url("${image.publicUrl}")` }}
                    />
                    <p className="truncate text-xs font-semibold text-zinc-900">{image.name}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white/80 px-4 py-3 text-xs text-zinc-500">
            Select a slot above, then choose an image from the media library.
          </div>
        )
      ) : null}
    </div>
  );
}
