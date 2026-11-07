import { getAdminSession } from "@/lib/adminAuth";
import { parseCandyDesign, designSummary } from "@/lib/candyDesign";
import {
  candyDesignPng,
  candyDesignSvg,
  validateDesignImages,
} from "@/lib/candyDesignExport";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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
      input.format === "pdf" ? "pdf" : input.format === "svg" ? "svg" : "png";
    let bytes: Uint8Array | string;
    if (format === "svg") bytes = await candyDesignSvg(design);
    else {
      const png = await candyDesignPng(design);
      if (format === "pdf") {
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
        page.drawImage(image, { x: 36, y: 366, width: 523, height: 384 });
        const lines = designSummary(design).flatMap(
          (line) =>
            line
              .replace(/[^\x20-\x7e]/g, " ")
              .match(/.{1,90}(?:\s|$)|.{1,90}/g) || [],
        );
        let y = 350;
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
      } else bytes = png;
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
              : format === "pdf"
                ? "application/pdf"
                : "image/png",
          "Content-Disposition": `attachment; filename="${filename}.${format}"`,
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
