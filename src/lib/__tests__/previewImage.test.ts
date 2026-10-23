import { describe, expect, it } from "vitest";
import { safePreviewLogoSource } from "@/lib/previewImage";

describe("safePreviewLogoSource", () => {
  it("keeps customer-uploaded raster image data", () => {
    const source = "data:image/png;base64,aGVsbG8=";
    expect(safePreviewLogoSource(source)).toBe(source);
  });

  it("rejects remote and non-image sources so the preview server cannot fetch them", () => {
    expect(safePreviewLogoSource("https://example.com/logo.png")).toBe("");
    expect(safePreviewLogoSource("http://169.254.169.254/latest/meta-data")).toBe("");
    expect(safePreviewLogoSource("data:text/html;base64,PGgxPkhlbGxvPC9oMT4=")).toBe("");
  });
});
