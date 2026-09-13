import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import "./marketing.css";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";
import { SITE_URL } from "@/lib/site";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

// Public marketing metadata — overrides the root layout's starter metadata so
// pages under the (marketing) group never inherit "Mastra + CopilotKit Starter".
// metadataBase (IPI-1064 · MARKETING-MEDIA-001, Sentry finding) resolves every
// relative openGraph.images path declared on child routes (each of the 5
// service pages' relative hero-image path) into an absolute URL. Reuses
// SITE_URL from lib/site.ts —
// the same preview-host-guarded source of truth sitemap.ts/robots.ts use — so
// no second URL helper and no per-page hostname literals.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "iPix — AI-Powered Content Studio for Fashion & DTC Brands",
  description:
    "Plan, book, produce, and deliver on-brand fashion and e-commerce photography with iPix — the AI-powered content studio for fashion and DTC brands.",
};

// (marketing) group layout — public header/footer only. NO CopilotKit, NO
// OperatorPanel, NO ThreadsDrawer, NO auth. The `.marketing` class scopes the
// iPix brand tokens (marketing.css) so the operator theme is untouched.
export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`marketing ${cormorant.variable} ${outfit.variable}`}>
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}