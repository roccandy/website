export default function StatsLoading() {
  return (
    <div
      role="status"
      aria-label="Loading stats hub"
      className="animate-pulse space-y-6"
    >
      <div className="h-28 rounded-3xl bg-zinc-200" />
      <div className="h-24 rounded-2xl bg-zinc-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-36 rounded-2xl bg-zinc-200" />
        ))}
      </div>
      <div className="h-80 rounded-3xl bg-zinc-200" />
      <span className="sr-only">Loading order reporting data…</span>
    </div>
  );
}
