import type { Metadata } from "next";
import { canonicalUrl } from "@/lib/site";
import { ServicePage } from "@/components/marketing/service-page";

const TITLE = "Instagram Campaign Photography — iPix";
const DESCRIPTION =
  "Plan a shoot that produces stills and short-form content for feed, Stories, Reels, and Instagram Shop with iPix — one plan, multiple deliverables.";
const URL = canonicalUrl("/services/instagram");

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, images: ["/images/instagram-hero.jpg"] },
};

export default function InstagramPage() {
  return (
    <ServicePage
      eyebrow="Instagram Campaigns"
      title="Campaign Photography,"
      titleAccent="Planned for Every Format"
      description="Plan a shoot that produces stills and short-form content for feed posts, Stories, Reels, and Instagram Shop — one plan, multiple deliverables, all on-brand."
      heroImage={{ src: "/images/instagram-hero.jpg", alt: "iPix Instagram campaign photography" }}
      useCases={[
        {
          title: "Feed & Carousel Stills",
          desc: "Planned imagery for grid posts and multi-image carousels, consistent with your feed's look.",
        },
        {
          title: "Stories & Reels Content",
          desc: "Vertical, short-form content planned alongside your stills so one shoot covers both formats.",
        },
        {
          title: "Instagram Shop Imagery",
          desc: "Product imagery planned for how it displays in Instagram Shop and shoppable tags.",
        },
        {
          title: "Campaign Concepts",
          desc: "A shoot plan built around a single campaign theme, spanning every format it needs to reach.",
        },
      ]}
      faq={[
        {
          question: "Can one shoot cover feed, Stories, and Reels?",
          answer: "Yes — they're planned together as one shot list, so a single shoot day produces content for every format.",
        },
        {
          question: "Does iPix plan short-form video as well as stills?",
          answer: "The shoot plan can include short-form video concepts for Reels and Stories alongside your stills.",
        },
        {
          question: "Can Instagram Shop imagery come from the same shoot?",
          answer: "Yes — product shots planned for Instagram Shop can be part of the same shot list as your campaign stills.",
        },
        {
          question: "What happens after the shoot?",
          answer: "Assets come back into iPix for review and delivery, formatted for each surface you've planned for.",
        },
      ]}
    />
  );
}
