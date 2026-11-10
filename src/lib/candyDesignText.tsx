import { create, type Font } from "fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReactNode } from "react";
import {
  DESIGN_FONTS,
  designFaceRadius,
  designLayerText,
  type CandyDesign,
  type DesignLayer,
} from "@/lib/candyDesign";

const fonts = new Map<string, Promise<Font>>();
async function designFont(layer: DesignLayer) {
  const files = {
    // Arimo is the openly licensed Arial-compatible export face for the site's generic stack.
    site: layer.italic ? "Arimo-Italic.ttf" : "Arimo.ttf",
    sans: layer.italic ? "Roboto-Italic.ttf" : "Roboto.ttf",
    serif: "RobotoSlab.ttf",
    mono: layer.italic ? "RobotoMono-Italic.ttf" : "RobotoMono.ttf",
  };
  const key = `${files[layer.font]}:${layer.bold}`;
  if (!fonts.has(key))
    fonts.set(
      key,
      readFile(
        path.join(process.cwd(), "public/design-fonts", files[layer.font]),
      ).then((bytes) => {
        const font = create(bytes) as Font;
        return font.getVariation({ wght: layer.bold ? 700 : 400 });
      }),
    );
  return fonts.get(key)!;
}

/** SVG glyph outlines keep font choice/weight identical on every email/PDF server. */
export async function candyTextOutlines(
  design: CandyDesign,
): Promise<Record<string, ReactNode>> {
  const entries = await Promise.all(
    design.layers
      .filter((layer) => layer.type === "text" && layer.visible)
      .map(async (layer) => {
        const font = await designFont(layer);
        const text = designLayerText(layer);
        for (const char of text) {
          if (
            !/\s/u.test(char) &&
            !font.hasGlyphForCodePoint(char.codePointAt(0)!)
          )
            throw new Error(
              `The selected font does not contain “${char}”. Choose another font, a shape, or uploaded artwork.`,
            );
        }
        const size =
          (layer.size / 100) *
          (layer.frame === "scene" ? 1772 : designFaceRadius(design) * 2);
        const scale = size / font.unitsPerEm;
        const lines =
          layer.curve === "straight"
            ? text.split("\n")
            : [text.replace(/\n/g, " ")];
        const glyphs = lines.flatMap((line, lineIndex) => {
          const run = font.layout(line);
          const width =
            run.positions.reduce(
              (total, position) => total + position.xAdvance * scale,
              0,
            ) +
            Math.max(0, run.glyphs.length - 1) * layer.spacing;
          const baseline = (font.xHeight * scale) / 2;
          let advance = 0;
          return run.glyphs.map((glyph, index) => {
            const position = run.positions[index];
            const glyphAdvance = position.xAdvance * scale;
            const midpoint = advance + glyphAdvance / 2 - width / 2;
            advance += glyphAdvance + layer.spacing;
            let x = midpoint,
              y = (lineIndex - (lines.length - 1) / 2) * size * 1.15,
              rotation = 0;
            if (layer.curve !== "straight") {
              const radius = layer.arcRadius ?? 320,
                pathLength = Math.PI * radius * (layer.fullArc ? 2 : 1),
                distance =
                  pathLength * (0.5 + (layer.arcOffset ?? 0) / 100) + midpoint;
              if (distance < 0 || distance > pathLength) return null;
              const angle =
                layer.curve === "up"
                  ? (layer.fullArc ? Math.PI / 2 : Math.PI) + distance / radius
                  : (layer.fullArc ? Math.PI * 1.5 : Math.PI) -
                    distance / radius;
              x = radius * Math.cos(angle);
              y = radius * Math.sin(angle);
              rotation =
                ((layer.curve === "up"
                  ? angle + Math.PI / 2
                  : angle - Math.PI / 2) *
                  180) /
                Math.PI;
            }
            return (
              <g
                key={`${lineIndex}-${index}`}
                transform={`translate(${x} ${y}) rotate(${rotation})`}
              >
                <path
                  d={glyph.path.toSVG()}
                  transform={`translate(${-glyphAdvance / 2 + position.xOffset * scale} ${baseline - position.yOffset * scale}) ${layer.italic && layer.font === "serif" ? "skewX(-12) " : ""}scale(${scale} ${-scale})`}
                  fill={layer.colour}
                />
              </g>
            );
          });
        });
        return [
          layer.id,
          <g key={layer.id} data-outlined-font={DESIGN_FONTS[layer.font].label}>
            <title>{text}</title>
            {glyphs}
          </g>,
        ] as const;
      }),
  );
  return Object.fromEntries(entries);
}
