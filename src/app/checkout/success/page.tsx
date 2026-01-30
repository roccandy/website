import HeaderNav from "@/components/HeaderNav";
import HeaderMenu from "@/components/HeaderMenu";
import { CheckoutSuccessClient } from "./CheckoutSuccessClient";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function CheckoutSuccessPage() {
  return (
    <main className="landing-bg min-h-screen text-zinc-900">
      <CheckoutSuccessClient />
      <div className="relative">
        <div className="sticky top-0 z-40 w-full border-b border-white/60 bg-white/90 backdrop-blur">
          <div className="mx-auto w-full max-w-6xl px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <a href="/" className="shrink-0">
                <img src="/branding/logo-gold.svg" alt="Roc Candy" className="h-20 md:h-24" />
              </a>
              <HeaderNav />
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href="mailto:admin@roccandy.com.au"
                  aria-label="Email Roc Candy"
                  className="inline-flex items-center justify-center text-[#e91e63] transition-colors hover:text-[#ff6781]"
                >
                  <svg viewBox="0 0 24 24" className="h-10 w-10" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M4 6.75A2.75 2.75 0 0 1 6.75 4h10.5A2.75 2.75 0 0 1 20 6.75v10.5A2.75 2.75 0 0 1 17.25 20H6.75A2.75 2.75 0 0 1 4 17.25V6.75Zm2.32-.25 5.21 3.55c.28.19.65.19.93 0l5.22-3.55a1.25 1.25 0 0 0-.43-.08H6.75c-.15 0-.3.03-.43.08Zm12.18 1.7-5.35 3.64a2.25 2.25 0 0 1-2.5 0L5.5 8.2v9.05c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25V8.2Z"
                    />
                  </svg>
                </a>
                <a
                  href="tel:0414519211"
                  aria-label="Call Roc Candy"
                  className="inline-flex items-center justify-center text-[#e91e63] transition-colors hover:text-[#ff6781]"
                >
                  <svg viewBox="0 0 24 24" className="h-10 w-10" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M7.1 3.5c.32 0 .62.15.82.41l2.12 2.75c.27.36.28.85.01 1.21l-1.4 1.86a12.5 12.5 0 0 0 5.72 5.72l1.86-1.4c.36-.27.85-.26 1.21.01l2.75 2.12c.26.2.41.5.41.82v1.33c0 .65-.46 1.2-1.09 1.31-1.2.21-2.4.32-3.6.32-6.5 0-11.78-5.28-11.78-11.78 0-1.2.11-2.4.32-3.6.11-.63.66-1.09 1.31-1.09H7.1Z"
                    />
                  </svg>
                </a>
                <HeaderMenu />
              </div>
            </div>
          </div>
        </div>

        <div className="relative mx-auto max-w-3xl px-6 py-16">
          <div className="rounded-3xl border border-zinc-200 bg-white/90 p-8 text-center shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Payment received</p>
            <h1 className="mt-3 text-3xl font-semibold text-zinc-900">Thank you for your order!</h1>
            <p className="mt-3 text-sm text-zinc-600">
              We’ve received your payment. You’ll get a confirmation email shortly, and our team will start
              preparing your order.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/premade"
                className="rounded-full border border-zinc-900 bg-zinc-900 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800"
              >
                Continue shopping
              </a>
              <a
                href="/quote"
                className="rounded-full border border-zinc-200 bg-white px-5 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300"
              >
                Start a new quote
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
