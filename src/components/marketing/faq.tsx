"use client";

import { useState } from "react";
import { AnimatedSection } from "./animated-section";

export interface FaqItem {
  question: string;
  answer: string;
}

// Native accordion — one open panel at a time, no library. The answer panel
// stays mounted (toggled via `hidden`) so `aria-controls` always points at a
// real element; `aria-expanded` on the button is the only state a screen
// reader needs.
export function Faq({ items }: { items: readonly FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-24 lg:py-32" style={{ background: "var(--mk-surface)" }}>
      <div className="mx-auto max-w-3xl px-6 lg:px-12">
        <AnimatedSection className="mb-16 text-center">
          <h2 className="text-4xl font-light md:text-5xl">Frequently Asked Questions</h2>
        </AnimatedSection>
        <div>
          {items.map((item, i) => {
            const open = openIndex === i;
            const panelId = `faq-panel-${i}`;
            return (
              <div key={item.question} style={{ borderBottom: "1px solid var(--mk-border)" }}>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(open ? null : i)}
                  className="flex w-full items-center justify-between gap-4 py-6 text-left text-lg font-medium"
                >
                  {item.question}
                  <span aria-hidden="true" style={{ color: "var(--mk-text-muted)" }}>
                    {open ? "−" : "+"}
                  </span>
                </button>
                <div id={panelId} hidden={!open} className="pb-6 text-sm leading-relaxed" style={{ color: "var(--mk-text-muted)" }}>
                  {item.answer}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
