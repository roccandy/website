type FooterLink = {
  label: string;
  href: string;
};

const CATEGORY_LINKS: FooterLink[] = [
  { label: "Branded", href: "/design?type=branded" },
  { label: "Wedding", href: "/design?type=weddings" },
  { label: "Text", href: "/design?type=text" },
  { label: "Design Your Own", href: "/design" },
  { label: "Pre-Made", href: "/pre-made-candy" },
  { label: "Gallery", href: "/#gallery" },
];

const INFO_LINKS: FooterLink[] = [
  { label: "FAQ", href: "/faq" },
  { label: "About", href: "/about" },
  { label: "Blog", href: "/#blog" },
  { label: "Contact", href: "__CONTACT__" },
];

const LEGAL_LINKS: FooterLink[] = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms and Conditions", href: "/terms-and-conditions" },
];

const PAYMENT_BADGES: Array<{ label: string; src: string; iconClassName?: string }> = [
  { label: "PayPal", src: "/payment-logos/paypal.svg" },
  { label: "American Express", src: "/payment-logos/american-express.svg" },
  { label: "Apple Pay", src: "/payment-logos/apple-pay.svg", iconClassName: "h-4" },
  { label: "Mastercard", src: "/payment-logos/mastercard.svg" },
  { label: "Visa", src: "/payment-logos/visa.svg" },
];

function IconButton({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className="inline-flex h-16 w-16 items-center justify-center rounded-md bg-[#ff5f99] text-white transition hover:bg-[#ff4f8d]"
    >
      {children}
    </a>
  );
}

export default function SiteFooter() {
  const enquiriesEmail = process.env.ENQUIRIES_EMAIL?.trim() || "enquiries@roccandy.com.au";
  const enquiriesHref = `mailto:${enquiriesEmail}`;
  const infoLinks = INFO_LINKS.map((link) =>
    link.href === "__CONTACT__" ? { ...link, href: enquiriesHref } : link
  );

  return (
    <footer className="site-footer mt-14 border-t border-[#d8d8d1] bg-[#efefeb] text-[#8e8e88]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col items-center gap-5 text-center">
          <a href="/" aria-label="Roc Candy home">
            <img src="/branding/logo-gold.svg" alt="Roc Candy" className="h-24 w-auto" />
          </a>
          <p className="max-w-4xl normal-case text-[17px] text-[#9f9f99]">
            53 View St, North Perth (not open to the public)
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <IconButton href="https://www.facebook.com/RocCandyPages/" label="Facebook">
              <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M14 8h2V5h-2c-2.76 0-5 2.24-5 5v2H7v3h2v4h3v-4h2.1l.4-3H12v-2c0-1.1.9-2 2-2Z"
                />
              </svg>
            </IconButton>

            <IconButton href="https://www.instagram.com/roccandyyum/" label="Instagram">
              <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" rx="4" ry="4" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="12" cy="12" r="3.8" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="17" cy="7" r="1.1" fill="currentColor" />
              </svg>
            </IconButton>

            <IconButton href="tel:0414519211" label="Phone">
              <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M7.1 3.5c.32 0 .62.15.82.41l2.12 2.75c.27.36.28.85.01 1.21l-1.4 1.86a12.5 12.5 0 0 0 5.72 5.72l1.86-1.4c.36-.27.85-.26 1.21.01l2.75 2.12c.26.2.41.5.41.82v1.33c0 .65-.46 1.2-1.09 1.31-1.2.21-2.4.32-3.6.32-6.5 0-11.78-5.28-11.78-11.78 0-1.2.11-2.4.32-3.6.11-.63.66-1.09 1.31-1.09H7.1Z"
                />
              </svg>
            </IconButton>

            <IconButton href={enquiriesHref} label="Email">
              <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M4 6.75A2.75 2.75 0 0 1 6.75 4h10.5A2.75 2.75 0 0 1 20 6.75v10.5A2.75 2.75 0 0 1 17.25 20H6.75A2.75 2.75 0 0 1 4 17.25V6.75Zm2.32-.25 5.21 3.55c.28.19.65.19.93 0l5.22-3.55a1.25 1.25 0 0 0-.43-.08H6.75c-.15 0-.3.03-.43.08Zm12.18 1.7-5.35 3.64a2.25 2.25 0 0 1-2.5 0L5.5 8.2v9.05c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25V8.2Z"
                />
              </svg>
            </IconButton>
          </div>

          <nav className="mt-2 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {CATEGORY_LINKS.map((link) => (
              <a
                key={`category-${link.label}`}
                href={link.href}
                className="normal-case text-[16px] text-[#ff6f95] transition hover:text-[#ff4f80]"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <div className="border-t border-[#d8d8d1]">
        <div className="mx-auto max-w-6xl px-6 py-7">
          <div className="grid gap-5 md:grid-cols-2 md:items-center">
            <nav className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 md:justify-start">
              {infoLinks.map((link) => (
                <a
                  key={`info-${link.label}`}
                  href={link.href}
                  className="normal-case text-[16px] text-[#ff6f95] transition hover:text-[#ff4f80]"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <nav className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 md:justify-end">
              {LEGAL_LINKS.map((link) => (
                <a
                  key={`legal-${link.label}`}
                  href={link.href}
                  className="normal-case text-[16px] text-[#ff6f95] transition hover:text-[#ff4f80]"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {PAYMENT_BADGES.map((badge) => (
              <span
                key={badge.label}
                className="inline-flex h-8 min-w-[56px] items-center justify-center rounded-sm border border-[#bcbcb4] bg-[#d5d5d0] px-2"
                title={badge.label}
                aria-label={badge.label}
              >
                <img
                  src={badge.src}
                  alt={badge.label}
                  className={`h-3.5 w-auto object-contain ${badge.iconClassName ?? ""}`}
                  loading="lazy"
                />
              </span>
            ))}
          </div>

          <p className="mt-3 text-center normal-case text-[18px] text-[#6f6f6f]">© roccandy.com.au</p>
        </div>
      </div>
    </footer>
  );
}
