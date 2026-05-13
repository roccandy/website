import { getProductionBlocks, getSettings } from "@/lib/data";

export const FREE_DELIVERY_BANNER_MESSAGE = "Free Delivery Australia-Wide";

function isOpenOverrideReason(reason: string | null | undefined) {
  return (reason ?? "").trim().toLowerCase() === "open override";
}

function formatOrdinalDay(day: number) {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  const mod10 = day % 10;
  if (mod10 === 1) return `${day}st`;
  if (mod10 === 2) return `${day}nd`;
  if (mod10 === 3) return `${day}rd`;
  return `${day}th`;
}

function formatDisplayDateFromDate(date: Date) {
  const monthName = date.toLocaleString("en-AU", { month: "long" });
  return `${formatOrdinalDay(date.getDate())} ${monthName} ${date.getFullYear()}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseIsoDateAtStart(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

type ActiveBlock = {
  startDate: Date;
  endDate: Date;
  message: string;
};

export async function getActiveProductionBlockoutMessage() {
  const [settings, blocks] = await Promise.all([getSettings(), getProductionBlocks()]);
  const monthsRaw = Number(settings.quote_blockout_months ?? 3);
  const visibilityMonths = Number.isFinite(monthsRaw) ? Math.min(12, Math.max(1, Math.floor(monthsRaw))) : 3;

  const today = startOfDay(new Date());
  const active: ActiveBlock[] = [];

  for (const block of blocks) {
    if (isOpenOverrideReason(block.reason)) continue;

    const startDate = parseIsoDateAtStart(block.start_date);
    const endDate = parseIsoDateAtStart(block.end_date);
    if (!startDate || !endDate) continue;

    const visibleFrom = new Date(startDate);
    visibleFrom.setMonth(visibleFrom.getMonth() - visibilityMonths);

    if (today >= startOfDay(visibleFrom) && today <= startOfDay(endDate)) {
      active.push({
        startDate,
        endDate,
        message: `Deliveries resume ${formatDisplayDateFromDate(addDays(endDate, 1))} due to limited production`,
      });
    }
  }

  if (active.length === 0) return null;

  active.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  return active[0].message;
}

export async function getSiteBannerMessage() {
  return (await getActiveProductionBlockoutMessage()) ?? FREE_DELIVERY_BANNER_MESSAGE;
}
