"use client";

export default function StatsError({ reset }: { reset: () => void }) {
  return (
    <section className="rounded-3xl border border-amber-200 bg-white p-8">
      <h1 className="text-xl font-semibold">We couldn’t load the stats hub</h1>
      <p className="mt-2 text-sm text-zinc-600">
        The order data is temporarily unavailable. Try loading it again.
      </p>
      <button
        onClick={reset}
        className="mt-5 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white"
      >
        Try again
      </button>
    </section>
  );
}
