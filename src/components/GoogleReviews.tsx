type GoogleReviewsProps = {
  className?: string;
};

const GOOGLE_REVIEWS_URL = "https://www.google.com/maps/search/?api=1&query=Roc%20Candy%20North%20Perth";

/** A quiet, in-flow trust marker. It never floats or obscures the page. */
export function GoogleReviews({ className = "" }: GoogleReviewsProps) {
  return (
    <aside
      aria-label="Roc Candy Google reviews"
      className={`border-y border-zinc-200 bg-white/80 px-1 py-3 text-center ${className}`}
    >
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-[#4285f4]" aria-hidden="true">G</span>
          <span className="text-sm font-semibold text-zinc-700">Google reviews</span>
        </div>
        <span className="text-sm font-semibold text-zinc-800">4.8</span>
        <span className="flex gap-0.5 text-[#e7ad48]" aria-label="4.8 out of 5 stars">
          <span aria-hidden="true">★</span><span aria-hidden="true">★</span><span aria-hidden="true">★</span><span aria-hidden="true">★</span><span aria-hidden="true">★</span>
        </span>
        <span className="text-sm text-zinc-600">from 106 reviews</span>
        <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noreferrer" className="text-sm font-semibold text-zinc-700 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950">
          Read reviews
        </a>
      </div>
    </aside>
  );
}
