import type { Metadata } from "next";
import { canonicalUrl } from "@/lib/site";
import { ServicePage } from "@/components/marketing/service-page";

const TITLE = "Shopify Store Photography — iPix";
const DESCRIPTION =
  "Plan collection, product, and mobile-first imagery for your Shopify storefront with iPix — one shot list, every page covered.";
const URL = canonicalUrl("/services/shopify");

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, images: ["/images/shopify-hero.jpg"] },
};

export default function ShopifyPage() {
  return (
    <ServicePage
      eyebrow="Shopify Photography"
      title="Storefront Photography,"
      titleAccent="Planned for Shopify"
      description="Plan collection, product, and detail imagery sized and cropped for how shoppers actually browse your Shopify storefront — on desktop and on mobile."
      heroImage={{ src: "/images/shopify-hero.jpg", alt: "iPix Shopify storefront photography" }}
      useCases={[
        {
          title: "Collection & Category Imagery",
          desc: "Consistent imagery across a collection page, planned as one shot list instead of one-off shots.",
        },
        {
          title: "Product Detail Pages",
          desc: "Hero and detail shots planned for the exact layout of your product page template.",
        },
        {
          title: "Mobile-First Crops",
          desc: "Crops and framing planned for how your storefront is actually viewed — desktop, tablet, and mobile alike.",
        },
        {
          title: "Editorial & Lookbook",
          desc: "Styled imagery for collection launches and lookbook pages beyond the product grid.",
        },
      ]}
      faq={[
        {
          question: "Can iPix plan images for a specific Shopify theme?",
          answer: "Yes — tell us your product page and collection layout, and the shot list is planned to match how images will actually display.",
        },
        {
          question: "Do you plan for mobile as well as desktop?",
          answer: "Yes — crops and framing for mobile are part of the same shot plan, not an afterthought.",
        },
        {
          question: "Can one shoot cover both the collection grid and a lookbook?",
          answer: "Yes — they're planned together as one shot list so the whole storefront stays visually consistent.",
        },
        {
          question: "What happens after the shoot?",
          answer: "Assets come back into iPix for review and delivery, ready to upload to your storefront.",
        },
      ]}
    />
  );
}
