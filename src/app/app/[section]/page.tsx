import { notFound } from "next/navigation";

import { isOperatorNavHref } from "@/components/operator-panel/nav";
import { EmptyState } from "@/components/ui/empty-state";
import {
  appWorkspaceDependencies,
  requireResolvedAppWorkspace,
} from "@/lib/auth/app-shell";

const COPY: Record<string, { heading: string; body: string }> = {
  shoots: {
    heading: "Shoots",
    body: "SHOOT-001 will fill this slot. No shoot records are loaded here.",
  },
  assets: {
    heading: "Assets",
    body: "ASSETS-001 will fill this slot. No asset records are loaded here.",
  },
  crm: {
    heading: "CRM",
    body: "CRM-001 will fill this slot. No CRM records are loaded here.",
  },
  talent: {
    heading: "Talent",
    body: "TALENT-BOOKING-001 will fill this slot. No booking records are loaded here.",
  },
  operations: {
    heading: "Operations",
    body: "OPERATIONS-001 will fill this slot. No inbox records are loaded here.",
  },
  analytics: {
    heading: "Analytics",
    body: "ANALYTICS-001 will fill this slot. No metrics are loaded here.",
  },
  plans: {
    heading: "Plans",
    body: "PLANS-001 will fill this slot. No plan records are loaded here.",
  },
};

export default async function AppSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  await requireResolvedAppWorkspace(appWorkspaceDependencies);
  const { section } = await params;
  const href = `/app/${section}`;
  const copy = COPY[section];
  if (!copy || !isOperatorNavHref(href)) notFound();
  return (
    <div className="p-8">
      <EmptyState heading={copy.heading} body={copy.body} />
    </div>
  );
}
