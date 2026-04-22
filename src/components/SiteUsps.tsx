export const SITE_USP_LABELS = [
  "Vegan",
  "Gluten Free",
  "Dairy Free",
  "Handmade",
  "Aust Made",
  "Free Delivery",
];

export function SiteUsps({ className = "" }: { className?: string }) {
  return (
    <div className={`flex justify-center ${className}`.trim()}>
      <div
        className="inline-flex rounded-full border border-white/45 bg-white/45 px-[var(--space-usp-pill-padding-x-mobile)] py-[var(--space-usp-pill-padding-y-mobile)] text-center text-zinc-500 shadow-sm backdrop-blur text-[length:var(--type-public-usp-size-mobile)] font-[var(--type-public-usp-weight-mobile)] leading-[var(--type-public-usp-line-height-mobile)] [letter-spacing:var(--type-public-usp-letter-spacing-mobile)] md:px-[var(--space-usp-pill-padding-x-desktop)] md:py-[var(--space-usp-pill-padding-y-desktop)] md:text-[length:var(--type-public-usp-size-desktop)] md:font-[var(--type-public-usp-weight-desktop)] md:leading-[var(--type-public-usp-line-height-desktop)] md:[letter-spacing:var(--type-public-usp-letter-spacing-desktop)]"
      >
        <span className="hidden sm:inline">{SITE_USP_LABELS.join(" | ")}</span>
        <span className="sm:hidden">{SITE_USP_LABELS.join(" | ")}</span>
      </div>
    </div>
  );
}
