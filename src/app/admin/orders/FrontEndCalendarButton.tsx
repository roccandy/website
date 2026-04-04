"use client";

import { useMemo, useState } from "react";
import type { QuoteBlock } from "@/lib/data";
import { addQuoteBlock, removeQuoteBlock } from "./actions";

type Props = {
  blocks: QuoteBlock[];
};

const dayLabelClass = "text-[10px] uppercase tracking-[0.2em] text-zinc-400";

const buildDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString(undefined, { month: "long", year: "numeric" });

export function FrontEndCalendarButton({ blocks }: Props) {
  const [open, setOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const todayKey = useMemo(() => buildDateKey(new Date()), []);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const start = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (start.getDay() + 6) % 7;
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    return Array.from({ length: totalCells }, (_, idx) => {
      const day = idx - startOffset + 1;
      return new Date(year, month, day);
    });
  }, [calendarMonth]);
  const blockedByDate = useMemo(() => {
    const map = new Map<string, QuoteBlock>();
    blocks.forEach((block) => {
      const start = block.start_date;
      const end = block.end_date;
      if (!start || !end) return;
      const cursor = new Date(`${start}T00:00:00`);
      const endDate = new Date(`${end}T00:00:00`);
      while (cursor <= endDate) {
        map.set(buildDateKey(cursor), block);
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return map;
  }, [blocks]);
  const selectedRange = useMemo(() => {
    if (!rangeStart) return null;
    const end = rangeEnd || rangeStart;
    return rangeStart <= end ? { start: rangeStart, end } : { start: end, end: rangeStart };
  }, [rangeEnd, rangeStart]);

  const handleDayClick = (key: string, isBlocked: boolean) => {
    if (isBlocked) return;
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(key);
      setRangeEnd("");
      return;
    }
    if (!rangeEnd) {
      setRangeEnd(key);
    }
  };

  const movePrev = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  const moveNext = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
      >
        Front-end calendar
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-4xl rounded-2xl border border-zinc-200 bg-white p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Quote tool calendar</p>
                <h3 className="admin-subsection-title text-zinc-900">Front-end calendar</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <label className={`block ${dayLabelClass}`}>
                  Start date
                  <input
                    type="date"
                    value={rangeStart}
                    onChange={(event) => setRangeStart(event.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                  />
                </label>
                <label className={`block ${dayLabelClass}`}>
                  End date
                  <input
                    type="date"
                    value={rangeEnd}
                    onChange={(event) => setRangeEnd(event.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                  />
                </label>
                <form action={addQuoteBlock} className="flex items-end gap-2">
                  <input type="hidden" name="start_date" value={selectedRange?.start ?? rangeStart} />
                  <input
                    type="hidden"
                    name="end_date"
                    value={selectedRange?.end ?? (rangeEnd || rangeStart)}
                  />
                  <button
                    type="submit"
                    disabled={!rangeStart}
                    className="rounded border border-zinc-900 bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-200"
                  >
                    Block range
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => {
                    setRangeStart("");
                    setRangeEnd("");
                  }}
                  className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                >
                  Clear selection
                </button>
              </div>
              {selectedRange && (
                <p className="text-xs text-zinc-500">
                  Selected: {selectedRange.start}
                  {selectedRange.end !== selectedRange.start ? ` to ${selectedRange.end}` : ""}
                </p>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-zinc-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={movePrev}
                    className="rounded border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={moveNext}
                    className="rounded border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                  >
                    Next
                  </button>
                </div>
                <span className="text-sm font-semibold text-zinc-800">{formatMonthLabel(calendarMonth)}</span>
              </div>
              <div className="mt-3 grid grid-cols-7 gap-2 text-[11px] uppercase tracking-[0.2em] text-zinc-400">
                {"Mon Tue Wed Thu Fri Sat Sun".split(" ").map((day) => (
                  <div key={day} className="text-center">
                    {day}
                  </div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-2">
                {calendarDays.map((day) => {
                  const key = buildDateKey(day);
                  const inMonth = day.getMonth() === calendarMonth.getMonth();
                  if (!inMonth) {
                    return (
                      <div
                        key={key}
                        className="min-h-[110px] rounded-lg border border-transparent bg-transparent"
                      />
                    );
                  }
                  const blocked = blockedByDate.get(key) ?? null;
                  const isSelected =
                    selectedRange && key >= selectedRange.start && key <= selectedRange.end ? true : false;
                  const isToday = key === todayKey;
                  return (
                    <div
                      key={key}
                      className={`min-h-[110px] rounded-lg border px-2 py-2 text-xs ${
                        "border-zinc-200"
                      } ${blocked ? "cursor-not-allowed bg-zinc-100 text-zinc-400" : "bg-white hover:border-zinc-300"} ${
                        isSelected ? "ring-2 ring-zinc-900" : isToday ? "ring-1 ring-zinc-400" : ""
                      }`}
                      style={{ userSelect: "none", WebkitUserSelect: "none", msUserSelect: "none" }}
                      onClick={() => handleDayClick(key, Boolean(blocked))}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`${inMonth ? "text-zinc-700" : "text-zinc-300"}`}>{day.getDate()}</span>
                      </div>
                      {blocked ? (
                        <div className="mt-2 space-y-2">
                          <p className="text-[10px] font-semibold text-zinc-700">{blocked.reason ?? "Blocked"}</p>
                          <form action={removeQuoteBlock}>
                            <input type="hidden" name="id" value={blocked.id} />
                            <button
                              type="submit"
                              className="rounded border border-zinc-200 bg-white px-2 py-1 text-[10px] font-semibold text-zinc-600 hover:border-zinc-300"
                            >
                              Unblock
                            </button>
                          </form>
                        </div>
                      ) : (
                        <p className="mt-2 text-[10px] text-zinc-400">Available</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Blocked ranges</p>
              {blocks.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">No blocks yet.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {blocks.map((block) => (
                    <div
                      key={block.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-200 px-3 py-2 text-sm"
                    >
                      <span>
                        {block.start_date}
                        {block.end_date !== block.start_date ? ` to ${block.end_date}` : ""}
                      </span>
                      <form action={removeQuoteBlock}>
                        <input type="hidden" name="id" value={block.id} />
                        <button
                          type="submit"
                          className="rounded border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
