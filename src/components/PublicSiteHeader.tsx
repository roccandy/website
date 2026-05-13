import Image from "next/image";
import Link from "next/link";
import HeaderMenu from "@/components/HeaderMenu";
import HeaderNav from "@/components/HeaderNav";
import LandingTopLinksBar from "@/components/LandingTopLinksBar";
import ProductionBlockoutBanner from "@/components/ProductionBlockoutBanner";
import { getSiteBannerMessage } from "@/lib/productionBlockout";

type PublicSiteHeaderProps = {
  enquiriesHref: string;
  logoPriority?: boolean;
  className?: string;
  dataQuoteHeader?: boolean;
};

const DEFAULT_HEADER_CLASS_NAME =
  "sticky top-0 z-40 w-full border-b border-white/60 bg-white/90 backdrop-blur shadow-[0_4px_10px_rgba(63,63,70,0.36)]";

export default async function PublicSiteHeader({
  enquiriesHref,
  logoPriority = false,
  className = DEFAULT_HEADER_CLASS_NAME,
  dataQuoteHeader = false,
}: PublicSiteHeaderProps) {
  const bannerMessage = await getSiteBannerMessage();
  const resolvedClassName = bannerMessage ? className.replace(" shadow-[0_4px_10px_rgba(63,63,70,0.36)]", "") : className;

  return (
    <div className={resolvedClassName} data-site-header="true" data-quote-header={dataQuoteHeader ? "true" : undefined}>
      <LandingTopLinksBar />
      <div className="site-header-inner mx-auto w-full max-w-6xl px-6">
        <div className="site-header-row flex flex-wrap items-center justify-between">
          <Link href="/" className="shrink-0">
            <Image
              src="/branding/logo-gold.svg"
              alt="Roc Candy"
              width={240}
              height={96}
              className="h-20 w-auto md:h-24"
              data-header-logo
              priority={logoPriority}
            />
          </Link>
          <HeaderNav />
          <div className="site-header-actions flex shrink-0 items-center">
            <a
              href={enquiriesHref}
              aria-label="Email Roc Candy"
              className="inline-flex items-center justify-center text-[#ff6f95] transition-colors hover:text-[#ff4f80]"
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
              className="inline-flex items-center justify-center text-[#ff6f95] transition-colors hover:text-[#ff4f80]"
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
      <ProductionBlockoutBanner message={bannerMessage} />
    </div>
  );
}
