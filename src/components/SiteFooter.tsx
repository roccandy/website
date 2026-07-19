import Image from "next/image";
import Link from "next/link";
import { ContactUsButton } from "@/components/ContactUsButton";

type FooterLink = {
  label: string;
  href: string;
};

const CATEGORY_LINKS: FooterLink[] = [
  { label: "Branded", href: "/design/branded-logo-candy" },
  { label: "Wedding", href: "/design/wedding-candy" },
  { label: "Text", href: "/design/custom-text-candy" },
  { label: "Design Your Own", href: "/design" },
  { label: "Pre-Made", href: "/pre-made-candy" },
];

const INFO_LINKS: FooterLink[] = [
  { label: "FAQs", href: "/faqs" },
  { label: "About", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
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
      className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-[#ff5f99] text-white transition hover:bg-[#ff4f8d]"
    >
      {children}
    </a>
  );
}

export default function SiteFooter() {
  const enquiriesEmail = process.env.ENQUIRIES_EMAIL?.trim() || "enquiries@roccandy.com.au";
  const enquiriesHref = `mailto:${enquiriesEmail}`;

  return (
    <footer className="site-footer mt-10 border-t border-[#d8d8d1] bg-[#efefeb] text-[#8e8e88]">
      <div className="mx-auto max-w-6xl px-6 py-7">
        <div className="flex flex-col items-center gap-3 text-center">
          <Link href="/" aria-label="Roc Candy home">
            <Image src="/branding/logo-gold.svg" alt="Roc Candy" width={160} height={64} className="h-16 w-40" />
          </Link>
          <p className="max-w-4xl normal-case text-[14px] text-[#5f5f5b]">
            53 View St, North Perth (not open to the public)
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <IconButton href="https://www.facebook.com/RocCandyPages/" label="Facebook">
              <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M14 8h2V5h-2c-2.76 0-5 2.24-5 5v2H7v3h2v4h3v-4h2.1l.4-3H12v-2c0-1.1.9-2 2-2Z"
                />
              </svg>
            </IconButton>

            <IconButton href="https://www.instagram.com/roccandyyum/" label="Instagram">
              <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" rx="4" ry="4" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="12" cy="12" r="3.8" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="17" cy="7" r="1.1" fill="currentColor" />
              </svg>
            </IconButton>

            <ContactUsButton
              email={enquiriesEmail}
              emailHref={enquiriesHref}
              variant="footer"
              placement="top"
              align="center"
            />
          </div>

          <nav className="mt-1 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {CATEGORY_LINKS.map((link) => (
              <Link
                key={`category-${link.label}`}
                href={link.href}
                className="inline-flex min-h-10 items-center normal-case text-[14px] font-medium text-[#ff6f95] transition hover:text-[#ff4f80] focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6f95]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="border-t border-[#d8d8d1]">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {INFO_LINKS.map((link) => (
              <Link
                key={`info-${link.label}`}
                href={link.href}
                className="inline-flex min-h-10 items-center normal-case text-[14px] font-medium text-[#ff6f95] transition hover:text-[#ff4f80] focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6f95]"
              >
                {link.label}
              </Link>
            ))}

            <div className="mx-1 flex flex-wrap items-center justify-center gap-1.5">
              {PAYMENT_BADGES.map((badge) => (
                <span
                  key={badge.label}
                  className="inline-flex h-6 min-w-[44px] items-center justify-center rounded-sm border border-[#bcbcb4] bg-[#d5d5d0] px-1.5"
                  title={badge.label}
                  aria-label={badge.label}
                >
                  <Image
                    src={badge.src}
                    alt={badge.label}
                    width={48}
                    height={12}
                    className={`h-3 w-auto object-contain ${badge.iconClassName ?? ""}`}
                  />
                </span>
              ))}
            </div>

            {LEGAL_LINKS.map((link) => (
              <Link
                key={`legal-${link.label}`}
                href={link.href}
                className="inline-flex min-h-10 items-center normal-case text-[14px] font-medium text-[#ff6f95] transition hover:text-[#ff4f80] focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6f95]"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <p className="mt-2 text-center normal-case text-[13px] text-[#5f5f5f]">© roccandy.com.au</p>
        </div>
      </div>
    </footer>
  );
}
