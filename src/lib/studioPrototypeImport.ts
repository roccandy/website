import {
  DEFAULT_ADVANCED_JACKET,
  DESIGN_FONTS,
  newDesignLayer,
  parseCandyDesign,
  studioCandyDesign,
  designFaceRadius,
  type DesignLayer,
} from "@/lib/candyDesign";

const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const finite = (v: unknown, fallback: number) =>
  Number.isFinite(Number(v)) ? Number(v) : fallback;
/** Treat the standalone JSON as data only. Never execute imported scripts or URLs. */
export async function importPrototypeProject(
  input: unknown,
  upload: (
    image: string,
  ) => Promise<{ image: string; imageWidth: number; imageHeight: number }>,
) {
  const v = record(input),
    j = record(v.jacket),
    warnings: string[] = [];
  if (v.v !== 1 || !Array.isArray(v.layers) || v.layers.length > 20)
    throw new Error(
      "Unsupported prototype project. Choose a .rcmock.json design with up to 20 layers.",
    );
  const design = studioCandyDesign(
    typeof v.caption === "string" ? v.caption : "Imported mockup",
  );
  design.jacket = {
    mode:
      j.style === "solid"
        ? "solid"
        : j.style === "rainbow"
          ? "rainbow"
          : "segments",
    colours: [j.colorA, j.colorB, j.colorC, j.colorD].slice(
      0,
      Math.max(1, Math.min(4, finite(j.cols, 2))),
    ) as string[],
    fill: String(j.face || "#ffffff"),
    pinstripe: String(j.pin || "#ffffff"),
    showPinstripe: j.style === "pin",
    advanced: {
      ...DEFAULT_ADVANCED_JACKET,
      segments: finite(j.segments, 8),
      gap: finite(j.gap, 0.15),
      ring: finite(j.ring, 0.19),
      shading: finite(j.shade, 0.35),
      shadow: j.shadow !== false,
    },
  };
  design.presentation = {
    background: String(v.bg || "#ffffff"),
    transparent: v.transparent === true,
  };
  const oldInner = 290 * (1 - finite(j.ring, 0.19)),
    ratio = designFaceRadius(design) / oldInner;
  design.layers = await Promise.all(
    v.layers.map(async (value, i) => {
      const l = record(value),
        type =
          l.type === "arc"
            ? "text"
            : l.type === "paint"
              ? "image"
              : String(l.type);
      if (!["text", "heart", "image"].includes(type))
        throw new Error(
          `Unsupported prototype layer: ${type}. Export it as PNG from the original editor.`,
        );
      const fontName = String(l.font || "Helvetica");
      const key =
        (
          {
            Helvetica: "site",
            Arial: "site",
            Roboto: "sans",
            "Courier New": "mono",
            Georgia: "serif",
          } as Record<string, string>
        )[fontName] ||
        Object.entries(DESIGN_FONTS).find(
          ([, font]) => font.label === fontName,
        )?.[0];
      if (!key || fontName === "Georgia" || fontName === "Courier New")
        warnings.push(
          `${fontName} uses ${DESIGN_FONTS[(key || "site") as keyof typeof DESIGN_FONTS].label}; check the lettering before using the design.`,
        );
      const layer: DesignLayer = {
        ...newDesignLayer(type as DesignLayer["type"], `import-${i}`),
        name: typeof l.name === "string" ? l.name : type,
        x: 50 + ((finite(l.x, 462) - 462) / (oldInner * 2)) * 100,
        y: 50 + ((finite(l.y, 470) - 470) / (oldInner * 2)) * 100,
        size: (finite(l.size, 100) / (oldInner * 2)) * 100,
        rotation: finite(l.rot, 0),
        opacity: finite(l.opacity, 1),
        visible: l.visible !== false,
        colour: String(l.color || "#333333"),
        text: typeof l.text === "string" ? l.text : "",
        font: (key || "site") as DesignLayer["font"],
        uppercase: l.caps === true,
        bold: l.bold === true,
        italic: l.italic === true,
        spacing: finite(l.spacing, 0) * ratio,
        fullArc: true,
      };
      if (l.type === "arc") {
        layer.curve = l.side === "bottom" ? "down" : "up";
        layer.arcRadius = finite(l.radiusF, 0.72) * designFaceRadius(design);
        layer.rotation = finite(l.angle, 0);
      }
      if (type === "image") {
        if (
          typeof l.img !== "string" ||
          l.img.length > 27_000_000 ||
          !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(l.img)
        )
          throw new Error(
            "Prototype images must be embedded PNG/JPEG/WebP artwork.",
          );
        const asset = await upload(l.img);
        Object.assign(layer, asset);
        layer.aspectRatio = asset.imageWidth / asset.imageHeight;
        layer.size =
          ((asset.imageWidth * finite(l.scale, 1)) / (oldInner * 2)) * 100;
        if (l.type === "paint") {
          layer.surface = l.jacketOnly === false ? "face" : "jacket";
          layer.frame = "scene";
          layer.x = 50;
          layer.y = 50;
          layer.size = 100;
          layer.aspectRatio = 1772 / 1300;
          warnings.push(
            "Imported paint has been fitted to Roc Candy’s renderer. Check its colour placement in the 3D preview.",
          );
        }
      }
      if (l.clip === false)
        warnings.push(
          "The prototype contained unclipped artwork. Candy previews clip to their production surface; use Crop to image layers for standalone artwork.",
        );
      return layer;
    }),
  );
  if (j.show === false)
    warnings.push(
      "The prototype hid the candy. Use Crop to image layers to export its standalone artwork.",
    );
  const parsed = parseCandyDesign(design)!;
  return { design: parsed, warnings: [...new Set(warnings)] };
}
