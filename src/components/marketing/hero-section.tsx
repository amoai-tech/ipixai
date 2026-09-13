import Image from "next/image";
import Link from "next/link";
import { AnimatedSection } from "./animated-section";

// Home hero: split copy/visual, two CTAs. Visual is the approved MEDIA-001
// hero image (amoai-tech/luminaai public/images, same-org provenance) — this
// is the page's LCP element, so it loads eager/preload rather than lazily.
// "Get Started" is an acquisition CTA — it targets /signup
// (IPI-1157 · AUTH-UX-001), not sign-in-only /login.
export function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center pt-20">
      <div className="mx-auto w-full max-w-7xl px-6 lg:px-12">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <AnimatedSection className="max-w-xl">
            <p className="mb-6 text-sm font-medium uppercase tracking-[0.2em]" style={{ color: "var(--mk-text-muted)" }}>
              AI-Powered Content Studio
            </p>
            <h1 className="mb-8 text-5xl font-light leading-[1.05] md:text-6xl lg:text-7xl">
              From Brand to
              <br />
              <span className="italic font-light">Delivered Content.</span>
            </h1>
            <p className="mb-10 max-w-prose text-base leading-relaxed md:text-lg" style={{ color: "var(--mk-text-muted)" }}>
              Bring your brand, plan the shoot, book the talent, produce the
              imagery, and deliver on-brand assets — one platform, from concept
              to delivery.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="px-8 py-4 text-center text-sm font-medium uppercase tracking-wide text-white transition-opacity hover:opacity-90"
                style={{ background: "var(--mk-text)" }}
              >
                Get Started
              </Link>
              <Link
                href="#process"
                className="px-8 py-4 text-center text-sm font-medium uppercase tracking-wide transition-colors"
                style={{ border: "1px solid var(--mk-text)" }}
              >
                How It Works
              </Link>
            </div>
          </AnimatedSection>

          <AnimatedSection className="relative h-[500px] lg:h-[600px]">
            <Image
              src="/images/hero-product.jpg"
              alt="iPix-produced product photography"
              fill
              preload
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}