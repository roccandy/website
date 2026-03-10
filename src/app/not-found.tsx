import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Page Not Found | Roc Candy",
  description: "The page you were looking for could not be found.",
  path: "/404",
  noIndex: true,
});

const QUICK_LINKS = [
  {
    title: "Design your candy",
    description: "Build a custom wedding, branded or text candy order.",
    href: "/design",
  },
  {
    title: "Pre-made candy",
    description: "Shop ready-to-order candy for gifts and events.",
    href: "/pre-made-candy",
  },
  {
    title: "About Roc Candy",
    description: "Learn about the brand, ingredients and handmade process.",
    href: "/about",
  },
  {
    title: "FAQs",
    description: "Find answers on delivery, production times and ordering.",
    href: "/faq",
  },
];

export default function NotFound() {
  return (
    <main className="min-h-[70vh] bg-white px-6 py-16 text-zinc-900">
      <div className="mx-auto max-w-5xl">
        <div className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-[linear-gradient(180deg,rgba(255,246,249,0.95),rgba(255,255,255,1))] px-8 py-10 shadow-sm md:px-12 md:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#ff6f95]">404</p>
            <h1 className="mt-4 normal-case text-4xl font-semibold tracking-tight text-[rgb(114,112,111)] md:text-5xl">
              This candy wandered off the tray
            </h1>
            <p className="mt-4 text-base leading-relaxed text-zinc-600 md:text-lg">
              The page you were looking for could not be found, but the rest of the shop is still right here.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/"
                className="rounded-full bg-[#ff6f95] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#ff4f80]"
              >
                Back to home
              </Link>
              <Link
                href="/design"
                className="rounded-full border border-[#ffd3df] bg-white px-6 py-3 text-sm font-semibold text-[#ff6f95] transition hover:border-[#ffb7cb] hover:text-[#ff4f80]"
              >
                Start a custom order
              </Link>
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-2xl border border-zinc-200 bg-white px-5 py-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
              >
                <p className="normal-case text-lg font-semibold text-[rgb(114,112,111)]">{link.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{link.description}</p>
              </Link>
            ))}
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
