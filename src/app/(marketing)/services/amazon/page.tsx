import type { Metadata } from "next";
import { canonicalUrl } from "@/lib/site";
import { ServicePage } from "@/components/marketing/service-page";

const TITLE = "Amazon Listing Photography — iPix";
const DESCRIPTION =
  "Plan main, detail, lifestyle, and A+ Content imagery for Amazon listings with iPix — main image planned to Amazon's aspect-ratio, format, and background requirements.";
const URL = canonicalUrl("/services/amazon");

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL },
};

export default function AmazonPage() {
  return (
    <ServicePage
      eyebrow="Amazon Photography"
      title="Listing Photography,"
      titleAccent="Planned for Amazon"
      description="iPix plans your Amazon listing shoot — main image, detail shots, lifestyle context, and A+ Content — with the primary image planned to Amazon's aspect-ratio, format, and background requirements before the shoot, not after."
      useCases={[
        {
          title: "Main Image",
          desc: "The primary listing image, planned to Amazon's required aspect ratio, file format, and pure-white background.",
        },
        {
          title: "Detail & Feature Shots",
          desc: "Close-up and multi-angle shots that support the listing's key feature bullets.",
        },
        {
          title: "Lifestyle Context",
          desc: "Product-in-use imagery for the listing gallery beyond the required main image.",
        },
        {
          title: "A+ Content Imagery",
          desc: "Wider-format images planned for the A+ Content modules on the listing page.",
        },
      ]}
      faq={[
        {
          question: "Does iPix follow Amazon's image requirements?",
          answer:
            "The main image is planned to Amazon's required aspect ratio, file format, and pure-white background. Detail, lifestyle, and A+ shots follow common listing practice rather than a live Amazon feed — requirements change over time and vary by category, so always confirm your category's current full spec on Seller Central before publishing.",
        },
        {
          question: "Can one shoot cover main, detail, and A+ images?",
          answer: "Yes — they're planned as one shot list so the whole listing gallery stays visually consistent.",
        },
        {
          question: "Can I reuse these images outside Amazon?",
          answer: "Yes — the same shoot can also produce assets for your own storefront or other channels, planned up front.",
        },
        {
          question: "What happens after the shoot?",
          answer: "Assets come back into iPix for review and delivery, sized and named for your Amazon listing.",
        },
      ]}
    />
  );
}
