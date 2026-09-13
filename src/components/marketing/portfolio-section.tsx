import Image from "next/image";
import { AnimatedSection } from "./animated-section";

// Portfolio grid — 6-tile span grid. None of these tiles is the page LCP
// element (the hero image is), so they load lazily.
//
// PROVENANCE: UNVERIFIED — see hero-section.tsx's provenance note. These 6
// files share the same Lovable-scaffolding origin (commit 29833eed); do not
// claim iPix ownership in alt text/comments without an actual license record.
// Container is max-w-7xl (80rem) with px-6 (1.5rem/side) below lg, lg:px-12
// (3rem/side) at lg+; grid is grid-cols-2 lg:grid-cols-4 gap-1 (0.25rem).
// A single-span tile is exactly half (mobile) or a quarter (desktop) of that
// content width, matching SINGLE_SIZES below. "Product" spans 2 columns
// (unprefixed col-span-2 applies at every breakpoint, not just lg+) so it's
// full-width on mobile and half-width on desktop — a distinct `sizes` value,
// not the single-span default (a CodeRabbit finding on PR #141, confirmed:
// the shared "25vw"/"50vw" undersized this tile at both breakpoints).
const SINGLE_SIZES = "(min-width: 1024px) calc((min(100vw, 80rem) - 6rem) / 4 - 0.1875rem), calc((100vw - 3rem) / 2 - 0.125rem)";
const PRODUCT_SIZES = "(min-width: 1024px) calc((min(100vw, 80rem) - 6rem) / 2 - 0.125rem), calc(100vw - 3rem)";

const items = [
  { label: "Fashion", span: "row-span-2", src: "/images/portfolio-fashion.jpg", sizes: SINGLE_SIZES },
  { label: "Watches", span: "", src: "/images/portfolio-watch.jpg", sizes: SINGLE_SIZES },
  { label: "Jewellery", span: "", src: "/images/portfolio-jewellery.jpg", sizes: SINGLE_SIZES },
  { label: "Product", span: "col-span-2", src: "/images/portfolio-product.jpg", sizes: PRODUCT_SIZES },
  { label: "eCommerce", span: "", src: "/images/portfolio-ecommerce.jpg", sizes: SINGLE_SIZES },
  { label: "Still Life", span: "", src: "/images/portfolio-stilllife.jpg", sizes: SINGLE_SIZES },
] as const;

export function PortfolioSection() {
  return (
    <section id="portfolio" className="py-24 lg:py-32" style={{ background: "var(--mk-bg)" }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <AnimatedSection className="mb-20 text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em]" style={{ color: "var(--mk-text-muted)" }}>
            Selected Work
          </p>
          <h2 className="text-4xl font-light md:text-5xl">Portfolio</h2>
        </AnimatedSection>

        <div className="grid grid-cols-2 gap-1 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.label} className={`group relative min-h-[250px] overflow-hidden ${item.span}`}>
              <Image
                src={item.src}
                alt={`${item.label} photography`}
                fill
                sizes={item.sizes}
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-end bg-black/10 p-6 transition-colors duration-500 group-hover:bg-black/30">
                <span className="text-sm font-medium uppercase tracking-wide text-white">
                  {item.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
