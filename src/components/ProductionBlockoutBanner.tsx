import { getActiveProductionBlockoutMessage } from "@/lib/productionBlockout";

type ProductionBlockoutBannerProps = {
  message?: string | null;
};

export default async function ProductionBlockoutBanner({ message: providedMessage }: ProductionBlockoutBannerProps = {}) {
  const message = providedMessage ?? (await getActiveProductionBlockoutMessage());
  if (!message) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-full z-10 -mt-px overflow-hidden pb-4"
      data-production-blockout-banner
    >
      <div className="bg-[#fff5f8]/95 shadow-[0_4px_10px_rgba(63,63,70,0.36)] backdrop-blur-sm">
        <div className="site-banner-inner mx-auto max-w-6xl px-6 text-center">
          <p className="normal-case text-sm font-semibold text-[#b23b67]">{message}</p>
        </div>
      </div>
    </div>
  );
}
