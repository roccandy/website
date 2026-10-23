const RASTER_IMAGE_DATA_URL = /^data:image\/(?:jpeg|png|webp|gif);base64,[a-z0-9+/=\s]+$/i;

/**
 * The preview-image route runs on the server. Only embed image data supplied by
 * the customer; do not let a public request make the server fetch a URL.
 */
export function safePreviewLogoSource(value: string | null | undefined) {
  const source = value?.trim() ?? "";
  return RASTER_IMAGE_DATA_URL.test(source) ? source : "";
}
