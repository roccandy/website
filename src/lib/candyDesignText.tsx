import { create, type Font } from "fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  DESIGN_FONTS,
  designFaceRadius,
  designLayerText,
  type CandyDesign,
  type DesignLayer,
} from "@/lib/candyDesign";
import {
  textGeometrySignature,
  renderTextGeometry,
  type TextGeometry,
} from "@/lib/candyTextGeometry";

const fonts = new Map<string, Promise<Font>>();
async function designFont(layer: DesignLayer) {
  const files = {
    site: layer.italic ? "Arimo-Italic.ttf" : "Arimo.ttf",
    sans: layer.italic ? "Roboto-Italic.ttf" : "Roboto.ttf",
    serif: "RobotoSlab.ttf",
    mono: layer.italic ? "RobotoMono-Italic.ttf" : "RobotoMono.ttf",
  };
  const file =
    layer.font in files
      ? files[layer.font as keyof typeof files]
      : layer.font === "poppins"
        ? `poppins${layer.bold ? "-Bold" : ""}${layer.italic ? "Italic" : ""}.ttf`.replace(
            "poppinsItalic",
            "poppins-Italic",
          )
        : `${layer.font}${layer.italic && DESIGN_FONTS[layer.font].italic ? "-Italic" : ""}.ttf`;
  const key = `${file}:${layer.bold}`;
  if (!fonts.has(key))
    fonts.set(
      key,
      readFile(path.join(process.cwd(), "public/design-fonts", file)).then(
        (bytes) => {
          const font = create(bytes) as Font;
          return font.variationAxes?.wght
            ? font.getVariation({ wght: layer.bold ? 700 : 400 })
            : font;
        },
      ),
    );
  return fonts.get(key)!;
}
/** Canonical glyph positions and outlines, consumed by browser and server alike. */
export async function candyTextGeometry(
  design: CandyDesign,
): Promise<TextGeometry> {
  const layers = await Promise.all(
    design.layers
      .filter((l) => l.type === "text" && l.visible)
      .map(async (layer) => {
        const font = await designFont(layer),
          text = designLayerText(layer);
        for (const char of text)
          if (
            !/\s/u.test(char) &&
            !font.hasGlyphForCodePoint(char.codePointAt(0)!)
          )
            throw new Error(
              `The selected font does not contain “${char}”. Choose another font, a shape, or uploaded artwork.`,
            );
        const size =
            (layer.size / 100) *
            (layer.frame === "scene" ? 1772 : designFaceRadius(design) * 2),
          scale = size / font.unitsPerEm;
        const strokeWidth =
          layer.bold && !font.variationAxes?.wght && layer.font !== "poppins"
            ? font.unitsPerEm * 0.015
            : 0;
        const lines =
          layer.curve === "straight"
            ? text.split("\n")
            : [text.replace(/\n/g, " ")];
        const glyphs: TextGeometry["layers"][string]["glyphs"] = [],
          points: [number, number][] = [];
        let width = 0,
          clipped = 0;
        lines.forEach((line, lineIndex) => {
          const run = font.layout(line),
            lineWidth =
              run.positions.reduce(
                (total, p) => total + p.xAdvance * scale,
                0,
              ) +
              Math.max(0, run.glyphs.length - 1) * layer.spacing;
          width = Math.max(width, lineWidth);
          const baseline = (font.xHeight * scale) / 2;
          let advance = 0;
          run.glyphs.forEach((glyph, index) => {
            const p = run.positions[index],
              glyphAdvance = p.xAdvance * scale,
              midpoint = advance + glyphAdvance / 2 - lineWidth / 2;
            advance += glyphAdvance + layer.spacing;
            let x = midpoint,
              y = (lineIndex - (lines.length - 1) / 2) * size * 1.15,
              rotation = 0;
            if (layer.curve !== "straight") {
              const r = layer.arcRadius ?? 320,
                length = Math.PI * r * (layer.fullArc ? 2 : 1),
                distance =
                  length * (0.5 + (layer.arcOffset ?? 0) / 100) + midpoint;
              if (distance < 0 || distance > length) {
                clipped++;
                return;
              }
              const angle =
                layer.curve === "up"
                  ? (layer.fullArc ? Math.PI / 2 : Math.PI) + distance / r
                  : (layer.fullArc ? Math.PI * 1.5 : Math.PI) - distance / r;
              x = r * Math.cos(angle);
              y = r * Math.sin(angle);
              rotation =
                ((layer.curve === "up"
                  ? angle + Math.PI / 2
                  : angle - Math.PI / 2) *
                  180) /
                Math.PI;
            }
            const dx = -glyphAdvance / 2 + p.xOffset * scale,
              dy = baseline - p.yOffset * scale;
            const syntheticItalic =
              layer.italic && !DESIGN_FONTS[layer.font].italic;
            const transform = `translate(${x} ${y}) rotate(${rotation}) translate(${dx} ${dy}) ${syntheticItalic ? "skewX(-12) " : ""}scale(${scale} ${-scale})`;
            const d = glyph.path.toSVG();
            glyphs.push({ d, transform });
            const cos = Math.cos((rotation * Math.PI) / 180),
              sin = Math.sin((rotation * Math.PI) / 180),
              skew = syntheticItalic ? Math.tan((-12 * Math.PI) / 180) : 0;
            if (d)
              for (const gx of [glyph.bbox.minX, glyph.bbox.maxX])
                for (const gy of [glyph.bbox.minY, glyph.bbox.maxY]) {
                  const px = dx + gx * scale - gy * scale * skew,
                    py = dy - gy * scale;
                  points.push([
                    x + px * cos - py * sin,
                    y + px * sin + py * cos,
                  ]);
                }
          });
        });
        return [
          layer.id,
          {
            text,
            font: DESIGN_FONTS[layer.font].label,
            width,
            points,
            clipped,
            glyphs,
            ...(strokeWidth ? { strokeWidth } : {}),
          },
        ] as const;
      }),
  );
  return {
    signature: textGeometrySignature(design),
    layers: Object.fromEntries(layers),
  };
}
export async function candyTextOutlines(design: CandyDesign) {
  return renderTextGeometry(await candyTextGeometry(design));
}
