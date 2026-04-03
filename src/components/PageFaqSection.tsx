import FaqAccordion from "@/components/FaqAccordion";
import type { FaqContent } from "@/lib/faqs";

type PageFaqSectionProps = {
  heading?: string | null;
  items: FaqContent[];
  className?: string;
};

export function PageFaqSection({
  heading = "Common Questions",
  items,
  className = "",
}: PageFaqSectionProps) {
  if (items.length === 0) return null;

  return (
    <section className={`space-y-4 ${className}`.trim()}>
      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-500">Frequently Asked Questions</p>
        <h2 className="text-2xl font-semibold tracking-tight text-[rgb(114,112,111)]">{heading}</h2>
      </div>
      <FaqAccordion items={items} />
    </section>
  );
}
