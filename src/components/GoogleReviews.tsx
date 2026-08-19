type GoogleReviewsProps = {
  className?: string;
  showBorders?: boolean;
  transparent?: boolean;
};

const GOOGLE_REVIEWS_URL = "https://www.google.com/maps/search/?api=1&query=Roc%20Candy%20North%20Perth";

/** A quiet, in-flow trust marker. It never floats or obscures the page. */
export function GoogleReviews({ className = "", showBorders = true, transparent = false }: GoogleReviewsProps) {
  return (
    <aside
      aria-label="Roc Candy Google reviews"
      className={`${showBorders ? "border-y border-zinc-200" : ""} ${transparent ? "bg-transparent" : "bg-white/80"} px-1 py-3 text-center ${className}`}
    >
      <div className="flex flex-nowrap items-center justify-center gap-x-1.5 whitespace-nowrap md:gap-x-3">
        <div className="flex items-center gap-1 md:gap-2">
          <span className="text-sm font-bold text-[#4285f4] md:text-base" aria-hidden="true">G</span>
          <a
            href={GOOGLE_REVIEWS_URL}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-semibold text-zinc-700 hover:text-zinc-950 sm:text-xs md:text-sm"
          >
            Google reviews
          </a>
        </div>
        <span className="text-xs font-semibold text-zinc-800 md:text-sm">4.8</span>
        <span className="flex gap-0 text-[11px] text-[#e7ad48] sm:text-xs md:gap-0.5 md:text-base" aria-label="4.8 out of 5 stars">
          <span aria-hidden="true">★</span><span aria-hidden="true">★</span><span aria-hidden="true">★</span><span aria-hidden="true">★</span><span aria-hidden="true">★</span>
        </span>
        <span className="text-xs text-zinc-600 md:text-sm"><span className="hidden md:inline">from </span>106<span className="hidden md:inline"> reviews</span></span>
        <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noreferrer" className="hidden text-sm font-semibold text-zinc-700 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950 md:inline">
          Read reviews
        </a>
      </div>
    </aside>
  );
}
