import type { Metadata } from "next";
import { canonicalUrl } from "@/lib/site";
import { ServicePage } from "@/components/marketing/service-page";

const TITLE = "Fashion Photography — iPix";
const DESCRIPTION =
  "Plan and produce on-model, ghost, flat lay, and detail fashion photography with iPix — from shot list to delivered assets.";
const URL = canonicalUrl("/services/fashion-photography");

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, images: ["/images/fashion-hero.jpg"] },
};

export default function FashionPhotographyPage() {
  return (
    <ServicePage
      eyebrow="Fashion Photography"
      title="Editorial Photography,"
      titleAccent="Planned Like a Production"
      description="iPix plans your fashion shoot — on-model, ghost, flat lay, and detail shots — with a shot list built from your brand, so every image comes back on-brand and ready to deliver."
      heroImage={{ src: "/images/fashion-hero.jpg", alt: "Fashion editorial photography" }}
      useCases={[
        {
          title: "On-Model Editorial",
          desc: "Full-look and campaign imagery on a model, planned against your shot list and brand guidelines.",
        },
        {
          title: "Ghost & Flat Lay",
          desc: "Consistent, catalog-ready apparel shots with no model — ghost mannequin or flat lay, your choice.",
        },
        {
          title: "Product Detail",
          desc: "Close-up shots of fabric, stitching, and trim for the details a full-body shot can't show.",
        },
        {
          title: "Studio & On-Location",
          desc: "Plan the shoot in-studio or on location — the environment is part of the plan, not an afterthought.",
        },
      ]}
      faq={[
        {
          question: "What kinds of apparel shots can iPix plan?",
          answer:
            "On-model editorial, ghost mannequin, flat lay, and product detail — mixed in a single shoot plan if your catalog needs more than one.",
        },
        {
          question: "Can I shoot on location instead of a studio?",
          answer: "Yes. The shoot plan captures the environment — studio, on-location, or a mix — alongside the shot list.",
        },
        {
          question: "How does iPix keep the shoot on-brand?",
          answer: "Your brand context feeds the plan, so shot lists, styling notes, and deliverables stay consistent with your brand identity.",
        },
        {
          question: "What happens after the shoot?",
          answer: "Assets come back into iPix for review and delivery, ready for every channel you've planned for.",
        },
      ]}
    />
  );
}
