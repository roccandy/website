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
    <section className={`site-faq-stack w-full ${className}`.trim()}>
      <div className="site-faq-heading-stack w-full">
        <p className="site-eyebrow text-zinc-500">Frequently Asked Questions</p>
        <h2 className="site-section-title text-[rgb(114,112,111)]">{heading}</h2>
      </div>
      <FaqAccordion items={items} />
    </section>
  );
}
