import Link from "next/link";
import type { AdminActivityEntry } from "@/lib/adminActivity";

const ACTIVITY_TIME_ZONE = "Australia/Perth";

function formatTimestamp(value: string) {
  try {
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: ACTIVITY_TIME_ZONE,
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatActionLabel(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function resolveActorLabel(entry: AdminActivityEntry) {
  return entry.actorName?.trim() || entry.actorEmail?.trim() || "Admin";
}

export function AdminActivityFeed({
  entries,
  compact = false,
}: {
  entries: AdminActivityEntry[];
  compact?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
        No logged admin changes yet.
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {entries.map((entry) => {
        const changedFields = compact ? entry.changedFields.slice(0, 3) : entry.changedFields;

        return (
          <div
            key={entry.id}
            className={`rounded-3xl border border-zinc-200 bg-zinc-50/70 ${compact ? "px-3 py-2.5" : "px-4 py-3"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className={compact ? "min-w-0 space-y-1.5" : "min-w-0 space-y-2"}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                    {formatActionLabel(entry.action)}
                  </span>
                  {entry.entityLabel ? <span className="text-xs font-medium text-zinc-500">{entry.entityLabel}</span> : null}
                </div>
                <p className={compact ? "text-[13px] font-medium leading-snug text-zinc-900" : "text-sm font-medium text-zinc-900"}>
                  {entry.summary}
                </p>
                <p className="text-xs text-zinc-500">
                  {resolveActorLabel(entry)} · {formatTimestamp(entry.createdAt)}
                </p>
                {changedFields.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {changedFields.map((field) => (
                      <span
                        key={`${entry.id}-${field}`}
                        className="inline-flex rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[10px] font-medium text-zinc-600"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              {entry.path ? (
                <Link
                  href={entry.path}
                  className="inline-flex shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100"
                >
                  Open
                </Link>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
