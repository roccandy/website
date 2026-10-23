"use client";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <section
      className="rounded-2xl border border-amber-200 bg-white p-6 sm:p-8"
      role="alert"
    >
      <h1 className="text-xl font-semibold text-zinc-900">
        We couldn’t load this page
      </h1>
      <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-500">
        The workspace data is temporarily unavailable. Try again in a moment.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
      >
        Try again
      </button>
    </section>
  );
}
