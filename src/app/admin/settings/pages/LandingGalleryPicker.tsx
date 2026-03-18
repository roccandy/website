"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ImageOptimizationStatus } from "@/components/ImageOptimizationStatus";
import { analyzeImageOptimization, type ImageOptimizationSummary } from "@/lib/clientImageOptimization";
import {
  bulkUploadLandingGalleryImagesAction,
  type LandingGalleryBulkUploadActionState,
} from "./actions";

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

const MAX_SINGLE_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_BULK_UPLOAD_BYTES = 24 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

function buildInitialSlots(imageUrls: string[]) {
  return imageUrls.length > 0 ? imageUrls : [""];
}

function appendUploadedUrlsToSlots(current: string[], nextUrls: string[]) {
  if (nextUrls.length === 0) return current;

  const nextSlots = [...current];
  let uploadIndex = 0;

  for (let slotIndex = 0; slotIndex < nextSlots.length && uploadIndex < nextUrls.length; slotIndex += 1) {
    if (!nextSlots[slotIndex]) {
      nextSlots[slotIndex] = nextUrls[uploadIndex] ?? "";
      uploadIndex += 1;
    }
  }

  if (uploadIndex < nextUrls.length) {
    nextSlots.push(...nextUrls.slice(uploadIndex));
  }

  return nextSlots.length > 0 ? nextSlots : [""];
}

const INITIAL_LANDING_GALLERY_BULK_UPLOAD_STATE: LandingGalleryBulkUploadActionState = {
  status: "idle",
  message: null,
  uploaded: null,
  requestId: null,
};

export function LandingGalleryPicker({ slug, initialImageUrls, libraryImages, readOnly }: Props) {
  const [slots, setSlots] = useState<string[]>(() => buildInitialSlots(initialImageUrls));
  const [libraryItems, setLibraryItems] = useState<LibraryImage[]>(libraryImages);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedSummaries, setSelectedSummaries] = useState<ImageOptimizationSummary[]>([]);
  const [isAnalysingFiles, setIsAnalysingFiles] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const bulkUploadInputRef = useRef<HTMLInputElement | null>(null);
  const appliedRequestRef = useRef<string | null>(null);
  const [uploadState, setUploadState] = useState<LandingGalleryBulkUploadActionState>(
    INITIAL_LANDING_GALLERY_BULK_UPLOAD_STATE
  );
  const [isBulkUploading, startBulkUpload] = useTransition();

  const selectedCount = useMemo(() => slots.filter(Boolean).length, [slots]);

  useEffect(() => {
    if (uploadState.status !== "success" || !uploadState.uploaded?.length || !uploadState.requestId) return;
    if (appliedRequestRef.current === uploadState.requestId) return;

    appliedRequestRef.current = uploadState.requestId;
    const uploadedUrls = uploadState.uploaded.map((image) => image.publicUrl);
    setSlots((current) => appendUploadedUrlsToSlots(current, uploadedUrls));
    setLibraryItems((current) => {
      const existingPaths = new Set(current.map((image) => image.path));
      return [...uploadState.uploaded!.filter((image) => !existingPaths.has(image.path)), ...current];
    });
    setSelectedFiles([]);
    setSelectedSummaries([]);
    setAnalysisError(null);
    setSelectionError(null);
    if (bulkUploadInputRef.current) {
      bulkUploadInputRef.current.value = "";
    }
  }, [uploadState]);

  const updateSlot = (index: number, nextValue: string) => {
    setSlots((current) => current.map((value, slotIndex) => (slotIndex === index ? nextValue : value)));
  };

  const clearSlot = (index: number) => {
    updateSlot(index, "");
    if (activeSlot === index) {
      setActiveSlot(null);
    }
  };

  const removeSlot = (index: number) => {
    setSlots((current) => {
      const next = current.filter((_, slotIndex) => slotIndex !== index);
      return next.length > 0 ? next : [""];
    });
    if (activeSlot === index) {
      setActiveSlot(null);
    } else if (activeSlot !== null && activeSlot > index) {
      setActiveSlot(activeSlot - 1);
    }
  };

  const addSlot = () => {
    setSlots((current) => [...current, ""]);
    setActiveSlot(slots.length);
  };

  const moveSlot = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= slots.length) return;
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
          Upload one or many images straight into this gallery, or choose from the shared media library below. This
          keeps the page editor simple without asking admins to paste raw URLs.
        </p>
        <p className="text-xs text-zinc-500">Selected: {selectedCount}</p>
      </div>

      {!readOnly ? (
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-zinc-900">Bulk upload into this gallery</p>
            <p className="text-xs text-zinc-600">
              Select multiple images from your computer. Each one will be optimised, uploaded, and added as its own
              gallery slot.
            </p>
          </div>

          <div className="space-y-3">
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Choose images</span>
              <input
                ref={bulkUploadInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                multiple
                className="block w-full text-sm"
                onChange={async (event) => {
                  const files = Array.from(event.currentTarget.files ?? []);
                  setSelectedFiles(files);
                  setSelectedSummaries([]);
                  setAnalysisError(null);
                  setSelectionError(null);
                  if (files.length === 0) return;
                  const oversizeFile = files.find((file) => file.size > MAX_SINGLE_IMAGE_BYTES);
                  if (oversizeFile) {
                    setSelectionError(
                      `${oversizeFile.name} is ${formatBytes(oversizeFile.size)}. Each image must be 5 MB or smaller.`
                    );
                    return;
                  }
                  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
                  if (totalBytes > MAX_BULK_UPLOAD_BYTES) {
                    setSelectionError(
                      `This selection is ${formatBytes(totalBytes)}. Bulk uploads must stay under ${formatBytes(MAX_BULK_UPLOAD_BYTES)} total.`
                    );
                    return;
                  }
                  setIsAnalysingFiles(true);
                  try {
                    const summaries = await Promise.all(
                      files.map((file) =>
                        analyzeImageOptimization(file, {
                          maxWidth: 2400,
                          maxHeight: 2400,
                          quality: 0.82,
                        })
                      )
                    );
                    setSelectedSummaries(summaries);
                  } catch {
                    setAnalysisError("Unable to calculate optimised image details for one or more files.");
                  } finally {
                    setIsAnalysingFiles(false);
                  }
                }}
              />
            </label>

            {isAnalysingFiles ? (
              <ImageOptimizationStatus
                summary={null}
                pendingLabel={`Calculating optimised details for ${selectedFiles.length} image${selectedFiles.length === 1 ? "" : "s"}...`}
                helperText="Landing gallery uploads are stored in the smallest suitable web format."
              />
            ) : selectedSummaries.length > 0 ? (
              <div className="space-y-2">
                {selectedSummaries.map((summary, index) => (
                  <div key={`${selectedFiles[index]?.name ?? "file"}-${index}`} className="space-y-1">
                    <p className="text-[11px] font-semibold text-zinc-700">
                      {selectedFiles[index]?.name ?? `Image ${index + 1}`}
                    </p>
                    <ImageOptimizationStatus
                      summary={summary}
                      helperText="Stored in the smallest suitable web format."
                    />
                  </div>
                ))}
              </div>
            ) : analysisError ? (
              <ImageOptimizationStatus summary={null} helperText={analysisError} />
            ) : selectionError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {selectionError}
              </div>
            ) : null}

            {uploadState.message ? (
              <div
                className={`rounded-lg border px-3 py-2 text-xs ${
                  uploadState.status === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {uploadState.message}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={selectedFiles.length === 0 || isAnalysingFiles || isBulkUploading || Boolean(selectionError)}
                onClick={() => {
                  if (selectedFiles.length === 0 || isAnalysingFiles || selectionError) return;
                  setUploadState(INITIAL_LANDING_GALLERY_BULK_UPLOAD_STATE);
                  startBulkUpload(async () => {
                    const formData = new FormData();
                    formData.set("slug", slug);
                    selectedFiles.forEach((file) => formData.append("landingGalleryFiles", file));
                    const result = await bulkUploadLandingGalleryImagesAction(formData);
                    setUploadState(result);
                  });
                }}
                className="rounded border border-zinc-900 bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isBulkUploading ? "Uploading..." : `Upload ${selectedFiles.length || ""} image${selectedFiles.length === 1 ? "" : "s"}`.trim()}
              </button>
              <p className="self-center text-xs text-zinc-500">Each image can be up to 5 MB. Bulk uploads must stay under 24 MB total. Save the page after upload to keep the new gallery order.</p>
            </div>
          </div>
        </div>
      ) : null}

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
                    disabled={index === slots.length - 1}
                    className="rounded border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Move later
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSlot(index)}
                    disabled={slots.length === 1 && !imageUrl}
                    className="rounded border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Remove slot
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {!readOnly ? (
        <div className="flex justify-start">
          <button
            type="button"
            onClick={addSlot}
            className="rounded border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
          >
            Add image slot
          </button>
        </div>
      ) : null}

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

            {libraryItems.length === 0 ? (
              <p className="text-sm text-zinc-500">No library images uploaded yet. Upload one below first.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {libraryItems.map((image) => (
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
