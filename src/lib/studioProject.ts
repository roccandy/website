import {
  designAssetKey,
  parseCandyDesign,
  type CandyDesign,
} from "@/lib/candyDesign";

export const MAX_STUDIO_PROJECT_BYTES = 64_000_000;
export type StudioProject = {
  format: "roccandy-studio";
  version: 1;
  design: CandyDesign;
  assets: Record<string, string>;
};
export function parseStudioProject(raw: unknown): StudioProject {
  if (!raw || typeof raw !== "object")
    throw new Error("Choose a valid Studio project.");
  if (JSON.stringify(raw).length > MAX_STUDIO_PROJECT_BYTES)
    throw new Error("Choose a Studio project up to 64MB.");
  const value = raw as Record<string, unknown>;
  const design = parseCandyDesign(
    value.format === "roccandy-studio" && value.version === 1
      ? value.design
      : value,
  );
  if (!design) throw new Error("The project contains no design.");
  const assets =
    value.format === "roccandy-studio" &&
    value.assets &&
    typeof value.assets === "object"
      ? (value.assets as Record<string, string>)
      : {};
  for (const layer of design.layers)
    if (layer.type === "image" && designAssetKey(layer.image)) {
      const asset = assets[layer.image];
      if (
        value.format === "roccandy-studio" &&
        (!asset ||
          asset.length > 27_000_000 ||
          !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(asset))
      )
        throw new Error(
          "The portable project is missing its artwork or contains an invalid image.",
        );
    }
  delete design.source;
  // Outlines from an imported file are not an authority for its editable text.
  delete design.textGeometry;
  return { format: "roccandy-studio", version: 1, design, assets };
}
