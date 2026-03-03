import { getProductionBlocks, getSettings } from "@/lib/data";

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

function formatDisplayDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  const parsed = new Date(year, month - 1, day);
  const monthName = parsed.toLocaleString("en-AU", { month: "long" });
  return `${formatOrdinalDay(day)} ${monthName} ${year}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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

async function getActiveProductionBlockoutMessage() {
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
        message: `Production full between ${formatDisplayDate(block.start_date)} and ${formatDisplayDate(block.end_date)}`,
      });
    }
  }

  if (active.length === 0) return null;

  active.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  return active[0].message;
}

export default async function ProductionBlockoutBanner() {
  const message = await getActiveProductionBlockoutMessage();
  if (!message) return null;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pt-3">
      <div className="rounded-xl border border-[#ffb4c7] bg-[#fff3f7] px-4 py-2 text-center text-sm font-semibold normal-case text-[#b23b67] shadow-sm">
        {message}
      </div>
    </div>
  );
}

