import { getActiveProductionBlockoutMessage } from "@/lib/productionBlockout";

export default async function ProductionBlockoutBanner() {
  const message = await getActiveProductionBlockoutMessage();
  if (!message) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-full z-10 -mt-px border-t border-[#f3c1d0] bg-[#fff5f8]/95 shadow-[0_10px_22px_rgba(178,59,103,0.14),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-6 py-2 text-center">
        <p className="normal-case text-sm font-semibold text-[#b23b67]">{message}</p>
      </div>
    </div>
  );
}
