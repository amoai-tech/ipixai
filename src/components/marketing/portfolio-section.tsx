import Image from "next/image";
import { AnimatedSection } from "./animated-section";

// Portfolio grid — 6-tile span grid. None of these tiles is the page LCP
// element (the hero image is), so they load lazily.
//
// PROVENANCE: UNVERIFIED — see hero-section.tsx's provenance note. These 6
// files share the same Lovable-scaffolding origin (commit 29833eed); do not
// claim iPix ownership in alt text/comments without an actual license record.
const items = [
  { label: "Fashion", span: "row-span-2", src: "/images/portfolio-fashion.jpg" },
  { label: "Watches", span: "", src: "/images/portfolio-watch.jpg" },
  { label: "Jewellery", span: "", src: "/images/portfolio-jewellery.jpg" },
  { label: "Product", span: "col-span-2", src: "/images/portfolio-product.jpg" },
  { label: "eCommerce", span: "", src: "/images/portfolio-ecommerce.jpg" },
  { label: "Still Life", span: "", src: "/images/portfolio-stilllife.jpg" },
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
                sizes="(min-width: 1024px) 25vw, 50vw"
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
