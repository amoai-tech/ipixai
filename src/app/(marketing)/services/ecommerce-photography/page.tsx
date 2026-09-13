import type { Metadata } from "next";
import { canonicalUrl } from "@/lib/site";
import { ServicePage } from "@/components/marketing/service-page";

const TITLE = "E-commerce Photography — iPix";
const DESCRIPTION =
  "Plan hero, detail, and lifestyle product photography with iPix — built for how catalog and specialty-product images actually get used.";
const URL = canonicalUrl("/services/ecommerce-photography");

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL },
};

export default function EcommercePhotographyPage() {
  return (
    <ServicePage
      eyebrow="E-commerce Photography"
      title="Catalog Photography,"
      titleAccent="Built for Every Channel"
      description="Plan hero, detail, and lifestyle imagery for your product catalog — including specialty products that need close, precise work — with a shot list built for how each channel actually uses images."
      useCases={[
        {
          title: "Hero & Catalog Shots",
          desc: "Clean, consistent primary product images planned for your storefront and catalog grid.",
        },
        {
          title: "Detail & Macro",
          desc: "Close, precise imagery for texture, reflective surfaces, and specialty products like jewelry.",
        },
        {
          title: "Lifestyle Imagery",
          desc: "Product-in-context shots that give shoppers a sense of scale, use, and styling.",
        },
        {
          title: "Channel-Ready Deliverables",
          desc: "Crops and sizes planned for where the images will actually run — storefront, marketplace, or social.",
        },
      ]}
      faq={[
        {
          question: "Can iPix plan shots for specialty products like jewelry?",
          answer: "Yes — the plan can call for macro and detail work suited to reflective or small products, alongside your standard catalog shots.",
        },
        {
          question: "Do I get different image sizes for different channels?",
          answer: "The shot plan can include the crops and formats each channel needs, so you're not resizing images after the fact.",
        },
        {
          question: "Can lifestyle and hero shots come from the same shoot?",
          answer: "Yes — both are part of the same shot list, planned together so the whole catalog stays visually consistent.",
        },
        {
          question: "What happens after the shoot?",
          answer: "Assets come back into iPix for review and delivery, ready for every channel you've planned for.",
        },
      ]}
    />
  );
}
