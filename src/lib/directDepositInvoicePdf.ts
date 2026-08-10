import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

type InvoiceOrder = {
  order_number: string | null;
  title: string | null;
  order_description: string | null;
  quantity: number | null;
  total_price: number | null;
};

type DirectDepositInvoicePdfInput = {
  invoiceNumber: string;
  invoiceTitle: string;
  customerName: string | null;
  customerEmail: string | null;
  dueDate: string | null;
  orders: InvoiceOrder[];
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const BODY_SIZE = 9;
const LINE_HEIGHT = 13;
const ROC_CANDY_RED = rgb(0.67, 0.08, 0.14);
const DARK = rgb(0.12, 0.12, 0.13);
const MUTED = rgb(0.35, 0.35, 0.37);
const LIGHT = rgb(0.95, 0.95, 0.95);

const money = (amount: number | null | undefined) => {
  const numeric = Number(amount);
  return Number.isFinite(numeric) ? `$${numeric.toFixed(2)}` : "-";
};

const date = (value: string | null | undefined) => {
  if (!value) return "-";
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
};

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawTextBlock(input: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  width: number;
  font: PDFFont;
  size?: number;
  color?: ReturnType<typeof rgb>;
  lineHeight?: number;
}) {
  const size = input.size ?? BODY_SIZE;
  const lineHeight = input.lineHeight ?? LINE_HEIGHT;
  const lines = wrapText(input.text, input.font, size, input.width);
  lines.forEach((line, index) => {
    input.page.drawText(line, {
      x: input.x,
      y: input.y - index * lineHeight,
      size,
      font: input.font,
      color: input.color ?? DARK,
    });
  });
  return input.y - lines.length * lineHeight;
}

/** Creates the static tax invoice that Square emails as an invoice attachment. */
export async function buildDirectDepositInvoicePdf(input: DirectDepositInvoicePdfInput) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const addPage = () => {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  };
  const ensureRoom = (height: number) => {
    if (y - height < MARGIN + 120) addPage();
  };

  page.drawText("ROC CANDY PTY LTD", { x: MARGIN, y, size: 18, font: bold, color: ROC_CANDY_RED });
  page.drawText("TAX INVOICE", { x: PAGE_WIDTH - MARGIN - 104, y: y + 2, size: 13, font: bold, color: DARK });
  y -= 25;
  page.drawText("ABN 61 076 609 035", { x: MARGIN, y, size: BODY_SIZE, font: regular, color: MUTED });
  y -= 35;

  page.drawRectangle({ x: MARGIN, y: y - 56, width: PAGE_WIDTH - MARGIN * 2, height: 56, color: LIGHT });
  page.drawText("Invoice", { x: MARGIN + 12, y: y - 17, size: 8, font: bold, color: MUTED });
  page.drawText(input.invoiceNumber, { x: MARGIN + 12, y: y - 32, size: 10, font: bold, color: DARK });
  page.drawText("Due date", { x: 255, y: y - 17, size: 8, font: bold, color: MUTED });
  page.drawText(date(input.dueDate), { x: 255, y: y - 32, size: 10, font: bold, color: DARK });
  page.drawText("Customer", { x: 395, y: y - 17, size: 8, font: bold, color: MUTED });
  page.drawText((input.customerName || input.customerEmail || "Customer").slice(0, 27), {
    x: 395,
    y: y - 32,
    size: 10,
    font: bold,
    color: DARK,
  });
  y -= 82;

  page.drawText(input.invoiceTitle, { x: MARGIN, y, size: 12, font: bold, color: DARK });
  y -= 26;

  page.drawRectangle({ x: MARGIN, y: y - 20, width: PAGE_WIDTH - MARGIN * 2, height: 20, color: ROC_CANDY_RED });
  page.drawText("Description", { x: MARGIN + 10, y: y - 13, size: 8, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Qty", { x: 405, y: y - 13, size: 8, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Amount", { x: 472, y: y - 13, size: 8, font: bold, color: rgb(1, 1, 1) });
  y -= 29;

  input.orders.forEach((order) => {
    const description = [order.order_number ? `Order #${order.order_number}` : null, order.title || order.order_description || "Custom candy order"]
      .filter(Boolean)
      .join(" - ");
    const lines = wrapText(description, regular, BODY_SIZE, 330);
    const rowHeight = Math.max(28, lines.length * LINE_HEIGHT + 12);
    ensureRoom(rowHeight);
    page.drawLine({ start: { x: MARGIN, y: y - rowHeight }, end: { x: PAGE_WIDTH - MARGIN, y: y - rowHeight }, thickness: 0.5, color: LIGHT });
    drawTextBlock({ page, text: description, x: MARGIN + 10, y: y - 12, width: 330, font: regular });
    page.drawText(String(order.quantity ?? "-"), { x: 410, y: y - 12, size: BODY_SIZE, font: regular, color: DARK });
    page.drawText(money(order.total_price), { x: 472, y: y - 12, size: BODY_SIZE, font: regular, color: DARK });
    y -= rowHeight;
  });

  const total = input.orders.reduce((sum, order) => sum + (Number.isFinite(Number(order.total_price)) ? Number(order.total_price) : 0), 0);
  ensureRoom(148);
  y -= 18;
  page.drawText("Total (GST included)", { x: 345, y, size: 10, font: bold, color: DARK });
  page.drawText(money(total), { x: 472, y, size: 10, font: bold, color: DARK });
  y -= 18;
  page.drawText("GST included", { x: 345, y, size: BODY_SIZE, font: regular, color: MUTED });
  page.drawText(money(total / 11), { x: 472, y, size: BODY_SIZE, font: regular, color: MUTED });
  y -= 35;

  page.drawRectangle({ x: MARGIN, y: y - 83, width: PAGE_WIDTH - MARGIN * 2, height: 83, borderColor: ROC_CANDY_RED, borderWidth: 1 });
  page.drawText("PAY BY DIRECT DEPOSIT", { x: MARGIN + 12, y: y - 17, size: 10, font: bold, color: ROC_CANDY_RED });
  page.drawText("Account name: Roc Candy Pty Ltd", { x: MARGIN + 12, y: y - 35, size: BODY_SIZE, font: regular, color: DARK });
  page.drawText("BSB: 086 006     Account: 476028543", { x: MARGIN + 12, y: y - 50, size: BODY_SIZE, font: regular, color: DARK });
  page.drawText(`Reference: ${input.invoiceNumber}`, { x: MARGIN + 12, y: y - 65, size: BODY_SIZE, font: bold, color: DARK });
  y -= 104;

  page.drawText("Please email your remittance advice to admin@roccandy.com.au.", {
    x: MARGIN,
    y,
    size: 8,
    font: regular,
    color: MUTED,
  });
  page.drawText("Thank you for your order.", { x: MARGIN, y: MARGIN, size: 8, font: regular, color: MUTED });

  return document.save();
}
