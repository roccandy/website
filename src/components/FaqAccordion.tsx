"use client";

import { useState } from "react";
import type { FaqContent } from "@/lib/faqs";

type Props = {
  items: FaqContent[];
};

function toSentenceCase(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
}

export default function FaqAccordion({ items }: Props) {
  const [openIndex, setOpenIndex] = useState(-1);

  return (
    <div className="w-full space-y-3">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <section key={item.question} className="w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpenIndex((current) => (current === index ? -1 : index))}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <h3 className="site-faq-question-title min-w-0 text-zinc-900">{toSentenceCase(item.question)}</h3>
              <span
                aria-hidden="true"
                className={`shrink-0 text-lg font-semibold text-[#ff6f95] transition-transform ${isOpen ? "rotate-180" : ""}`}
              >
                ˅
              </span>
            </button>
            <div
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="w-full border-t border-zinc-200 px-5 py-4 text-sm leading-relaxed text-zinc-700">
                  <div className="w-full break-words [&_*]:break-words" dangerouslySetInnerHTML={{ __html: item.answerHtml }} />
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
