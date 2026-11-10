/** Portable, versioned artwork. Orders keep a snapshot; library revisions never mutate it. */
import {
  SITE_DESIGNER_DEFAULTS as SITE,
  resolveSiteDesignerDefaults,
  siteFontSizePercent,
  getCustomTextLayout,
  getCustomArcTextStyle,
  type SiteDesignerDefaults,
} from "@/lib/siteDesignerDefaults";
import { shortCandyTextScale } from "@/lib/candyTextSizing";
import { parseTextGeometry, type TextGeometry } from "@/lib/candyTextGeometry";
export const DESIGN_FONTS = {
  site: {
    label: "Site default (Helvetica / Arial)",
    family: "Arimo, Arial, sans-serif",
    italic: true,
  },
  sans: {
    label: "Roboto (sans serif)",
    family: "Roboto, sans-serif",
    italic: true,
  },
  serif: {
    label: "Roboto Slab (serif)",
    family: "Roboto Slab, serif",
    italic: false,
  },
  mono: {
    label: "Roboto Mono (monospace)",
    family: "Roboto Mono, monospace",
    italic: true,
  },
  montserrat: {
    label: "Montserrat",
    family: "Montserrat, sans-serif",
    italic: true,
  },
  poppins: { label: "Poppins", family: "Poppins, sans-serif", italic: true },
  oswald: { label: "Oswald", family: "Oswald, sans-serif", italic: false },
  bebasneue: {
    label: "Bebas Neue",
    family: "Bebas Neue, sans-serif",
    italic: false,
  },
  playfairdisplay: {
    label: "Playfair Display",
    family: "Playfair Display, serif",
    italic: true,
  },
  cormorantgaramond: {
    label: "Cormorant Garamond",
    family: "Cormorant Garamond, serif",
    italic: true,
  },
  pacifico: { label: "Pacifico", family: "Pacifico, cursive", italic: false },
  dancingscript: {
    label: "Dancing Script",
    family: "Dancing Script, cursive",
    italic: false,
  },
  greatvibes: {
    label: "Great Vibes",
    family: "Great Vibes, cursive",
    italic: false,
  },
  lobster: { label: "Lobster", family: "Lobster, cursive", italic: false },
} as const;
export const DESIGN_JACKETS = {
  solid: "Single colour",
  two_colour: "Two colour",
  rainbow: "Rainbow",
  segments: "Custom segments",
} as const;
export type AdvancedJacket = {
  segments: number;
  gap: number;
  ring: number;
  shading: number;
  shadow: boolean;
};
export const DEFAULT_ADVANCED_JACKET: AdvancedJacket = {
  segments: 8,
  gap: 0.15,
  ring: 1 - 435 / 532,
  shading: 0.35,
  shadow: true,
};
export type DesignLayer = {
  id: string;
  type: "text" | "image" | "heart" | "circle" | "star";
  name: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  colour: string;
  text: string;
  font: keyof typeof DESIGN_FONTS;
  bold: boolean;
  italic: boolean;
  spacing: number;
  curve: "straight" | "up" | "down";
  image: string;
  visible: boolean;
  opacity?: number;
  locked?: boolean;
  scaleX?: number;
  scaleY?: number;
  flipX?: boolean;
  flipY?: boolean;
  arcRadius?: number;
  arcOffset?: number;
  surface?: "face" | "jacket";
  aspectRatio?: number;
  frame?: "face" | "scene";
  uppercase?: boolean;
  fullArc?: boolean;
  imageWidth?: number;
  imageHeight?: number;
};
export type CandyDesign = {
  schemaVersion: 1 | 2;
  name: string;
  jacket: {
    mode: keyof typeof DESIGN_JACKETS;
    colours: string[];
    fill: string;
    pinstripe: string;
    showPinstripe: boolean;
    advanced?: AdvancedJacket;
  };
  layers: DesignLayer[];
  productionNotes: string;
  source?: { id: string; revision: number };
  presentation?: { background: string; transparent: boolean };
  textGeometry?: TextGeometry;
};
export const MAX_DESIGN_LAYERS = 20;
export const MAX_JACKET_COLOURS = 8;
/** Explicit upgrades preserve v1 geometry until advanced jacket controls are enabled. */
export function upgradeCandyDesign(design: CandyDesign): CandyDesign {
  return { ...design, schemaVersion: 2 };
}
export function studioCandyDesign(
  name?: string,
  defaults?: SiteDesignerDefaults,
): CandyDesign {
  const design = emptyCandyDesign(name, defaults);
  return {
    ...design,
    schemaVersion: 2,
    jacket: { ...design.jacket, advanced: { ...DEFAULT_ADVANCED_JACKET } },
    layers: design.layers.map((l) => ({ ...l, fullArc: true })),
  };
}
export function designFaceRadius(design: CandyDesign) {
  return design.schemaVersion === 2 && design.jacket.advanced
    ? 532 * (1 - design.jacket.advanced.ring)
    : 435;
}
export function designLayerText(layer: DesignLayer) {
  return layer.uppercase ? layer.text.toUpperCase() : layer.text;
}
export function nameDesignForOrder(
  design: CandyDesign,
  orderTitle: unknown,
): CandyDesign {
  const name =
    typeof orderTitle === "string" ? orderTitle.trim().slice(0, 120) : "";
  return name ? { ...design, name } : design;
}
const hex = (v: unknown, fallback = "#b7b7b7") =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v)
    ? v.toLowerCase()
    : fallback;
const str = (v: unknown, max: number, fallback = "") =>
  typeof v === "string" ? v.trim().slice(0, max) : fallback;
const num = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(max, Math.max(min, v))
    : fallback;
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
export function designImageSource(v: unknown) {
  if (typeof v === "string" && isDesignAssetUrl(v)) return v;
  // Raster uploads only. No SVG/script content or arbitrary remote URLs in saved studio artwork.
  return typeof v === "string" &&
    v.length <= 2_000_000 &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v)
    ? v
    : "";
}
export function isDesignAssetUrl(value: string) {
  return designAssetKey(value) !== null;
}
export function designAssetKey(value: string): string | null {
  if (/^candy-asset:[a-f0-9]{64}\.(png|jpg|webp)$/.test(value))
    return value.slice(12);
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const prefix = `${origin}/storage/v1/object/public/candy-design-assets/`;
  return origin &&
    value.startsWith(prefix) &&
    /^[a-f0-9]{64}\.(png|jpg|webp)$/.test(value.slice(prefix.length))
    ? value.slice(prefix.length)
    : null;
}
export function designImageHref(value: string) {
  const key = designAssetKey(value);
  return key ? `/api/admin/design/assets/${key}` : value;
}
export function newDesignLayer(
  type: DesignLayer["type"],
  id: string,
  defaults: SiteDesignerDefaults = resolveSiteDesignerDefaults(),
): DesignLayer {
  const fontSize = Math.round(
    SITE.straightFontSize * shortCandyTextScale("CANDY"),
  );
  const logoSize = 444.797 * 0.979136 * Math.SQRT2 * 0.96;
  return {
    id,
    type,
    name: type === "text" ? "Text" : type,
    x: 50,
    y: 50,
    size: siteFontSizePercent(
      type === "image"
        ? logoSize
        : type === "text"
          ? fontSize
          : type === "heart"
            ? SITE.heartScale * 24
            : (24 / 100) * SITE.faceDiameter,
    ),
    rotation: 0,
    colour: defaults.textColour,
    text: "CANDY",
    font: "site",
    bold: true,
    italic: false,
    spacing: type === "text" ? fontSize * SITE.straightSpacingEm : 0,
    curve: "straight",
    image: "",
    visible: true,
  };
}
export function emptyCandyDesign(
  name = "Untitled design",
  defaults: SiteDesignerDefaults = resolveSiteDesignerDefaults(),
): CandyDesign {
  return {
    schemaVersion: 1,
    name,
    jacket: {
      mode: "solid",
      colours: Array(4).fill(defaults.jacketColour),
      fill: SITE.fill,
      pinstripe: SITE.pinstripe,
      showPinstripe: false,
    },
    layers: [newDesignLayer("text", "text-1", defaults)],
    productionNotes: "",
  };
}
/** Normalise stored data; reject unknown versions rather than silently losing artwork. */
export function parseCandyDesign(value: unknown): CandyDesign | null {
  if (value == null || value === "") return null;
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      throw new Error("The design could not be read.");
    }
  }
  const v = obj(raw);
  if (v.schemaVersion !== 1 && v.schemaVersion !== 2)
    throw new Error(
      "Unsupported candy design version. The saved design has not been changed.",
    );
  if (!Array.isArray(v.layers) || v.layers.length > MAX_DESIGN_LAYERS)
    throw new Error(`Designs support up to ${MAX_DESIGN_LAYERS} layers.`);
  const jacket = obj(v.jacket);
  const ids = new Set<string>();
  const layers = v.layers.map((rawLayer, i) => {
    const l = obj(rawLayer);
    if (!["text", "image", "heart", "circle", "star"].includes(String(l.type)))
      throw new Error("Unsupported design layer.");
    const id =
      str(l.id, 70, `layer-${i}`).replace(/[^a-zA-Z0-9_-]/g, "") ||
      `layer-${i}`;
    if (ids.has(id))
      throw new Error("Design layer identifiers must be unique.");
    ids.add(id);
    const type = l.type as DesignLayer["type"];
    const image = designImageSource(l.image);
    if (type === "image" && !image)
      throw new Error(
        "Design artwork must be a PNG, JPEG or WebP upload (maximum 2MB).",
      );
    return {
      ...newDesignLayer(type, id),
      name: str(l.name, 80, type),
      x: num(
        l.x,
        v.schemaVersion === 2 ? -200 : 0,
        v.schemaVersion === 2 ? 300 : 100,
        50,
      ),
      y: num(
        l.y,
        v.schemaVersion === 2 ? -200 : 0,
        v.schemaVersion === 2 ? 300 : 100,
        50,
      ),
      size: num(l.size, 2, v.schemaVersion === 2 ? 250 : 110, 16),
      rotation: num(l.rotation, -180, 180, 0),
      colour: hex(l.colour, "#333333"),
      text: str(l.text, 120),
      font: Object.hasOwn(DESIGN_FONTS, String(l.font))
        ? (l.font as DesignLayer["font"])
        : "sans",
      bold: l.bold !== false,
      italic: l.italic === true,
      spacing: num(l.spacing, -5, 60, 0),
      curve:
        l.curve === "up" || l.curve === "down"
          ? l.curve
          : ("straight" as DesignLayer["curve"]),
      image,
      visible: l.visible !== false,
      ...(v.schemaVersion === 2
        ? {
            opacity: num(l.opacity, 0, 1, 1),
            locked: l.locked === true,
            scaleX: num(l.scaleX, 0.1, 4, 1),
            scaleY: num(l.scaleY, 0.1, 4, 1),
            flipX: l.flipX === true,
            flipY: l.flipY === true,
            arcRadius: num(l.arcRadius, 60, 600, 320),
            arcOffset: num(l.arcOffset, -50, 50, 0),
            surface:
              l.surface === "jacket" ? ("jacket" as const) : ("face" as const),
            aspectRatio: num(l.aspectRatio, 0.1, 10, 1),
            frame: l.frame === "scene" ? ("scene" as const) : ("face" as const),
            uppercase: l.uppercase === true,
            fullArc: l.fullArc === true,
            ...(type === "image" && l.imageWidth && l.imageHeight
              ? {
                  imageWidth: Math.round(num(l.imageWidth, 1, 6000, 1)),
                  imageHeight: Math.round(num(l.imageHeight, 1, 6000, 1)),
                }
              : {}),
          }
        : {}),
    };
  });
  const source = obj(v.source);
  const document: CandyDesign = {
    schemaVersion: v.schemaVersion,
    name: str(v.name, 120, "Untitled design") || "Untitled design",
    jacket: {
      mode: Object.hasOwn(DESIGN_JACKETS, String(jacket.mode))
        ? (jacket.mode as CandyDesign["jacket"]["mode"])
        : "solid",
      colours: Array.isArray(jacket.colours)
        ? jacket.colours.slice(0, MAX_JACKET_COLOURS).map((c) => hex(c))
        : ["#d1d5db"],
      fill: hex(jacket.fill, "#ffffff"),
      pinstripe: hex(jacket.pinstripe, "#ffffff"),
      showPinstripe: jacket.showPinstripe === true,
      ...(v.schemaVersion === 2 && jacket.advanced
        ? {
            advanced: {
              segments: Math.round(
                num(obj(jacket.advanced).segments, 2, 16, 8),
              ),
              gap: num(obj(jacket.advanced).gap, 0.01, 0.7, 0.15),
              ring: num(
                obj(jacket.advanced).ring,
                0.08,
                0.35,
                DEFAULT_ADVANCED_JACKET.ring,
              ),
              shading: num(obj(jacket.advanced).shading, 0, 1, 0.35),
              shadow: obj(jacket.advanced).shadow !== false,
            },
          }
        : {}),
    },
    layers,
    productionNotes: str(v.productionNotes, 2000),
  };
  if (v.schemaVersion === 2 && v.presentation)
    document.presentation = {
      background: hex(obj(v.presentation).background, "#ffffff"),
      transparent: obj(v.presentation).transparent === true,
    };
  const geometry = parseTextGeometry(v.textGeometry);
  if (geometry) document.textGeometry = geometry;
  if (!document.jacket.colours.length) document.jacket.colours = ["#d1d5db"];
  if (
    typeof source.id === "string" &&
    /^[a-f0-9-]{36}$/i.test(source.id) &&
    Number.isInteger(source.revision) &&
    Number(source.revision) > 0
  )
    document.source = { id: source.id, revision: Number(source.revision) };
  if (JSON.stringify(document).length > 5_000_000)
    throw new Error(
      "This design is too large. Reduce the uploaded artwork size.",
    );
  return document;
}
export function readCandyDesign(value: unknown) {
  try {
    return parseCandyDesign(value);
  } catch {
    return null;
  }
}

export function designSummary(
  design: CandyDesign,
  production = false,
  formatColour: (hex: string) => string = (hex) => hex,
): string[] {
  const colours = design.jacket.colours.slice(
    0,
    design.jacket.mode === "solid"
      ? 1
      : design.jacket.mode === "two_colour"
        ? 2
        : MAX_JACKET_COLOURS,
  );
  const lines = [
    `${design.name}${design.source ? ` · revision ${design.source.revision}` : ""}`,
    `Jacket: ${DESIGN_JACKETS[design.jacket.mode]}${design.jacket.mode === "rainbow" ? "" : ` (${colours.map(formatColour).join(", ")})`}`,
    `Fill: ${formatColour(design.jacket.fill)}${design.jacket.showPinstripe ? ` · Pinstripe: ${formatColour(design.jacket.pinstripe)}` : ""}`,
  ];
  if (design.schemaVersion === 2 && design.jacket.advanced) {
    const a = design.jacket.advanced;
    lines.push(
      `Jacket construction: ${a.segments} segments${production ? ` · ring ${Math.round(a.ring * 1000) / 10}%${design.jacket.showPinstripe ? ` · stripe width ${Math.round(a.gap * 100)}% of segment` : ""}` : ""}`,
    );
    if (production && design.jacket.mode !== "rainbow") {
      const palette =
        design.jacket.mode === "solid" ? colours.slice(0, 1) : colours;
      lines.push(
        `Jacket segments clockwise from 12 o’clock: ${Array.from({ length: a.segments }, (_, i) => `${i + 1}: ${formatColour(palette[i % palette.length])}`).join("; ")}`,
      );
      if (design.jacket.showPinstripe)
        lines.push(
          `Pinstripes sit at each segment boundary: ${formatColour(design.jacket.pinstripe)}.`,
        );
    }
  }
  for (const l of design.layers.filter((l) => l.visible)) {
    const content =
      l.type === "text"
        ? `“${designLayerText(l)}” · ${DESIGN_FONTS[l.font].label}${l.bold ? " bold" : ""}${l.italic ? " italic" : ""}${l.curve !== "straight" ? ` · curve ${l.curve}` : ""}`
        : l.type === "image"
          ? `Artwork: ${l.name}`
          : l.type;
    lines.push(
      `${content}${l.type !== "image" ? ` · ${formatColour(l.colour)}` : ""}${l.surface === "jacket" ? " · jacket artwork" : ""}${production ? ` · size ${l.size}% · position ${l.x},${l.y}% · rotation ${l.rotation}°${l.type === "text" ? ` · spacing ${l.spacing}${l.curve !== "straight" ? ` · arc radius ${l.arcRadius ?? 320} · arc offset ${l.arcOffset ?? 0}% · ${l.fullArc ? "full-circle" : "semicircle"} path` : ""}` : ""} · opacity ${Math.round((l.opacity ?? 1) * 100)}% · scale ${l.scaleX ?? 1}×${l.scaleY ?? 1}${l.flipX ? " · flipped horizontally" : ""}${l.flipY ? " · flipped vertically" : ""}` : ""}`,
    );
  }
  if (production && design.productionNotes)
    lines.push(`Production notes: ${design.productionNotes}`);
  return lines;
}

export function designLegacyFields(design: CandyDesign) {
  const { jacket } = design;
  const base =
    jacket.mode === "segments"
      ? "two_colour"
      : jacket.mode === "solid"
        ? ""
        : jacket.mode;
  return {
    jacket:
      jacket.showPinstripe && base !== "rainbow"
        ? base === "two_colour"
          ? "two_colour_pinstripe"
          : "pinstripe"
        : base,
    jacket_type: jacket.mode,
    jacket_color_one: jacket.colours[0],
    jacket_color_two: jacket.colours[1] || jacket.colours[0],
    candy_fill_color: jacket.fill,
    pinstripe_color: jacket.pinstripe,
    design_text:
      design.layers
        .filter((l) => l.visible && l.type === "text")
        .map(designLayerText)
        .join(" / ") || design.name,
    text_color:
      design.layers.find((l) => l.type === "text")?.colour || "#333333",
    heart_color:
      design.layers.find((l) => l.type === "heart")?.colour || "#333333",
  };
}

/** Public custom-text layout, expressed as independently editable Studio layers. */
export function siteDefaultTextLayers(
  text: string,
  variant: "short" | "long" = "short",
  defaults: SiteDesignerDefaults = resolveSiteDesignerDefaults(),
): DesignLayer[] {
  const layout = getCustomTextLayout(text, variant);
  const textLayer = (
    value: string,
    id: string,
    fontSize: number,
    spacingEm: number,
    curve: DesignLayer["curve"] = "straight",
    yOffset = 0,
  ): DesignLayer => ({
    ...newDesignLayer("text", id, defaults),
    text: value.toUpperCase(),
    size: siteFontSizePercent(fontSize),
    spacing: Math.round(fontSize * spacingEm * 1000) / 1000,
    curve,
    y: 50 + siteFontSizePercent(yOffset),
  });
  if (!layout || layout.kind === "straight")
    return [
      textLayer(
        layout?.text || "",
        "text-1",
        Math.round(
          SITE.straightFontSize * shortCandyTextScale(layout?.text || ""),
        ),
        SITE.straightSpacingEm,
      ),
    ];
  if (layout.kind === "stacked") {
    const offsets = layout.words.length === 3 ? [-160, 0, 160] : [-105, 105];
    const size =
      layout.words.length === 3 ? SITE.genericFontSize : SITE.straightFontSize;
    return layout.words.map((word, index) =>
      textLayer(
        word,
        `text-${index + 1}`,
        size,
        SITE.stackedSpacingEm,
        "straight",
        offsets[index],
      ),
    );
  }
  const arcLayer = (
    value: string,
    id: string,
    curve: DesignLayer["curve"],
    yOffset = 0,
    single = false,
  ) => {
    const style = getCustomArcTextStyle(
      value,
      SITE.genericFontSize + 10,
      SITE.arcRadius,
      single ? 0.84 : undefined,
    );
    return textLayer(
      value,
      id,
      style.fontSize,
      Number.parseFloat(style.letterSpacing),
      curve,
      yOffset,
    );
  };
  if (layout.kind === "singleArc")
    return [arcLayer(layout.text, "text-1", "up", 0, true)];
  return [
    arcLayer(layout.top, "text-1", "up"),
    arcLayer(layout.bottom, "text-2", "down", SITE.lowerArcYOffset),
  ];
}

export function resetDesignLayerDefaults(
  layer: DesignLayer,
  defaults: SiteDesignerDefaults = resolveSiteDesignerDefaults(),
): DesignLayer {
  const baseline =
    layer.type === "text"
      ? siteDefaultTextLayers(layer.text, "short", defaults)[0]
      : newDesignLayer(layer.type, layer.id, defaults);
  return {
    ...baseline,
    id: layer.id,
    name: layer.name,
    text: layer.text,
    image: layer.image,
    visible: layer.visible,
  };
}

export function designFromOrder(
  order: Record<string, unknown>,
  defaults: SiteDesignerDefaults = resolveSiteDesignerDefaults(),
): CandyDesign {
  const saved = parseCandyDesign(order.candy_design);
  if (saved) return saved;
  const design = emptyCandyDesign(
    String(order.title || order.design_text || "Candy design"),
    defaults,
  );
  const jacket = String(order.jacket || order.jacket_type || "");
  design.jacket = {
    mode: jacket.includes("rainbow")
      ? "rainbow"
      : jacket.includes("two_colour")
        ? "two_colour"
        : "solid",
    colours: [
      hex(order.jacket_color_one, defaults.jacketColour),
      hex(order.jacket_color_two, defaults.jacketColour),
    ],
    fill: hex(order.candy_fill_color, SITE.fill),
    pinstripe: hex(order.pinstripe_color, SITE.pinstripe),
    showPinstripe: jacket.includes("pinstripe"),
  };
  const text =
    typeof order.design_text === "string"
      ? order.design_text
      : String(order.title || "");
  const wedding = String(order.category_id || "").startsWith("weddings");
  const names = text.split(/[♥❤]/u).map((n) =>
    n
      .replace(/\ufe0f/g, "")
      .trim()
      .toUpperCase(),
  );
  const initials = order.category_id === "weddings-initials";
  const textColour = hex(order.text_color, defaults.textColour);
  if (wedding) {
    const size = initials ? SITE.initialsFontSize : SITE.weddingFontSize;
    const spacing =
      size * (initials ? SITE.initialsSpacingEm : SITE.weddingSpacingEm);
    design.layers = [
      {
        ...newDesignLayer("text", "name-one", defaults),
        text: names[0] || "",
        x: initials ? 50 - siteFontSizePercent(SITE.initialsOffset) : 50,
        y: 50,
        curve: initials ? "straight" : "up",
        size: siteFontSizePercent(size),
        spacing,
        colour: textColour,
      },
      {
        ...newDesignLayer("heart", "heart", defaults),
        colour: hex(order.heart_color, defaults.textColour),
      },
      {
        ...newDesignLayer("text", "name-two", defaults),
        text: names[1] || "",
        x: initials ? 50 + siteFontSizePercent(SITE.initialsOffset) : 50,
        y: initials ? 50 : 50 + siteFontSizePercent(SITE.lowerArcYOffset),
        curve: initials ? "straight" : "down",
        size: siteFontSizePercent(size),
        spacing,
        colour: textColour,
      },
    ];
  } else {
    design.layers = siteDefaultTextLayers(
      text,
      order.category_id === "custom-7-14" ? "long" : "short",
      defaults,
    ).map((layer) => ({ ...layer, colour: textColour }));
  }
  // Legacy URLs are imported through the authenticated image importer in the studio.
  if (order.category_id === "branded" && designImageSource(order.logo_url))
    design.layers = [
      {
        ...newDesignLayer("image", "artwork", defaults),
        image: String(order.logo_url),
        name: "Existing artwork",
      },
    ];
  return design;
}
