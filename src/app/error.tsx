"use client";

import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-[70vh] bg-white px-6 py-16 text-zinc-900">
      <div className="mx-auto max-w-5xl">
        <div className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-[linear-gradient(180deg,rgba(255,246,249,0.95),rgba(255,255,255,1))] px-8 py-10 shadow-sm md:px-12 md:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <p className="site-eyebrow text-[#ff6f95]">Something went wrong</p>
            <h1 className="site-page-title mt-4 text-[rgb(114,112,111)]">
              We hit a temporary problem
            </h1>
            <p className="mt-4 text-base leading-relaxed text-zinc-600 md:text-lg">
              The page could not finish loading right now. Please try again. If the problem keeps happening,
              contact us and we will help from our side.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => reset()}
                className="rounded-full bg-[#ff6f95] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#ff4f80]"
              >
                Try again
              </button>
              <Link
                href="/"
                className="rounded-full border border-[#ffd3df] bg-white px-6 py-3 text-sm font-semibold text-[#ff6f95] transition hover:border-[#ffb7cb] hover:text-[#ff4f80]"
              >
                Back to home
              </Link>
            </div>

            {error.digest ? (
              <p className="mt-5 text-xs text-zinc-500">Reference: {error.digest}</p>
            ) : null}
          </div>

          <div className="mt-8 text-center text-sm text-zinc-500">
            Need help with an order?{" "}
            <a href="mailto:enquiries@roccandy.com.au" className="font-semibold text-[#ff6f95] hover:text-[#ff4f80]">
              Email us
            </a>{" "}
            or call{" "}
            <a href="tel:0414519211" className="font-semibold text-[#ff6f95] hover:text-[#ff4f80]">
              0414 519 211
            </a>
            .
          </div>
        </div>
      </div>
    </main>
  );
}
