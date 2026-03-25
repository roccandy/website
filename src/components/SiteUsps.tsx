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
      <div className="inline-flex rounded-full border border-white/45 bg-white/45 px-4 py-2 text-center text-xs font-medium tracking-[0.08em] text-zinc-500 shadow-sm backdrop-blur">
        <span className="hidden sm:inline">{SITE_USP_LABELS.join(" | ")}</span>
        <span className="sm:hidden">
          {SITE_USP_LABELS.slice(0, 3).join(" | ")}
          <br />
          {SITE_USP_LABELS.slice(3).join(" | ")}
        </span>
      </div>
    </div>
  );
}
