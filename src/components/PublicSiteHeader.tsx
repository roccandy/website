import Image from "next/image";
import Link from "next/link";
import { ContactUsButton } from "@/components/ContactUsButton";
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

function getEmailFromHref(href: string) {
  const withoutProtocol = href.replace(/^mailto:/i, "");
  const [email] = withoutProtocol.split("?");
  return decodeURIComponent(email || href);
}

export default async function PublicSiteHeader({
  enquiriesHref,
  logoPriority = false,
  className = DEFAULT_HEADER_CLASS_NAME,
  dataQuoteHeader = false,
}: PublicSiteHeaderProps) {
  const bannerMessage = await getSiteBannerMessage();
  const resolvedClassName = bannerMessage ? className.replace(" shadow-[0_4px_10px_rgba(63,63,70,0.36)]", "") : className;
  const enquiriesEmail = getEmailFromHref(enquiriesHref);

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
            <ContactUsButton email={enquiriesEmail} emailHref={enquiriesHref} />
            <HeaderMenu />
          </div>
        </div>
      </div>
      <ProductionBlockoutBanner message={bannerMessage} />
    </div>
  );
}
