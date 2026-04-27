export type LandingGalleryVariantKey =
  | "weddings-both-names"
  | "weddings-initials"
  | "custom-7-14"
  | "custom-1-6";

export type LandingGalleryVariantOption = {
  key: LandingGalleryVariantKey;
  label: string;
  uploadLabel: string;
  pathFragment: string;
};

type LandingGalleryVariantConfig = {
  top: LandingGalleryVariantOption;
  bottom: LandingGalleryVariantOption;
};

const LANDING_GALLERY_VARIANT_CONFIG: Record<string, LandingGalleryVariantConfig> = {
  "design/wedding-candy": {
    top: {
      key: "weddings-both-names",
      label: "Both names",
      uploadLabel: "Top row: Both names",
      pathFragment: "weddings-both-names",
    },
    bottom: {
      key: "weddings-initials",
      label: "Initials",
      uploadLabel: "Bottom row: Initials",
      pathFragment: "weddings-initials",
    },
  },
  "design/custom-text-candy": {
    top: {
      key: "custom-7-14",
      label: "15 characters max",
      uploadLabel: "Top row: 15 characters max",
      pathFragment: "custom-7-14",
    },
    bottom: {
      key: "custom-1-6",
      label: "1-6 letters",
      uploadLabel: "Bottom row: 1-6 letters",
      pathFragment: "custom-1-6",
    },
  },
};

function getLandingGalleryVariantConfig(slug: string) {
  return LANDING_GALLERY_VARIANT_CONFIG[slug] ?? null;
}

function buildRowsByParity(images: string[]) {
  if (images.length === 0) return [];

  const firstRow = images.filter((_, index) => index % 2 === 0);
  const secondRow = images.filter((_, index) => index % 2 === 1);

  if (secondRow.length === 0) return [firstRow];
  return [firstRow, secondRow];
}

export function getLandingGalleryVariantOptions(slug: string) {
  const config = getLandingGalleryVariantConfig(slug);
  return config ? [config.top, config.bottom] : [];
}

export function getLandingGalleryVariantLabel(slug: string, imageUrl: string) {
  const config = getLandingGalleryVariantConfig(slug);
  if (!config || !imageUrl) return null;

  const value = imageUrl.toLowerCase();
  if (value.includes(config.top.pathFragment)) return config.top.label;
  if (value.includes(config.bottom.pathFragment)) return config.bottom.label;
  return null;
}

export function resolveLandingGalleryUploadPath(slug: string, target: string | null | undefined) {
  const config = getLandingGalleryVariantConfig(slug);
  if (!config || !target) return "library";

  if (target === config.top.key) return `landing-gallery/${config.top.pathFragment}`;
  if (target === config.bottom.key) return `landing-gallery/${config.bottom.pathFragment}`;
  return "library";
}

export function buildLandingGalleryRows(slug: string, images: string[]) {
  const config = getLandingGalleryVariantConfig(slug);
  if (!config) return buildRowsByParity(images);

  const topRow: string[] = [];
  const bottomRow: string[] = [];
  const fallback: string[] = [];

  for (const imageUrl of images) {
    const value = imageUrl.toLowerCase();
    if (value.includes(config.top.pathFragment)) {
      topRow.push(imageUrl);
    } else if (value.includes(config.bottom.pathFragment)) {
      bottomRow.push(imageUrl);
    } else {
      fallback.push(imageUrl);
    }
  }

  for (const [index, imageUrl] of fallback.entries()) {
    if (index % 2 === 0) {
      topRow.push(imageUrl);
    } else {
      bottomRow.push(imageUrl);
    }
  }

  if (bottomRow.length === 0) return [topRow];
  return [topRow, bottomRow];
}
