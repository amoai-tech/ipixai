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
                {/* W3C ARIA APG accordion pattern: each trigger is exposed as
                    a heading one level under this section's own h2, so
                    screen-reader heading navigation can jump straight to a
                    question. `role="heading"` + `aria-level` rather than a
                    literal <h3>: marketing.css's unlayered `.marketing h1-h4`
                    rule (deliberately unlayered so it beats Tailwind's
                    layered utilities — see that file's own comment) would
                    otherwise silently swap this button's Outfit/medium text
                    for the serif/600 heading style used everywhere else. */}
                <div role="heading" aria-level={3}>
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
                </div>
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
