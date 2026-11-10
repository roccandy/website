"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { CandyDesignSvg } from "@/components/CandyDesignSvg";
import { designImageHref, type CandyDesign } from "@/lib/candyDesign";
import {
  colourSelection,
  editRaster,
  polygonSelection,
  resizeSelection,
  type Mask,
  type Raster,
} from "@/lib/designRaster";

const button =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-40";
type Tool =
  | "brush"
  | "erase"
  | "box"
  | "lasso"
  | "magic"
  | "remove"
  | "recolour"
  | "pick";
const tools: [Tool, string][] = [
  ["brush", "Paint"],
  ["erase", "Eraser"],
  ["box", "Box select"],
  ["lasso", "Lasso"],
  ["magic", "Magic select"],
  ["remove", "Remove colour"],
  ["recolour", "Replace colour"],
  ["pick", "Eyedropper"],
];
export function RasterEditor({
  image,
  jacketDesign,
  onApply,
  onClose,
}: {
  image?: string;
  jacketDesign?: CandyDesign;
  onApply: (image: string, ratio: number, copy?: string) => void;
  onClose: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    overlay = useRef<HTMLCanvasElement>(null),
    dialog = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>(image ? "magic" : "brush");
  const [colour, setColour] = useState("#d6336c"),
    [tolerance, setTolerance] = useState(40),
    [brushSize, setBrushSize] = useState(28),
    [grow, setGrow] = useState(1);
  const [contiguous, setContiguous] = useState(true),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const [hasMask, setHasMask] = useState(false),
    [revision, setRevision] = useState(0);
  const mask = useRef<Mask | null>(null),
    past = useRef<{ pixels: ImageData; copy?: string }[]>([]),
    future = useRef<{ pixels: ImageData; copy?: string }[]>([]);
  const gesture = useRef<{
    points: { x: number; y: number }[];
    before?: ImageData;
  } | null>(null);
  const splitImage = useRef<string | undefined>(undefined);
  const [hasCopy, setHasCopy] = useState(false);
  const [changed, setChanged] = useState(false);
  const originalFocus = useRef<Element | null>(null);
  useEffect(() => {
    originalFocus.current = document.activeElement;
    dialog.current?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const nodes = [
        ...(dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select,[tabindex="0"]',
        ) || []),
      ].filter((n) => n.getClientRects().length);
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    // Keep the enclosing order dialog's focus trap out of this nested editor.
    const root = dialog.current;
    root?.addEventListener("keydown", trap);
    return () => {
      root?.removeEventListener("keydown", trap);
      if (originalFocus.current instanceof HTMLElement)
        originalFocus.current.focus();
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    const draw = (source?: HTMLImageElement) => {
      if (cancelled || !canvas.current || !overlay.current) return;
      const c = canvas.current,
        o = overlay.current;
      const scale = source
        ? Math.min(1200 / source.naturalWidth, 1200 / source.naturalHeight, 1)
        : 1;
      c.width = source
        ? Math.max(1, Math.round(source.naturalWidth * scale))
        : 1200;
      c.height = source
        ? Math.max(1, Math.round(source.naturalHeight * scale))
        : jacketDesign
          ? Math.round((1200 * 1300) / 1772)
          : 1200;
      o.width = c.width;
      o.height = c.height;
      if (source)
        c.getContext("2d")!.drawImage(source, 0, 0, c.width, c.height);
      setReady(true);
    };
    if (image) {
      const source = new Image();
      source.onload = () => draw(source);
      source.onerror = () => {
        if (!cancelled)
          setError(
            "The artwork could not be loaded. Close the editor and try again.",
          );
      };
      source.src = designImageHref(image);
    } else draw();
    return () => {
      cancelled = true;
    };
  }, [image, jacketDesign]);
  const snapshot = () => {
    const c = canvas.current!;
    return c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
  };
  const commit = (before: ImageData, previousCopy?: string) => {
    past.current = [
      ...past.current.slice(-11),
      { pixels: before, copy: previousCopy },
    ];
    future.current = [];
    setRevision((v) => v + 1);
    setChanged(true);
  };
  const put = (r: Raster) =>
    canvas
      .current!.getContext("2d")!
      .putImageData(
        new ImageData(new Uint8ClampedArray(r.data), r.width, r.height),
        0,
        0,
      );
  const showMask = (next: Mask | null) => {
    mask.current = next;
    setHasMask(!!next);
    const o = overlay.current!;
    const ctx = o.getContext("2d")!;
    ctx.clearRect(0, 0, o.width, o.height);
    if (!next) return;
    const data = ctx.createImageData(o.width, o.height);
    for (let p = 0; p < next.length; p++)
      if (next[p]) {
        data.data[p * 4] = 37;
        data.data[p * 4 + 1] = 99;
        data.data[p * 4 + 2] = 235;
        data.data[p * 4 + 3] = 65;
      }
    ctx.putImageData(data, 0, 0);
  };
  const operation = (
    action: "delete" | "keep" | "recolour" | "fill",
    selection = mask.current,
  ) => {
    const before = snapshot();
    put(editRaster(before, selection, action, colour));
    commit(before, splitImage.current);
    showMask(null);
  };
  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current!,
      rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(c.width - 1, ((e.clientX - rect.left) * c.width) / rect.width),
      ),
      y: Math.max(
        0,
        Math.min(
          c.height - 1,
          ((e.clientY - rect.top) * c.height) / rect.height,
        ),
      ),
    };
  };
  const paint = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const ctx = canvas.current!.getContext("2d")!;
    ctx.save();
    ctx.globalCompositeOperation =
      tool === "erase" ? "destination-out" : "source-over";
    if (jacketDesign) {
      const path = new Path2D();
      dialog.current
        ?.querySelectorAll('clipPath[id$="-jacket"] path')
        .forEach((element) => {
          path.addPath(
            new Path2D(element.getAttribute("d") || ""),
            new DOMMatrix(element.getAttribute("transform") || undefined),
          );
        });
      ctx.scale(canvas.current!.width / 1772, canvas.current!.height / 1300);
      ctx.clip(path, "evenodd");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.strokeStyle = ctx.fillStyle = colour;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(b.x, b.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  const undo = (redo = false) => {
    const from = redo ? future : past,
      to = redo ? past : future,
      value = from.current.pop();
    if (!value) return;
    to.current.push({ pixels: snapshot(), copy: splitImage.current });
    put(value.pixels);
    splitImage.current = value.copy;
    setHasCopy(!!value.copy);
    showMask(null);
    setRevision((v) => v + 1);
    setChanged(true);
  };
  const finish = () => {
    const g = gesture.current;
    if (!g) return;
    if (g.before) commit(g.before, splitImage.current);
    else {
      const c = canvas.current!,
        a = g.points[0],
        b = g.points[g.points.length - 1];
      const points =
        tool === "box"
          ? [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }]
          : g.points;
      showMask(polygonSelection(c.width, c.height, points));
    }
    gesture.current = null;
  };
  const apply = () => {
    try {
      const c = canvas.current!,
        result = c.toDataURL("image/png");
      if (result.length > 2_000_000)
        throw new Error(
          "This artwork is too detailed to save. Use a smaller image or fewer painted details.",
        );
      onApply(result, c.width / c.height, splitImage.current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to apply artwork.");
    }
  };
  return createPortal(
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="Edit artwork pixels"
      tabIndex={-1}
      className="fixed inset-0 z-[150] overflow-y-auto bg-zinc-100 p-4 text-zinc-900 outline-none"
      onKeyDown={(e) => {
        e.stopPropagation();
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
          e.preventDefault();
          undo(e.shiftKey);
        }
      }}
    >
      <div className="mx-auto max-w-6xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              {jacketDesign ? "Paint jacket" : "Edit artwork"}
            </h2>
            <p className="text-xs text-zinc-500">
              Apply to keep these edits in the design. Existing saved artwork
              stays intact.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={button}
              onClick={() => {
                if (!changed || window.confirm("Discard these artwork edits?"))
                  onClose();
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className={button}
              disabled={!ready}
              onClick={apply}
            >
              Apply artwork
            </button>
          </div>
        </div>
        {error && (
          <p
            role="alert"
            className="rounded bg-rose-50 p-3 text-sm text-rose-800"
          >
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {tools.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={tool === id}
              className={`${button} ${tool === id ? "!border-blue-500 !bg-blue-50" : ""}`}
              onClick={() => {
                setTool(id);
                showMask(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4 rounded-xl bg-white p-3 text-xs">
          <label>
            Colour{" "}
            <input
              aria-label="Artwork colour"
              type="color"
              value={colour}
              onChange={(e) => setColour(e.target.value)}
            />
          </label>
          <span>{colour}</span>
          <label>
            Brush size{" "}
            <input
              aria-label="Brush size"
              type="range"
              min="2"
              max="200"
              value={brushSize}
              onChange={(e) => setBrushSize(+e.target.value)}
            />{" "}
            {brushSize}px
          </label>
          <label>
            Tolerance{" "}
            <input
              aria-label="Colour tolerance"
              type="range"
              min="0"
              max="120"
              value={tolerance}
              onChange={(e) => setTolerance(+e.target.value)}
            />{" "}
            {tolerance}
          </label>
          <label>
            <input
              type="checkbox"
              checked={contiguous}
              onChange={(e) => setContiguous(e.target.checked)}
            />{" "}
            Touching pixels only
          </label>
          <button
            type="button"
            className={button}
            disabled={!past.current.length}
            onClick={() => undo()}
          >
            Undo
          </button>
          <button
            type="button"
            className={button}
            disabled={!future.current.length}
            onClick={() => undo(true)}
          >
            Redo
          </button>
          <button
            type="button"
            className={button}
            disabled={!ready}
            onClick={() => operation("recolour", null)}
          >
            Tint whole image
          </button>
        </div>
        {hasMask && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-blue-50 p-3">
            {(
              [
                ["recolour", "Recolour"],
                ["fill", "Fill"],
                ["delete", "Delete selected"],
                ["keep", "Keep only"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={button}
                onClick={() => operation(id)}
              >
                {label}
              </button>
            ))}
            <label className="text-xs">
              Grow/shrink px{" "}
              <input
                type="number"
                aria-label="Selection grow amount"
                min="1"
                max="30"
                value={grow}
                className="w-14 rounded border p-1"
                onChange={(e) =>
                  setGrow(Math.max(1, Math.min(30, +e.target.value || 1)))
                }
              />
            </label>
            {[-1, 1].map((direction) => (
              <button
                key={direction}
                type="button"
                className={button}
                onClick={() =>
                  showMask(
                    resizeSelection(
                      mask.current!,
                      canvas.current!.width,
                      canvas.current!.height,
                      direction * grow,
                    ),
                  )
                }
              >
                {direction < 0 ? "Shrink" : "Grow"}
              </button>
            ))}
            <button
              type="button"
              className={button}
              onClick={() => showMask(mask.current!.map((v) => (v ? 0 : 1)))}
            >
              Invert
            </button>
            {[false, true].map((split) => (
              <button
                key={String(split)}
                type="button"
                className={button}
                disabled={hasCopy}
                onClick={() => {
                  const c = document.createElement("canvas"),
                    original = snapshot();
                  c.width = original.width;
                  c.height = original.height;
                  const kept = editRaster(original, mask.current, "keep");
                  c.getContext("2d")!.putImageData(
                    new ImageData(
                      new Uint8ClampedArray(kept.data),
                      kept.width,
                      kept.height,
                    ),
                    0,
                    0,
                  );
                  const previousCopy = splitImage.current;
                  splitImage.current = c.toDataURL("image/png");
                  setHasCopy(true);
                  if (split) put(editRaster(original, mask.current, "delete"));
                  commit(original, previousCopy);
                  showMask(null);
                }}
              >
                {split ? "Split to new layer" : "Copy to new layer"}
              </button>
            ))}
            <button
              type="button"
              className={button}
              onClick={() => showMask(null)}
            >
              Deselect
            </button>
          </div>
        )}
        {hasCopy && (
          <p className="text-xs text-blue-800">
            The selected artwork will be added as a separate layer when you
            apply.
          </p>
        )}
        <div className="rounded-xl border border-zinc-200 bg-[repeating-conic-gradient(#e4e4e7_0%_25%,white_0%_50%)] bg-[length:24px_24px] p-3">
          <div
            className="relative mx-auto max-w-[1000px]"
            style={{
              aspectRatio:
                ready && canvas.current
                  ? `${canvas.current.width}/${canvas.current.height}`
                  : "1",
            }}
          >
            {jacketDesign && (
              <div className="pointer-events-none absolute inset-0">
                <CandyDesignSvg
                  design={jacketDesign}
                  prefix="paint-background"
                />
              </div>
            )}
            <canvas
              ref={canvas}
              className="absolute inset-0 h-full w-full"
              aria-hidden="true"
            />
            <canvas
              ref={overlay}
              className="absolute inset-0 h-full w-full touch-none"
              aria-label="Artwork editing canvas"
              data-revision={revision}
              onPointerDown={(e) => {
                if (!ready) return;
                const p = point(e);
                e.currentTarget.setPointerCapture(e.pointerId);
                if (tool === "brush" || tool === "erase") {
                  showMask(null);
                  gesture.current = { points: [p], before: snapshot() };
                  paint(p, p);
                } else if (tool === "box" || tool === "lasso") {
                  showMask(null);
                  gesture.current = { points: [p] };
                } else if (tool === "pick") {
                  const d = snapshot().data,
                    i =
                      (Math.floor(p.y) * canvas.current!.width +
                        Math.floor(p.x)) *
                      4;
                  setColour(
                    `#${[0, 1, 2].map((n) => d[i + n].toString(16).padStart(2, "0")).join("")}`,
                  );
                } else {
                  const selection = colourSelection(
                    snapshot(),
                    p.x,
                    p.y,
                    tolerance,
                    contiguous,
                  );
                  if (tool === "magic") showMask(selection);
                  else
                    operation(
                      tool === "remove" ? "delete" : "recolour",
                      selection,
                    );
                }
              }}
              onPointerMove={(e) => {
                const g = gesture.current;
                if (!g) return;
                const p = point(e),
                  last = g.points[g.points.length - 1];
                if (g.before) paint(last, p);
                g.points.push(p);
                if (!g.before) {
                  const c = overlay.current!,
                    ctx = c.getContext("2d")!;
                  ctx.clearRect(0, 0, c.width, c.height);
                  ctx.strokeStyle = "#2563eb";
                  ctx.lineWidth = 2;
                  ctx.setLineDash([6, 4]);
                  ctx.beginPath();
                  const a = g.points[0];
                  if (tool === "box") ctx.rect(a.x, a.y, p.x - a.x, p.y - a.y);
                  else
                    g.points.forEach((v, i) =>
                      i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y),
                    );
                  ctx.stroke();
                }
              }}
              onPointerUp={finish}
              onPointerCancel={() => {
                if (gesture.current?.before) put(gesture.current.before);
                gesture.current = null;
                showMask(null);
              }}
            />
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Selection tools crop by making unwanted pixels transparent, preserving
          the artwork’s position. Paint is clipped to its chosen candy surface
          when applied.
        </p>
      </div>
    </div>,
    document.body,
  );
}
