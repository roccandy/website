import {
  DEFAULT_ADVANCED_JACKET,
  DESIGN_FONTS,
  designFaceRadius,
  designImageHref,
  newDesignLayer,
  type CandyDesign,
  type DesignLayer,
} from "@/lib/candyDesign";
import { uploadStudioDataUrl } from "@/lib/studioClientAssets";
import { jacketBodyPath, jacketRingPath } from "@/lib/candyJacketGeometry";

export type ControlLayer = {
  id: string | number;
  type: string;
  name: string;
  visible: boolean;
  opacity: number;
  x: number;
  y: number;
  rot: number;
  size: number;
  color: string;
  text: string;
  font: string;
  spacing: number;
  bold: boolean;
  italic: boolean;
  caps: boolean;
  side: string;
  angle: number;
  radiusF: number;
  scale: number;
  clip: boolean;
  locked: boolean;
  jacketOnly?: boolean;
  img?: HTMLCanvasElement;
  original?: DesignLayer;
};
export type ControlState = {
  jacket: {
    style: string;
    segments: number;
    gap: number;
    cols: number;
    ring: number;
    shade: number;
    shadow: boolean;
    show?: boolean;
    colorA: string;
    colorB: string;
    colorC: string;
    colorD: string;
    face: string;
    pin: string;
  };
  layers: ControlLayer[];
  bg: string;
  transparent: boolean;
  zoom: number;
  sel: string | number | null;
  productionNotes?: string;
};
const fontLabel = (key: DesignLayer["font"]) =>
  (
    ({
      site: "Helvetica",
      sans: "Roboto",
      serif: "Roboto Slab",
      mono: "Roboto Mono",
    }) as Record<string, string>
  )[key] || DESIGN_FONTS[key].label;
const fontKey = (name: string): DesignLayer["font"] =>
  (
    ({
      Helvetica: "site",
      Georgia: "serif",
      "Courier New": "mono",
      Roboto: "sans",
      "Roboto Slab": "serif",
      "Roboto Mono": "mono",
    }) as Record<string, DesignLayer["font"]>
  )[name] ||
  (Object.entries(DESIGN_FONTS).find(
    ([, f]) => f.label === name,
  )?.[0] as DesignLayer["font"]) ||
  "site";
const jacketSignature = (j: ControlState["jacket"]) =>
  JSON.stringify(Object.entries(j).sort(([a], [b]) => a.localeCompare(b)));
export class StudioExperienceAdapter {
  base: CandyDesign;
  private encoded = new WeakMap<HTMLCanvasElement, string>();
  private prepared = new Map<
    string,
    Promise<Awaited<ReturnType<typeof uploadStudioDataUrl>>>
  >();
  private baselineJacket = "";
  private baselineLayers = new Map<string, string>();
  private signature(l: ControlLayer) {
    const { img, original, ...fields } = l;
    void original;
    return JSON.stringify({
      ...fields,
      image: img ? this.imageData(img) : undefined,
    });
  }
  constructor(design: CandyDesign) {
    this.base = design;
  }
  invalidate = (canvas: HTMLCanvasElement) => this.encoded.delete(canvas);
  rememberImage = async (canvas: HTMLCanvasElement, file: Blob) => {
    const source = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    this.encoded.set(canvas, source);
  };
  fontFamily = (font: string) => DESIGN_FONTS[fontKey(font)].family;
  imageData = (canvas: HTMLCanvasElement) => {
    let data = this.encoded.get(canvas);
    if (!data) {
      data = canvas.toDataURL("image/png");
      this.encoded.set(canvas, data);
    }
    return data;
  };
  async load(
    design: CandyDesign,
    document: Document,
  ): Promise<ControlState & { nextId: number }> {
    this.base = design;
    const radius = designFaceRadius(design),
      j = design.jacket,
      a = j.advanced ?? DEFAULT_ADVANCED_JACKET;
    const layers = await Promise.all(
      design.layers.map(async (l): Promise<ControlLayer> => {
        const base = l.frame === "scene" ? 1772 : radius * 2;
        const result: ControlLayer = {
          id: l.id,
          type: l.type === "text" && l.curve !== "straight" ? "arc" : l.type,
          name: l.name,
          visible: l.visible,
          opacity: l.opacity ?? 1,
          x:
            l.frame === "scene"
              ? (l.x / 100) * 1772
              : 545 - radius + (l.x / 100) * radius * 2,
          y:
            l.frame === "scene"
              ? (l.y / 100) * 1300
              : 660 - radius + (l.y / 100) * radius * 2,
          rot: l.rotation,
          size: (l.size / 100) * base,
          color: l.colour,
          text: l.text,
          font: fontLabel(l.font),
          spacing: l.spacing,
          bold: l.bold,
          italic: l.italic,
          caps: l.uppercase ?? false,
          side: l.curve === "down" ? "bottom" : "top",
          angle: l.rotation,
          radiusF: (l.arcRadius ?? 320) / radius,
          scale: 1,
          clip: l.clip !== false,
          locked: l.locked ?? false,
          original: l,
        };
        if (l.type === "image") {
          const response = await fetch(designImageHref(l.image));
          if (!response.ok)
            throw new Error("Saved artwork could not be loaded. Please retry.");
          const blob = await response.blob(),
            url = URL.createObjectURL(blob);
          try {
            const image = new Image();
            image.src = url;
            await image.decode();
            const canvas = document.createElement("canvas");
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            canvas.getContext("2d")!.drawImage(image, 0, 0);
            const source = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            this.encoded.set(canvas, source);
            result.img = canvas;
            const width = (l.size / 100) * base,
              height = width / (l.aspectRatio ?? 1);
            result.scale = Math.min(
              width / canvas.width,
              height / canvas.height,
            );
            if (
              l.surface === "jacket" &&
              l.frame === "scene" &&
              l.x === 50 &&
              l.y === 50 &&
              l.size === 100
            ) {
              result.type = "paint";
              result.jacketOnly = true;
            }
          } finally {
            URL.revokeObjectURL(url);
          }
        }
        return result;
      }),
    );
    const loaded = {
      jacket: {
        style: j.advanced
          ? j.mode === "solid"
            ? "solid"
            : j.mode === "rainbow"
              ? "rainbow"
              : j.showPinstripe
                ? "pin"
                : "segmented"
          : "legacy",
        segments: a.segments,
        gap: a.gap,
        cols: Math.min(4, j.colours.length),
        ring: 1 - radius / 532,
        shade: a.shading,
        shadow: a.shadow,
        show: !design.presentation?.hideCandy,
        colorA: j.colours[0] || "#f2d2bd",
        colorB: j.colours[1] || "#cfe6f0",
        colorC: j.colours[2] || "#d3e5bd",
        colorD: j.colours[3] || "#d9d2fb",
        face: j.fill,
        pin: j.pinstripe,
      },
      layers,
      bg: design.presentation?.background ?? "#ffffff",
      transparent: design.presentation?.transparent ?? false,
      zoom: design.presentation?.designScale ?? 1,
      sel: layers[0]?.id ?? null,
      nextId: Math.max(1, ...layers.map((l) => Number(l.id) || 0)) + 1,
    };
    this.baselineJacket = jacketSignature(loaded.jacket);
    this.baselineLayers.clear();
    for (const l of layers)
      this.baselineLayers.set(String(l.id), this.signature(l));
    return loaded;
  }
  faceRadius = (state: ControlState) =>
    state.jacket.style === "legacy"
      ? designFaceRadius(this.base)
      : 532 * (1 - state.jacket.ring);
  toDesign(state: ControlState, name = this.base.name): CandyDesign {
    const j = state.jacket,
      r = this.faceRadius(state);
    const design: CandyDesign = {
      ...this.base,
      schemaVersion: 2,
      name: name || "Untitled design",
      jacket:
        j.style === "legacy"
          ? {
              ...this.base.jacket,
              fill: j.face,
              pinstripe: j.pin,
              colours: this.base.jacket.colours.map(
                (c, i) => [j.colorA, j.colorB, j.colorC, j.colorD][i] || c,
              ),
            }
          : {
              mode:
                j.style === "solid"
                  ? "solid"
                  : j.style === "rainbow"
                    ? "rainbow"
                    : "segments",
              colours: [j.colorA, j.colorB, j.colorC, j.colorD].slice(
                0,
                j.style === "solid" ? 1 : j.cols,
              ),
              fill: j.face,
              pinstripe: j.pin,
              showPinstripe: j.style === "pin",
              advanced: {
                segments: j.segments,
                gap: j.gap,
                ring: j.ring,
                shading: j.shade,
                shadow: j.shadow,
              },
            },
      presentation: {
        background: state.bg,
        transparent: state.transparent,
        hideCandy: j.show === false,
        designScale: state.zoom,
      },
      layers: state.layers.map((l) => {
        const paint = l.type === "paint",
          original = l.original,
          scene = paint || original?.frame === "scene",
          diameter = scene ? 1772 : r * 2;
        if (
          original &&
          this.baselineLayers.get(String(l.id)) === this.signature(l) &&
          r === designFaceRadius(this.base)
        )
          return original;
        const layer: DesignLayer = {
          ...(original ||
            newDesignLayer(
              l.type === "arc"
                ? "text"
                : paint
                  ? "image"
                  : (l.type as DesignLayer["type"]),
              String(l.id),
            )),
          id: String(l.id),
          type:
            l.type === "arc"
              ? "text"
              : paint
                ? "image"
                : (l.type as DesignLayer["type"]),
          name: l.name,
          text: l.text || "",
          visible: l.visible,
          opacity: l.opacity,
          locked: l.locked,
          clip: l.clip,
          colour: l.color,
          x: paint
            ? 50
            : scene
              ? (l.x / 1772) * 100
              : 50 + ((l.x - 545) / (r * 2)) * 100,
          y: paint
            ? 50
            : scene
              ? (l.y / 1300) * 100
              : 50 + ((l.y - 660) / (r * 2)) * 100,
          size: paint ? 100 : (l.size / diameter) * 100,
          rotation: l.type === "arc" ? l.angle : l.rot,
          font: fontKey(l.font),
          spacing: l.spacing,
          bold: l.bold,
          italic: l.italic,
          uppercase: l.caps,
          curve:
            l.type === "arc"
              ? l.side === "bottom"
                ? "down"
                : "up"
              : "straight",
          arcRadius: l.radiusF * r,
          fullArc: original?.fullArc ?? true,
          frame: scene ? "scene" : "face",
        };
        if (l.img) {
          layer.image = this.imageData(l.img);
          layer.imageWidth = l.img.width;
          layer.imageHeight = l.img.height;
          layer.size = paint ? 100 : ((l.img.width * l.scale) / diameter) * 100;
          layer.aspectRatio = paint ? 1772 / 1300 : l.img.width / l.img.height;
          layer.surface = paint
            ? l.jacketOnly
              ? "jacket"
              : "face"
            : (original?.surface ?? "face");
          if (paint) layer.clip = false;
        }
        return layer;
      }),
    };
    if (jacketSignature(j) === this.baselineJacket)
      design.jacket = this.base.jacket;
    design.productionNotes = state.productionNotes ?? this.base.productionNotes;
    const p = design.presentation!;
    if (
      p.background === (this.base.presentation?.background ?? "#ffffff") &&
      p.transparent === (this.base.presentation?.transparent ?? false) &&
      p.hideCandy === (this.base.presentation?.hideCandy ?? false) &&
      p.designScale === (this.base.presentation?.designScale ?? 1)
    )
      design.presentation = this.base.presentation;
    const comparable = { ...design, schemaVersion: this.base.schemaVersion };
    if (JSON.stringify(comparable) === JSON.stringify(this.base))
      return this.base;
    return design;
  }
  async prepare(design: CandyDesign): Promise<CandyDesign> {
    const layers = await Promise.all(
      design.layers.map(async (l) => {
        if (l.type !== "image" || !l.image.startsWith("data:")) return l;
        let job = this.prepared.get(l.image);
        if (!job) {
          job = uploadStudioDataUrl(l.image);
          this.prepared.set(l.image, job);
          job.catch(() => this.prepared.delete(l.image));
        }
        return { ...l, ...(await job) };
      }),
    );
    return { ...design, layers };
  }
  jacketPaths = (state: ControlState) => {
    const radius = this.faceRadius(state);
    return [
      new Path2D(jacketBodyPath()),
      new Path2D(jacketRingPath(0, Math.PI * 2 - 0.00001, radius)),
    ];
  };
}
