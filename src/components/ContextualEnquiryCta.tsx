import Link from "next/link";
import { buildEnquiryHref, type EnquiryInterest } from "@/lib/enquiry";

type ContextualEnquiryCtaProps = {
  interest: EnquiryInterest;
  productContext: string;
  sourcePage: string;
  heading: string;
  description: string;
  buttonLabel: string;
  compact?: boolean;
};

export function ContextualEnquiryCta({
  interest,
  productContext,
  sourcePage,
  heading,
  description,
  buttonLabel,
  compact = false,
}: ContextualEnquiryCtaProps) {
  const href = buildEnquiryHref({ interest, productContext, sourcePage });

  if (compact) {
    return (
      <aside className="rounded-2xl border border-[#f3d4df] bg-[#fff8fa] p-4">
        <p className="text-sm font-semibold text-zinc-800">{heading}</p>
        <p className="mt-1 text-sm leading-6 text-zinc-600">{description}</p>
        <Link
          href={href}
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full border border-[#ff6f95] px-5 py-2 text-sm font-semibold text-[#d95582] transition hover:bg-[#fff0f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6f95] focus-visible:ring-offset-2"
        >
          {buttonLabel}
        </Link>
      </aside>
    );
  }

  return (
    <section className="rounded-3xl border border-[#f3d4df] bg-gradient-to-br from-white to-[#fff3f7] p-6 shadow-sm md:flex md:items-center md:justify-between md:gap-8 md:p-8">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d95582]">Need help first?</p>
        <h2 className="site-subsection-title mt-2 text-[rgb(114,112,111)]">{heading}</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">{description}</p>
      </div>
      <Link
        href={href}
        className="mt-5 inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-[#ff6f95] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(255,111,149,0.22)] transition hover:bg-[#ff4f80] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6f95] focus-visible:ring-offset-2 md:mt-0"
      >
        {buttonLabel}
      </Link>
    </section>
  );
}
