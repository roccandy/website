import HeaderNav from "@/components/HeaderNav";
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
      <div className="site-header-inner relative mx-auto w-full max-w-6xl px-4 lg:px-6">
        <HeaderNav
          enquiriesEmail={enquiriesEmail}
          enquiriesHref={enquiriesHref}
          logoPriority={logoPriority}
        />
      </div>
      <ProductionBlockoutBanner message={bannerMessage} />
    </div>
  );
}
