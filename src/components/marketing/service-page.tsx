import Image from "next/image";
import Link from "next/link";
import { AnimatedSection } from "./animated-section";
import { CTASection } from "./cta-section";
import { Faq, type FaqItem } from "./faq";
import { JOURNEY_STEPS } from "./journey";

export interface ServiceUseCase {
  title: string;
  desc: string;
}

export interface ServiceHeroImage {
  src: string;
  alt: string;
}

// Shared body for the 5 canonical /services/* pages (IPI-1060). Each page
// supplies only its own copy/use-cases/FAQ/heroImage — hero shape, workflow
// strip, and CTA stay identical so the Brand → Plan → Book → Produce →
// Deliver story reads the same across every channel. heroImage is the
// approved MEDIA-001 visual (amoai-tech/luminaai public/images, same-org
// provenance); it is below the fold on every page so it loads lazily.
export function ServicePage({
  eyebrow,
  title,
  titleAccent,
  description,
  heroImage,
  useCases,
  faq,
}: {
  eyebrow: string;
  title: string;
  titleAccent: string;
  description: string;
  heroImage: ServiceHeroImage;
  useCases: readonly ServiceUseCase[];
  faq: readonly FaqItem[];
}) {
  return (
    <>
      <section className="relative pt-40 pb-24 lg:pb-32">
        <div className="mx-auto max-w-4xl px-6 text-center lg:px-12">
          <AnimatedSection>
            <p className="mb-6 text-sm font-medium uppercase tracking-[0.2em]" style={{ color: "var(--mk-text-muted)" }}>
              {eyebrow}
            </p>
            <h1 className="mb-8 text-4xl font-light leading-[1.1] md:text-5xl lg:text-6xl">
              {title}
              <br />
              <span className="italic">{titleAccent}</span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed md:text-lg" style={{ color: "var(--mk-text-muted)" }}>
              {description}
            </p>
            <Link
              href="/signup"
              className="inline-block px-8 py-4 text-sm font-medium uppercase tracking-wide text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--mk-text)" }}
            >
              Start Planning
            </Link>
          </AnimatedSection>
        </div>
      </section>

      <div className="mx-auto mb-24 w-full max-w-6xl px-6 lg:mb-32 lg:px-12">
        <div className="relative aspect-[21/9] w-full overflow-hidden">
          <Image
            src={heroImage.src}
            alt={heroImage.alt}
            fill
            sizes="(min-width: 1024px) 1152px, 100vw"
            className="object-cover"
          />
        </div>
      </div>

      <section className="py-24 lg:py-32" style={{ background: "var(--mk-surface)" }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <div className="grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-4" style={{ background: "var(--mk-border)" }}>
            {useCases.map((useCase) => (
              <div key={useCase.title} className="p-8 lg:p-10" style={{ background: "var(--mk-surface)" }}>
                <h3 className="mb-3 text-xl font-medium">{useCase.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--mk-text-muted)" }}>
                  {useCase.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <AnimatedSection className="mb-16 text-center">
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em]" style={{ color: "var(--mk-text-muted)" }}>
              How It Works
            </p>
            <h2 className="text-4xl font-light md:text-5xl">Brand to Delivered Content</h2>
          </AnimatedSection>
          <div className="grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-5" style={{ background: "var(--mk-border)" }}>
            {JOURNEY_STEPS.map((step) => (
              <div key={step.title} className="p-8 lg:p-10" style={{ background: "var(--mk-surface)" }}>
                <h3 className="mb-3 text-xl font-medium">{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--mk-text-muted)" }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Faq items={faq} />
      <CTASection />
    </>
  );
}
