import Link from "next/link";

export default function HeaderNav() {
  return (
    <div className="order-3 flex w-full flex-nowrap items-center justify-center gap-4 overflow-x-auto overflow-y-visible whitespace-nowrap px-1 pb-1 text-[15px] font-semibold normal-case tracking-normal text-[#ff6f95] md:order-none md:flex-1 md:flex-wrap md:justify-center md:gap-16 md:overflow-visible md:whitespace-normal md:px-0 md:pb-0 md:text-[17px]">
      <Link href="/design/wedding-candy" className="inline-flex min-h-11 items-center px-1 leading-none transition-colors hover:text-[#ff4f80] focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6f95]">
        Wedding
      </Link>
      <Link href="/design/custom-text-candy" className="inline-flex min-h-11 items-center px-1 leading-none transition-colors hover:text-[#ff4f80] focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6f95]">
        Text
      </Link>
      <Link href="/design/branded-logo-candy" className="inline-flex min-h-11 items-center px-1 leading-none transition-colors hover:text-[#ff4f80] focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6f95]">
        Branded
      </Link>
      <Link href="/pre-made-candy" className="inline-flex min-h-11 items-center px-1 leading-none transition-colors hover:text-[#ff4f80] focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6f95]">
        Pre-Made
      </Link>
    </div>
  );
}
