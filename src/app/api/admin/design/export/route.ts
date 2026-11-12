import { getAdminSession } from "@/lib/adminAuth";
import { parseCandyDesign, designSummary } from "@/lib/candyDesign";
import {
  candyDesignPng,
  candyDesignSvg,
  validateDesignImages,
} from "@/lib/candyDesignExport";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";
import type { DesignExportOptions } from "@/lib/candyDesignExport";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session || session.user.role === "seo")
    return new Response("Unauthorised", { status: 403 });
  try {
    const input = await request.json();
    const parsed = parseCandyDesign(input.design);
    if (!parsed) throw new Error("A design is required.");
    const design = await validateDesignImages(parsed);
    const format =
      input.format === "proof"
        ? "proof"
        : input.format === "pdf"
          ? "pdf"
          : input.format === "jpeg"
            ? "jpeg"
            : input.format === "svg"
              ? "svg"
              : "png";
    const options: DesignExportOptions = {
      view:
        input.view === "face"
          ? ("face" as const)
          : ("three-dimensional" as const),
      presentation: input.presentation === true,
      cropImages:
        input.cropImages === true && !["pdf", "proof"].includes(format),
      resolution:
        input.resolution === "native"
          ? "native"
          : [1, 2, 4, 6].includes(input.resolution)
            ? input.resolution
            : 1,
      width:
        Number.isInteger(input.width) && input.width >= 320 && input.width <= 5000
          ? input.width
          : undefined,
    };
    let bytes: Uint8Array | string;
    if (format === "svg") bytes = await candyDesignSvg(design, options);
    else {
      const png = await candyDesignPng(
        design,
        format === "proof"
          ? { ...options, view: "three-dimensional" }
          : options,
      );
      if (format === "pdf" || format === "proof") {
        const pdf = await PDFDocument.create();
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        const page = pdf.addPage([595, 842]);
        const image = await pdf.embedPng(png);
        page.drawText(design.name.replace(/[^\x20-\x7e]/g, " ").slice(0, 70), {
          x: 36,
          y: 794,
          size: 18,
          font,
        });
        if (format === "proof") {
          const face = await pdf.embedPng(
            await candyDesignPng(design, { ...options, view: "face" }),
          );
          page.drawText(
            `Customer design proof${design.source ? ` - revision ${design.source.revision}` : " - unsaved design"}`,
            { x: 36, y: 768, size: 11, font },
          );
          page.drawImage(image, { x: 36, y: 535, width: 300, height: 220 });
          page.drawImage(face, { x: 350, y: 550, width: 200, height: 200 });
          page.drawText("3D preview", { x: 36, y: 515, size: 10, font });
          page.drawText("Flat candy face", { x: 350, y: 515, size: 10, font });
        } else {
          const width = options.view === "face" ? 384 : 523;
          page.drawImage(image, { x: 36, y: 366, width, height: 384 });
        }
        const lines = designSummary(design).flatMap(
          (line) =>
            line
              .replace(/[^\x20-\x7e]/g, " ")
              .match(/.{1,90}(?:\s|$)|.{1,90}/g) || [],
        );
        let y = format === "proof" ? 485 : 350;
        let currentPage = page;
        for (const line of lines) {
          if (y < 40) {
            currentPage = pdf.addPage([595, 842]);
            y = 794;
          }
          currentPage.drawText(line, {
            x: 36,
            y,
            size: 10,
            font,
            color: rgb(0.2, 0.2, 0.2),
          });
          y -= 16;
        }
        bytes = await pdf.save();
      } else
        bytes =
          format === "jpeg"
            ? await sharp(png)
                .flatten({
                  background: design.presentation?.background ?? "#ffffff",
                })
                .jpeg({ quality: 95 })
                .toBuffer()
            : png;
    }
    const filename =
      design.name.replace(/[^a-z0-9_-]/gi, "-").slice(0, 80) || "candy-design";
    return new Response(
      typeof bytes === "string" ? bytes : new Uint8Array(bytes),
      {
        headers: {
          "Content-Type":
            format === "svg"
              ? "image/svg+xml"
              : format === "pdf" || format === "proof"
                ? "application/pdf"
                : format === "jpeg"
                  ? "image/jpeg"
                  : "image/png",
          "Content-Disposition": `attachment; filename="${filename}${format === "proof" ? "-proof.pdf" : format === "jpeg" ? ".jpg" : `.${format}`}"`,
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to export design.",
      },
      { status: 400 },
    );
  }
}
