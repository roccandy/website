"use client";

import {
  useEffect,
  useReducer,
  useRef,
  useState,
  startTransition,
  type ReactNode,
} from "react";
import { CandyDesignSvg } from "@/components/CandyDesignSvg";
import { RasterEditor } from "./RasterEditor";
import {
  DESIGN_FONTS,
  DESIGN_JACKETS,
  MAX_DESIGN_LAYERS,
  MAX_JACKET_COLOURS,
  designSummary,
  designFromOrder,
  newDesignLayer,
  parseCandyDesign,
  resetDesignLayerDefaults,
  emptyCandyDesign,
  upgradeCandyDesign,
  DEFAULT_ADVANCED_JACKET,
  designFaceRadius,
  designImageHref,
  type CandyDesign,
  type DesignLayer,
} from "@/lib/candyDesign";
import { optimizeBrowserImageToDataUrl } from "@/lib/clientImageOptimization";
import { saveCandyDesign } from "./actions";
import {
  resolveSiteDesignerDefaults,
  type SiteDesignerDefaults,
} from "@/lib/siteDesignerDefaults";

type History = {
  past: CandyDesign[];
  present: CandyDesign;
  future: CandyDesign[];
};
type Action =
  | { type: "change" | "replace"; design: CandyDesign }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "drag-end"; before: CandyDesign };
function history(state: History, action: Action): History {
  if (action.type === "undo")
    return state.past.length
      ? {
          past: state.past.slice(0, -1),
          present: state.past[state.past.length - 1],
          future: [state.present, ...state.future],
        }
      : state;
  if (action.type === "redo")
    return state.future.length
      ? {
          past: [...state.past, state.present],
          present: state.future[0],
          future: state.future.slice(1),
        }
      : state;
  if (action.type === "drag-end")
    return {
      ...state,
      past: [...state.past.slice(-39), action.before],
      future: [],
    };
  if (action.type === "replace") return { ...state, present: action.design };
  return {
    past: [...state.past.slice(-39), state.present],
    present: action.design,
    future: [],
  };
}
const button =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40";
const primary =
  "rounded-lg bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-900 disabled:opacity-40";
const input =
  "w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-900";
const DRAFT_KEY = "roccandy-design-studio-draft-v1";
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-xs font-medium text-zinc-600">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Colour({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          aria-label={label}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded border border-zinc-200"
        />
        <input
          key={value}
          aria-label={`${label} hex`}
          className={input}
          defaultValue={value}
          maxLength={7}
          onBlur={(e) => {
            const next = e.target.value.startsWith("#")
              ? e.target.value
              : `#${e.target.value}`;
            if (/^#[0-9a-f]{6}$/i.test(next)) onChange(next);
            else e.target.value = value;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          onFocus={(e) => e.target.select()}
        />
      </div>
    </Field>
  );
}
function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        className={input}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = e.target.valueAsNumber;
          if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
      />
    </Field>
  );
}

export function DesignEditor({
  initialDesign,
  onApply,
  onClose,
  embedded = false,
  canWrite = true,
  siteDefaults = resolveSiteDesignerDefaults(),
}: {
  initialDesign: CandyDesign;
  onApply?: (design: CandyDesign) => void;
  onClose?: () => void;
  embedded?: boolean;
  canWrite?: boolean;
  siteDefaults?: SiteDesignerDefaults;
}) {
  const [state, dispatch] = useReducer(history, {
    past: [],
    present: initialDesign,
    future: [],
  });
  const design = state.present;
  const [selectedId, setSelectedId] = useState<string | null>(
    initialDesign.layers[0]?.id || null,
  );
  const selected = design.layers.find((l) => l.id === selectedId);
  const [savedJson, setSavedJson] = useState(JSON.stringify(initialDesign));
  const savedRef = useRef(savedJson);
  const projectRef = useRef(initialDesign.source);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(100);
  const [recovery, setRecovery] = useState<CandyDesign | null>(null);
  const [showSpecs, setShowSpecs] = useState(false);
  const [view, setView] = useState<"three-dimensional" | "face">(
    "three-dimensional",
  );
  const [present, setPresent] = useState(false);
  const [raster, setRaster] = useState<{
    layer?: DesignLayer;
    jacket?: boolean;
  } | null>(null);
  const [snap, setSnap] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: string;
    x: number;
    y: number;
    startX: number;
    startY: number;
    before: CandyDesign;
    handle?: string;
  } | null>(null);
  const currentRef = useRef(design);
  useEffect(() => {
    currentRef.current = design;
  }, [design]);
  const dirty = JSON.stringify(design) !== savedJson;

  useEffect(() => {
    if (embedded) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = parseCandyDesign(raw);
        if (draft && JSON.stringify(draft) !== JSON.stringify(initialDesign))
          setRecovery(draft);
      }
    } catch {
      /* A corrupt recovery draft never replaces the current document. */
    }
  }, [embedded, initialDesign]);
  useEffect(() => {
    if (embedded || !dirty) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(design));
      } catch {
        setMessage(
          "Browser recovery storage is full. Save to the library to keep your changes.",
        );
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [design, dirty, embedded]);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(currentRef.current) !== savedRef.current)
        e.preventDefault();
    };
    const navigate = (e: Event) => {
      if (dirty && !window.confirm("Leave Design Studio with unsaved changes?"))
        e.preventDefault();
    };
    window.addEventListener("beforeunload", leave);
    window.addEventListener("admin:before-navigation", navigate);
    return () => {
      window.removeEventListener("beforeunload", leave);
      window.removeEventListener("admin:before-navigation", navigate);
    };
  }, [dirty]);
  const change = (next: CandyDesign) => {
    dispatch({ type: "change", design: next });
    setError("");
    setMessage("");
  };
  const layerChange = (patch: Partial<DesignLayer>) => {
    if (selected)
      change({
        ...design,
        layers: design.layers.map((l) =>
          l.id === selected.id ? { ...l, ...patch } : l,
        ),
      });
  };
  const advancedLayerChange = (patch: Partial<DesignLayer>) => {
    if (selected)
      change({
        ...upgradeCandyDesign(design),
        layers: design.layers.map((l) =>
          l.id === selected.id ? { ...l, ...patch } : l,
        ),
      });
  };
  const fitText = () => {
    if (!selected || selected.type !== "text") return;
    const node = canvasRef.current?.querySelector<SVGTextElement>(
      `[data-design-layer="${selected.id}"] text`,
    );
    if (!node) return;
    const radius = designFaceRadius(design) * 0.94;
    let extent = 0;
    for (let i = 0; i < node.getNumberOfChars(); i++) {
      const box = node.getExtentOfChar(i);
      for (const x of [box.x, box.x + box.width])
        for (const y of [box.y, box.y + box.height])
          extent = Math.max(
            extent,
            Math.hypot(x * (selected.scaleX ?? 1), y * (selected.scaleY ?? 1)),
          );
    }
    const arc = selected.curve !== "straight",
      arcRadius = selected.arcRadius ?? 320;
    const scale = Math.max(selected.scaleX ?? 1, selected.scaleY ?? 1);
    const fittedArcRadius = Math.max(
      60,
      Math.min(arcRadius, (radius * 0.85) / scale),
    );
    const radialFit = arc
      ? (radius - fittedArcRadius * scale) /
        Math.max(1, extent - arcRadius * scale)
      : radius / Math.max(1, extent);
    const pathFit = arc
      ? (Math.PI * fittedArcRadius * (selected.fullArc ? 2 : 1)) /
        Math.max(1, node.getComputedTextLength())
      : 1;
    const ratio = Math.min(
      1,
      Math.max(0.05, radialFit),
      Math.max(0.05, pathFit),
    );
    const patch = {
      x: 50,
      y: 50,
      size: Math.max(2, Math.round(selected.size * ratio * 100) / 100),
      spacing: Math.round(selected.spacing * ratio * 100) / 100,
    };
    if (arc)
      advancedLayerChange({
        ...patch,
        arcRadius: fittedArcRadius,
        arcOffset: 0,
      });
    else layerChange(patch);
  };
  const jacketChange = (patch: Partial<CandyDesign["jacket"]>) =>
    change({ ...design, jacket: { ...design.jacket, ...patch } });
  const add = (type: DesignLayer["type"], image = "", name?: string) => {
    if (design.layers.length >= MAX_DESIGN_LAYERS) {
      setError(`A design can contain up to ${MAX_DESIGN_LAYERS} layers.`);
      return;
    }
    const layer = {
      ...newDesignLayer(type, crypto.randomUUID(), siteDefaults),
      ...(design.schemaVersion === 2 ? { fullArc: true } : {}),
      image,
      ...(name ? { name } : {}),
    };
    change({ ...design, layers: [...design.layers, layer] });
    setSelectedId(layer.id);
  };
  const upload = async (file?: File) => {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 8 * 1024 * 1024
    ) {
      setError(
        "Choose a PNG, JPEG or WebP image up to 8MB. It will be optimised before saving.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const image = await optimizeBrowserImageToDataUrl(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.88,
      });
      add("image", image, file.name);
    } catch {
      setError("The artwork could not be opened. Try a PNG or JPEG export.");
    } finally {
      setBusy(false);
    }
  };
  const save = async (copy = false): Promise<CandyDesign | null> => {
    if (!copy && !dirty && projectRef.current)
      return { ...design, source: projectRef.current };
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await saveCandyDesign(
        { ...design, source: projectRef.current },
        copy,
      );
      if (!result.ok) {
        setError(result.error);
        return null;
      }
      dispatch({ type: "replace", design: result.design });
      setSavedJson(JSON.stringify(result.design));
      savedRef.current = JSON.stringify(result.design);
      currentRef.current = result.design;
      projectRef.current = result.design.source;
      if (!embedded) {
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {}
        window.history.replaceState(
          null,
          "",
          `/admin/design?design=${result.design.source.id}`,
        );
      }
      setMessage(
        `Saved to library · revision ${result.design.source.revision}`,
      );
      return result.design;
    } catch {
      setError(
        "The save could not be confirmed. Your design is still open; try saving again.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  };
  const exportDesign = async (format: "png" | "pdf" | "svg" | "proof") => {
    setBusy(true);
    setError("");
    try {
      // Export through the same renderer used by confirmation emails.
      const response = await fetch("/api/admin/design/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design, format, view, presentation: true }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "Unable to export artwork.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${design.name.replace(/[^a-z0-9_-]/gi, "-")}${format === "proof" ? "-proof.pdf" : `.${format}`}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to export artwork.");
    } finally {
      setBusy(false);
    }
  };
  const saveProject = async () => {
    setBusy(true);
    setError("");
    try {
      const layers = await Promise.all(
        design.layers.map(async (l) => {
          if (l.type !== "image" || l.image.startsWith("data:")) return l;
          const response = await fetch(designImageHref(l.image));
          if (!response.ok)
            throw new Error(
              "Unable to load saved artwork for the project download.",
            );
          const image = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            void response
              .blob()
              .then((blob) => reader.readAsDataURL(blob), reject);
          });
          return { ...l, image };
        }),
      );
      const project = parseCandyDesign({ ...design, layers })!;
      delete project.source;
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(project)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${design.name.replace(/[^a-z0-9_-]/gi, "-")}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to download project.");
    } finally {
      setBusy(false);
    }
  };
  const openProject = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 5_000_000)
        throw new Error("Choose a Studio JSON project up to 5MB.");
      const next = parseCandyDesign(await file.text());
      if (!next) throw new Error("Choose a valid Studio project.");
      if (
        dirty &&
        !window.confirm("Replace the current unsaved design with this project?")
      )
        return;
      delete next.source;
      projectRef.current = undefined;
      change(next);
      setSelectedId(next.layers[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open project.");
    }
  };
  const point = (e: React.PointerEvent<HTMLDivElement>) => {
    const svg = canvasRef.current?.querySelector("svg");
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(matrix.inverse());
  };
  const moveLayer = (direction: number) => {
    const index = design.layers.findIndex((l) => l.id === selectedId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= design.layers.length) return;
    const layers = [...design.layers];
    [layers[index], layers[target]] = [layers[target], layers[index]];
    change({ ...design, layers });
  };
  return (
    <div className="space-y-4 text-zinc-900" aria-label="Candy Design Studio">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-3">
        <div>
          <h2 className="text-xl font-semibold">Design Studio</h2>
          <p className="text-xs text-zinc-500">
            {dirty
              ? "Unsaved changes"
              : design.source
                ? `Saved revision ${design.source.revision}`
                : "New design"}{" "}
            · drag layers on the candy face
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={button}
            disabled={!state.past.length || busy}
            onClick={() => dispatch({ type: "undo" })}
          >
            Undo
          </button>
          <button
            type="button"
            className={button}
            disabled={!state.future.length || busy}
            onClick={() => dispatch({ type: "redo" })}
          >
            Redo
          </button>
          <button
            type="button"
            className={button}
            disabled={busy || !canWrite}
            onClick={() =>
              startTransition(async () => {
                await save(true);
              })
            }
          >
            Save copy
          </button>
          <button
            type="button"
            className={primary}
            disabled={busy || !canWrite}
            onClick={() =>
              startTransition(async () => {
                await save();
              })
            }
          >
            Save to library
          </button>
          {onApply ? (
            <button
              type="button"
              className={primary}
              disabled={busy || !canWrite}
              onClick={() =>
                startTransition(async () => {
                  const saved = await save();
                  if (saved) onApply(saved);
                })
              }
            >
              Save & use in order
            </button>
          ) : (
            <button
              type="button"
              className={primary}
              disabled={busy || !canWrite}
              onClick={() =>
                startTransition(async () => {
                  const saved = await save();
                  if (saved?.source)
                    window.location.assign(
                      `/admin/orders/new?design=${saved.source.id}&revision=${saved.source.revision}`,
                    );
                })
              }
            >
              Create order
            </button>
          )}
          {onClose && (
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() => {
                if (
                  !dirty ||
                  window.confirm(
                    "Close the studio without applying your changes to the order?",
                  )
                )
                  onClose();
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>
      {recovery && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 p-3 text-sm">
          <span>A browser recovery draft is available: {recovery.name}.</span>
          <button
            type="button"
            className={button}
            onClick={() => {
              change(recovery);
              projectRef.current = recovery.source;
              setRecovery(null);
            }}
          >
            Restore draft
          </button>
          <button
            type="button"
            className={button}
            onClick={() => {
              setRecovery(null);
              localStorage.removeItem(DRAFT_KEY);
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          {message}
        </p>
      )}
      {raster && (
        <RasterEditor
          image={raster.layer?.image}
          jacketDesign={
            raster.jacket
              ? {
                  ...design,
                  layers: design.layers.filter(
                    (l) => l.id !== raster.layer?.id,
                  ),
                }
              : undefined
          }
          onClose={() => setRaster(null)}
          onApply={(image, ratio, copy) => {
            const count = (raster.layer ? 0 : 1) + (copy ? 1 : 0);
            if (design.layers.length + count > MAX_DESIGN_LAYERS)
              throw new Error(
                `A design can contain up to ${MAX_DESIGN_LAYERS} layers. Cancel and remove a layer before adding more artwork.`,
              );
            const layer: DesignLayer = raster.layer
              ? { ...raster.layer, image }
              : {
                  ...newDesignLayer("image", crypto.randomUUID(), siteDefaults),
                  image,
                  name: raster.jacket ? "Jacket paint" : "Face paint",
                  size: 100,
                  aspectRatio: ratio,
                  surface: raster.jacket ? "jacket" : "face",
                  frame: raster.jacket ? "scene" : "face",
                };
            const layers = raster.layer
              ? design.layers.map((l) => (l.id === layer.id ? layer : l))
              : [...design.layers, layer];
            if (copy)
              layers.push({
                ...layer,
                id: crypto.randomUUID(),
                image: copy,
                name: `${layer.name} selection`,
              });
            change(
              parseCandyDesign({ ...upgradeCandyDesign(design), layers })!,
            );
            setSelectedId(layer.id);
            setRaster(null);
          }}
        />
      )}
      <fieldset
        disabled={busy}
        className={`grid items-start gap-4 border-0 p-0 ${present ? "" : "xl:grid-cols-[220px_minmax(0,1fr)_260px]"}`}
      >
        <aside
          hidden={present}
          className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-8rem)] xl:overflow-y-auto"
        >
          <Field label="Design name">
            <input
              className={input}
              value={design.name}
              maxLength={120}
              onChange={(e) => change({ ...design, name: e.target.value })}
            />
          </Field>
          <Field label="Replace layers with preset">
            <select
              className={input}
              value=""
              onChange={(e) => {
                const preset = e.target.value;
                const seed = designFromOrder(
                  {
                    category_id:
                      preset === "initials"
                        ? "weddings-initials"
                        : preset === "names"
                          ? "weddings-both-names"
                          : "custom-1-6",
                    design_text:
                      preset === "initials"
                        ? "A ❤️ B"
                        : preset === "names"
                          ? "ALICE ❤️ BOB"
                          : "CANDY",
                  },
                  siteDefaults,
                );
                const layers = preset === "blank" ? [] : seed.layers;
                change({ ...design, layers });
                setSelectedId(layers[0]?.id || null);
              }}
            >
              <option value="">Choose a layout…</option>
              <option value="text">Custom text</option>
              <option value="names">Wedding names & heart</option>
              <option value="initials">Wedding initials & heart</option>
              <option value="blank">Blank canvas</option>
            </select>
          </Field>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Layers</h3>
            <p className="mb-2 text-xs text-zinc-500">
              Top of this list is the front layer.
            </p>
            <div className="space-y-1">
              {[...design.layers].reverse().map((l) => (
                <button
                  type="button"
                  key={l.id}
                  aria-pressed={selectedId === l.id}
                  className={`w-full truncate rounded-lg border px-3 py-2 text-left text-sm ${selectedId === l.id ? "border-blue-400 bg-blue-50 text-blue-900" : "border-zinc-100"}`}
                  onClick={() => setSelectedId(l.id)}
                >
                  {!l.visible ? "◌ " : ""}
                  {l.locked ? "🔒 " : ""}
                  {l.type === "text" ? l.text || "Empty text" : l.name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={button}
              onClick={() => add("text")}
            >
              + Text
            </button>
            {(["heart", "circle", "star"] as const).map((type) => (
              <button
                type="button"
                key={type}
                className={button}
                onClick={() => add(type)}
              >
                + {type}
              </button>
            ))}
          </div>
          <label className={`${button} block cursor-pointer text-center`}>
            + Upload artwork
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={button}
              onClick={() => setRaster({})}
            >
              Paint face
            </button>
            <button
              type="button"
              className={button}
              onClick={() => {
                setView("three-dimensional");
                setRaster({ jacket: true });
              }}
            >
              Paint jacket
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={button}
              disabled={!selected || !!selected.locked}
              onClick={() => {
                if (selected && design.layers.length < MAX_DESIGN_LAYERS) {
                  const layer = {
                    ...selected,
                    id: crypto.randomUUID(),
                    x: Math.min(100, selected.x + 4),
                    y: Math.min(100, selected.y + 4),
                  };
                  change({ ...design, layers: [...design.layers, layer] });
                  setSelectedId(layer.id);
                }
              }}
            >
              Duplicate
            </button>
            <button
              type="button"
              className={button}
              disabled={!selected}
              onClick={() => moveLayer(1)}
            >
              Forward
            </button>
            <button
              type="button"
              className={button}
              disabled={!selected}
              onClick={() => moveLayer(-1)}
            >
              Backward
            </button>
            <button
              type="button"
              className={button}
              disabled={!selected}
              onClick={() => {
                change({
                  ...design,
                  layers: design.layers.filter((l) => l.id !== selectedId),
                });
                setSelectedId(null);
              }}
            >
              Delete
            </button>
          </div>
        </aside>
        <main className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white p-2">
            <label className="flex items-center gap-2 text-xs">
              Zoom{" "}
              <input
                type="range"
                min="60"
                max="180"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
              {zoom}%
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={button}
                aria-pressed={view === "face"}
                onClick={() =>
                  setView(view === "face" ? "three-dimensional" : "face")
                }
              >
                {view === "face" ? "3D preview" : "Flat face"}
              </button>
              <button
                type="button"
                className={button}
                aria-pressed={present}
                onClick={() => setPresent(!present)}
              >
                {present ? "Return to editing" : "Present"}
              </button>
              {!present && (
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={snap}
                    onChange={(e) => setSnap(e.target.checked)}
                  />{" "}
                  Snap to centre
                </label>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {(["png", "pdf", "svg"] as const).map((format) => (
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  key={format}
                  onClick={() => void exportDesign(format)}
                >
                  Export {format.toUpperCase()}
                </button>
              ))}
              <button
                type="button"
                className={button}
                onClick={() => void exportDesign("proof")}
              >
                Customer proof
              </button>
            </div>
          </div>
          <div className="overflow-auto rounded-xl border border-zinc-200 bg-[linear-gradient(45deg,#f4f4f5_25%,transparent_25%),linear-gradient(-45deg,#f4f4f5_25%,transparent_25%)] bg-[length:24px_24px] p-3">
            <div
              ref={canvasRef}
              tabIndex={0}
              role="group"
              aria-label="Design canvas. Select a layer and use arrow keys to move it."
              className="relative mx-auto touch-none outline-none focus:ring-2 focus:ring-blue-400"
              style={{
                width: `${zoom}%`,
                minWidth: 320,
                aspectRatio: view === "face" ? "1" : "1772 / 1300",
              }}
              onDragOver={(e) => {
                if (!present && e.dataTransfer.types.includes("Files"))
                  e.preventDefault();
              }}
              onDrop={(e) => {
                if (!present && !busy) {
                  e.preventDefault();
                  void upload(e.dataTransfer.files[0]);
                }
              }}
              onPaste={(e) => {
                if (!present && !busy) {
                  const file = [...e.clipboardData.files].find((f) =>
                    f.type.startsWith("image/"),
                  );
                  if (file) {
                    e.preventDefault();
                    void upload(file);
                  }
                }
              }}
              onPointerDown={(e) => {
                if (busy || present) return;
                const id = (e.target as Element)
                  .closest("[data-design-layer]")
                  ?.getAttribute("data-design-layer");
                if (!id) {
                  setSelectedId(null);
                  return;
                }
                const l = design.layers.find((l) => l.id === id);
                const p = point(e);
                if (!l || !p) return;
                setSelectedId(id);
                if (l.locked) return;
                drag.current = {
                  id,
                  x: l.x,
                  y: l.y,
                  startX: p.x,
                  startY: p.y,
                  before: design,
                  handle:
                    (e.target as Element).getAttribute("data-design-handle") ||
                    undefined,
                };
                e.currentTarget.setPointerCapture(e.pointerId);
                e.preventDefault();
                e.currentTarget.focus();
              }}
              onPointerMove={(e) => {
                const d = drag.current,
                  p = point(e);
                if (!d || !p) return;
                const round = (v: number) =>
                  Math.round(Math.max(0, Math.min(100, v)) * 10) / 10;
                const original = d.before.layers.find((l) => l.id === d.id)!;
                const radius = designFaceRadius(d.before),
                  diameter = radius * 2;
                const cx =
                  original.frame === "scene"
                    ? (original.x / 100) * 1772
                    : 545 - radius + (original.x / 100) * diameter;
                const cy =
                  original.frame === "scene"
                    ? (original.y / 100) * 1300
                    : 660 - radius + (original.y / 100) * diameter;
                const centre = (n: number) =>
                  snap && Math.abs(n - 50) < 1.2 ? 50 : n;
                const patch =
                  d.handle === "resize"
                    ? {
                        size: Math.min(
                          d.before.schemaVersion === 2 ? 250 : 110,
                          Math.max(
                            2,
                            (original.size * Math.hypot(p.x - cx, p.y - cy)) /
                              Math.max(
                                1,
                                Math.hypot(d.startX - cx, d.startY - cy),
                              ),
                          ),
                        ),
                      }
                    : d.handle === "rotate"
                      ? {
                          rotation:
                            ((original.rotation +
                              ((Math.atan2(p.y - cy, p.x - cx) -
                                Math.atan2(d.startY - cy, d.startX - cx)) *
                                180) /
                                Math.PI +
                              540) %
                              360) -
                            180,
                        }
                      : {
                          x: centre(
                            round(
                              d.x +
                                ((p.x - d.startX) /
                                  (original.frame === "scene"
                                    ? 1772
                                    : diameter)) *
                                  100,
                            ),
                          ),
                          y: centre(
                            round(
                              d.y +
                                ((p.y - d.startY) /
                                  (original.frame === "scene"
                                    ? 1300
                                    : diameter)) *
                                  100,
                            ),
                          ),
                        };
                dispatch({
                  type: "replace",
                  design: {
                    ...currentRef.current,
                    layers: currentRef.current.layers.map((l) =>
                      l.id === d.id
                        ? {
                            ...l,
                            ...patch,
                          }
                        : l,
                    ),
                  },
                });
              }}
              onPointerUp={() => {
                if (drag.current)
                  dispatch({ type: "drag-end", before: drag.current.before });
                drag.current = null;
              }}
              onPointerCancel={() => {
                if (drag.current)
                  dispatch({ type: "replace", design: drag.current.before });
                drag.current = null;
              }}
              onKeyDown={(e) => {
                if (busy || present) return;
                if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
                  e.preventDefault();
                  dispatch({ type: e.shiftKey ? "redo" : "undo" });
                  return;
                }
                const moves: Record<string, [number, number]> = {
                  ArrowLeft: [-1, 0],
                  ArrowRight: [1, 0],
                  ArrowUp: [0, -1],
                  ArrowDown: [0, 1],
                };
                const m = moves[e.key];
                if (selected && !selected.locked && m) {
                  e.preventDefault();
                  const step = e.shiftKey ? 5 : 1;
                  layerChange({
                    x: Math.min(100, Math.max(0, selected.x + m[0] * step)),
                    y: Math.min(100, Math.max(0, selected.y + m[1] * step)),
                  });
                }
              }}
            >
              <CandyDesignSvg
                design={design}
                selectedId={present ? undefined : selectedId || undefined}
                prefix="studio"
                view={view}
                showBackground
                handles={!present}
              />
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Artwork is clipped to its candy surface. Drag to move, use the
            square handle to resize or the round handle to rotate. Design
            changes do not set the order’s price or product type.
          </p>
          <button
            type="button"
            className={button}
            onClick={() => setShowSpecs(!showSpecs)}
          >
            {showSpecs ? "Hide" : "Show"} production specification
          </button>
          {showSpecs && (
            <ul className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4 text-xs">
              {designSummary(design, true).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </main>
        <aside
          hidden={present}
          className="space-y-5 rounded-xl border border-zinc-200 bg-white p-4 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-8rem)] xl:overflow-y-auto"
        >
          {selected ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Selected layer</h3>
              <Field label="Layer name">
                <input
                  className={input}
                  value={selected.name}
                  maxLength={80}
                  onChange={(e) => layerChange({ name: e.target.value })}
                />
              </Field>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={selected.visible}
                  onChange={(e) => layerChange({ visible: e.target.checked })}
                />
                Visible
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={selected.locked ?? false}
                  onChange={(e) =>
                    advancedLayerChange({ locked: e.target.checked })
                  }
                />{" "}
                Lock position
              </label>
              <NumberField
                label="Opacity (%)"
                value={Math.round((selected.opacity ?? 1) * 100)}
                min={0}
                max={100}
                onChange={(v) => advancedLayerChange({ opacity: v / 100 })}
              />
              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  label="Width scale"
                  value={selected.scaleX ?? 1}
                  min={0.1}
                  max={4}
                  step={0.05}
                  onChange={(scaleX) => advancedLayerChange({ scaleX })}
                />
                <NumberField
                  label="Height scale"
                  value={selected.scaleY ?? 1}
                  min={0.1}
                  max={4}
                  step={0.05}
                  onChange={(scaleY) => advancedLayerChange({ scaleY })}
                />
                <button
                  type="button"
                  className={button}
                  onClick={() =>
                    advancedLayerChange({ flipX: !selected.flipX })
                  }
                >
                  Flip horizontal
                </button>
                <button
                  type="button"
                  className={button}
                  onClick={() =>
                    advancedLayerChange({ flipY: !selected.flipY })
                  }
                >
                  Flip vertical
                </button>
              </div>
              {selected.type === "image" && (
                <>
                  <button
                    type="button"
                    className={button}
                    onClick={() =>
                      setRaster({
                        layer: selected,
                        jacket:
                          selected.surface === "jacket" &&
                          selected.frame === "scene",
                      })
                    }
                  >
                    Edit image / remove background
                  </button>
                  <Field label="Artwork surface">
                    <select
                      className={input}
                      value={selected.surface ?? "face"}
                      onChange={(e) =>
                        advancedLayerChange({
                          surface: e.target.value as "face" | "jacket",
                        })
                      }
                    >
                      <option value="face">Candy face</option>
                      <option value="jacket">Jacket</option>
                    </select>
                  </Field>
                </>
              )}
              {selected.type === "text" && (
                <>
                  <Field label="Text">
                    <textarea
                      className={input}
                      rows={2}
                      value={selected.text}
                      maxLength={120}
                      onChange={(e) =>
                        e.target.value.includes("\n")
                          ? advancedLayerChange({ text: e.target.value })
                          : layerChange({ text: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Font">
                    <select
                      className={input}
                      value={selected.font}
                      onChange={(e) =>
                        layerChange({
                          font: e.target.value as DesignLayer["font"],
                        })
                      }
                    >
                      {Object.entries(DESIGN_FONTS).map(([id, f]) => (
                        <option key={id} value={id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="flex gap-4 text-xs">
                    <label>
                      <input
                        type="checkbox"
                        checked={selected.bold}
                        onChange={(e) =>
                          layerChange({ bold: e.target.checked })
                        }
                      />{" "}
                      Bold
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={selected.italic}
                        onChange={(e) =>
                          layerChange({ italic: e.target.checked })
                        }
                      />{" "}
                      Italic
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={selected.uppercase ?? false}
                      onChange={(e) =>
                        advancedLayerChange({ uppercase: e.target.checked })
                      }
                    />{" "}
                    Uppercase text
                  </label>
                  <Field label="Text layout">
                    <select
                      className={input}
                      value={selected.curve}
                      onChange={(e) =>
                        layerChange({
                          curve: e.target.value as DesignLayer["curve"],
                        })
                      }
                    >
                      <option value="straight">Straight</option>
                      <option value="up">Upper arc</option>
                      <option value="down">Lower arc</option>
                    </select>
                  </Field>
                  <NumberField
                    label="Letter spacing"
                    value={selected.spacing}
                    min={-5}
                    max={60}
                    step={0.5}
                    onChange={(spacing) => layerChange({ spacing })}
                  />
                  {selected.curve !== "straight" && (
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField
                        label="Arc radius"
                        value={selected.arcRadius ?? 320}
                        min={60}
                        max={600}
                        onChange={(arcRadius) =>
                          advancedLayerChange({ arcRadius })
                        }
                      />
                      <NumberField
                        label="Arc slide (%)"
                        value={selected.arcOffset ?? 0}
                        min={-50}
                        max={50}
                        onChange={(arcOffset) =>
                          advancedLayerChange({ arcOffset })
                        }
                      />
                    </div>
                  )}
                  {selected.curve !== "straight" && (
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={selected.fullArc ?? false}
                        onChange={(e) =>
                          advancedLayerChange({ fullArc: e.target.checked })
                        }
                      />{" "}
                      Full-circle text path
                    </label>
                  )}
                  <button type="button" className={button} onClick={fitText}>
                    Fit text to face
                  </button>
                  <p className="text-xs text-zinc-500">
                    Text outside the face is clipped. Fit text centres it and
                    adjusts size, spacing and arc placement; you can still
                    adjust it freely.
                  </p>
                </>
              )}
              {selected.type !== "image" && (
                <Colour
                  label="Layer colour"
                  value={selected.colour}
                  onChange={(colour) => layerChange({ colour })}
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  label="X position (%)"
                  value={selected.x}
                  min={0}
                  max={100}
                  step={0.1}
                  onChange={(x) => layerChange({ x })}
                />
                <NumberField
                  label="Y position (%)"
                  value={selected.y}
                  min={0}
                  max={100}
                  step={0.1}
                  onChange={(y) => layerChange({ y })}
                />
                <NumberField
                  label={
                    selected.type === "text" ? "Font size (%)" : "Size (%)"
                  }
                  value={selected.size}
                  min={2}
                  max={design.schemaVersion === 2 ? 250 : 110}
                  step={0.5}
                  onChange={(size) => layerChange({ size })}
                />
                <NumberField
                  label="Rotation (°)"
                  value={selected.rotation}
                  min={-180}
                  max={180}
                  onChange={(rotation) => layerChange({ rotation })}
                />
              </div>
              <button
                type="button"
                className={button}
                onClick={() => layerChange({ x: 50, y: 50 })}
              >
                Centre on face
              </button>
              <button
                type="button"
                className={button}
                onClick={() => {
                  if (selected)
                    layerChange(
                      resetDesignLayerDefaults(selected, siteDefaults),
                    );
                }}
              >
                Reset layer to site defaults
              </button>
            </section>
          ) : (
            <p className="text-xs text-zinc-500">
              Select a layer to edit its properties.
            </p>
          )}
          <section className="space-y-3 border-t border-zinc-100 pt-4">
            <h3 className="text-sm font-semibold">Candy & jacket</h3>
            {!design.jacket.advanced && (
              <button
                type="button"
                className={button}
                onClick={() =>
                  change({
                    ...upgradeCandyDesign(design),
                    jacket: {
                      ...design.jacket,
                      advanced: { ...DEFAULT_ADVANCED_JACKET },
                    },
                  })
                }
              >
                Enable advanced jacket controls
              </button>
            )}
            <Field label="Jacket pattern">
              <select
                className={input}
                value={design.jacket.mode}
                onChange={(e) =>
                  jacketChange({
                    mode: e.target.value as CandyDesign["jacket"]["mode"],
                  })
                }
              >
                {Object.entries(DESIGN_JACKETS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            {design.jacket.advanced && (
              <>
                <NumberField
                  label="Jacket segments"
                  value={design.jacket.advanced.segments}
                  min={2}
                  max={16}
                  onChange={(segments) =>
                    jacketChange({
                      advanced: {
                        ...design.jacket.advanced!,
                        segments: Math.round(segments),
                      },
                    })
                  }
                />
                <NumberField
                  label="Jacket ring thickness (%)"
                  value={Math.round(design.jacket.advanced.ring * 1000) / 10}
                  min={8}
                  max={35}
                  step={0.1}
                  onChange={(v) =>
                    jacketChange({
                      advanced: { ...design.jacket.advanced!, ring: v / 100 },
                    })
                  }
                />
                <NumberField
                  label="Body shading (%)"
                  value={Math.round(design.jacket.advanced.shading * 100)}
                  min={0}
                  max={100}
                  onChange={(v) =>
                    jacketChange({
                      advanced: {
                        ...design.jacket.advanced!,
                        shading: v / 100,
                      },
                    })
                  }
                />
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={design.jacket.advanced.shadow}
                    onChange={(e) =>
                      jacketChange({
                        advanced: {
                          ...design.jacket.advanced!,
                          shadow: e.target.checked,
                        },
                      })
                    }
                  />{" "}
                  Show shadow
                </label>
              </>
            )}
            {design.jacket.mode !== "rainbow" && (
              <>
                {design.jacket.colours
                  .slice(
                    0,
                    design.jacket.mode === "solid"
                      ? 1
                      : design.jacket.mode === "two_colour"
                        ? 2
                        : MAX_JACKET_COLOURS,
                  )
                  .map((colour, i) => (
                    <div className="flex items-end gap-1" key={i}>
                      <div className="min-w-0 flex-1">
                        <Colour
                          label={`Jacket colour ${i + 1}`}
                          value={colour}
                          onChange={(value) =>
                            jacketChange({
                              colours: design.jacket.colours.map((c, n) =>
                                n === i ? value : c,
                              ),
                            })
                          }
                        />
                      </div>
                      {design.jacket.mode === "segments" &&
                        design.jacket.colours.length > 2 && (
                          <button
                            type="button"
                            aria-label={`Remove jacket colour ${i + 1}`}
                            className={button}
                            onClick={() =>
                              jacketChange({
                                colours: design.jacket.colours.filter(
                                  (_, n) => n !== i,
                                ),
                              })
                            }
                          >
                            ×
                          </button>
                        )}
                    </div>
                  ))}
                {design.jacket.mode === "segments" &&
                  design.jacket.colours.length < MAX_JACKET_COLOURS && (
                    <button
                      type="button"
                      className={button}
                      onClick={() =>
                        jacketChange({
                          colours: [
                            ...design.jacket.colours,
                            siteDefaults.jacketColour,
                          ],
                        })
                      }
                    >
                      Add segment colour
                    </button>
                  )}
              </>
            )}
            <Colour
              label="Candy fill"
              value={design.jacket.fill}
              onChange={(fill) => jacketChange({ fill })}
            />
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={design.jacket.showPinstripe}
                onChange={(e) =>
                  jacketChange({ showPinstripe: e.target.checked })
                }
              />
              Show pinstripes
            </label>
            {design.jacket.showPinstripe && (
              <>
                <Colour
                  label="Pinstripe colour"
                  value={design.jacket.pinstripe}
                  onChange={(pinstripe) => jacketChange({ pinstripe })}
                />
                {design.jacket.advanced && (
                  <NumberField
                    label="Pinstripe width (% of segment)"
                    value={Math.round(design.jacket.advanced.gap * 100)}
                    min={1}
                    max={70}
                    onChange={(v) =>
                      jacketChange({
                        advanced: { ...design.jacket.advanced!, gap: v / 100 },
                      })
                    }
                  />
                )}
              </>
            )}
            <button
              type="button"
              className={button}
              onClick={() =>
                jacketChange(emptyCandyDesign(undefined, siteDefaults).jacket)
              }
            >
              Reset jacket to site defaults
            </button>
          </section>
          <section className="space-y-3 border-t border-zinc-100 pt-4">
            <h3 className="text-sm font-semibold">Presentation & project</h3>
            <Colour
              label="Proof background"
              value={design.presentation?.background ?? "#ffffff"}
              onChange={(background) =>
                change({
                  ...upgradeCandyDesign(design),
                  presentation: {
                    background,
                    transparent: design.presentation?.transparent ?? false,
                  },
                })
              }
            />
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={design.presentation?.transparent ?? false}
                onChange={(e) =>
                  change({
                    ...upgradeCandyDesign(design),
                    presentation: {
                      background: design.presentation?.background ?? "#ffffff",
                      transparent: e.target.checked,
                    },
                  })
                }
              />{" "}
              Transparent export background
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={button}
                onClick={() => void saveProject()}
              >
                Download project
              </button>
              <label className={`${button} cursor-pointer`}>
                Open project
                <input
                  type="file"
                  accept=".json,application/json"
                  className="sr-only"
                  onChange={(e) => {
                    void openProject(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <p className="text-xs text-zinc-500">
              Background settings apply to proof exports. Order and confirmation
              previews use a white background.
            </p>
          </section>
          <Field label="Production notes (internal only)">
            <textarea
              rows={3}
              className={input}
              value={design.productionNotes}
              maxLength={2000}
              onChange={(e) =>
                change({ ...design, productionNotes: e.target.value })
              }
            />
          </Field>
        </aside>
      </fieldset>
    </div>
  );
}
