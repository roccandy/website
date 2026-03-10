"use client";

import Link from "next/link";

export default function HeaderNav() {
  return (
    <div className="order-3 flex w-full flex-nowrap items-center justify-start gap-5 overflow-x-auto overflow-y-visible whitespace-nowrap px-1 pb-1 text-[15px] font-semibold normal-case tracking-normal text-[#ff6f95] md:order-none md:flex-1 md:flex-wrap md:justify-center md:gap-17 md:overflow-visible md:whitespace-normal md:px-0 md:pb-0 md:text-[17px]">
      <Link href="/design/wedding-candy" className="leading-none transition-colors hover:text-[#ff4f80]">
        Wedding
      </Link>
      <Link href="/design/custom-text-candy" className="leading-none transition-colors hover:text-[#ff4f80]">
        Text
      </Link>
      <Link href="/design/branded-logo-candy" className="leading-none transition-colors hover:text-[#ff4f80]">
        Branded
      </Link>
      <Link href="/pre-made-candy" className="leading-none transition-colors hover:text-[#ff4f80]">
        Pre-Made
      </Link>
      <Link href="/#gallery" className="leading-none transition-colors hover:text-[#ff4f80]">
        Gallery
      </Link>
    </div>
  );
}
