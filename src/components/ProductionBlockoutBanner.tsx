import { getActiveProductionBlockoutMessage } from "@/lib/productionBlockout";

export default async function ProductionBlockoutBanner() {
  const message = await getActiveProductionBlockoutMessage();
  if (!message) return null;

  return (
    <p className="normal-case text-sm font-semibold text-[#b23b67]">{message}</p>
  );
}
