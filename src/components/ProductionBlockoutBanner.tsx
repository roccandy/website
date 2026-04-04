import { getActiveProductionBlockoutMessage } from "@/lib/productionBlockout";

export default async function ProductionBlockoutBanner() {
  const message = await getActiveProductionBlockoutMessage();
  if (!message) return null;

  return (
    <div className="border-t border-[#f3c1d0] bg-[#fff5f8] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <div className="mx-auto max-w-6xl px-6 py-2.5 text-center">
        <p className="normal-case text-sm font-semibold text-[#b23b67]">{message}</p>
      </div>
    </div>
  );
}
