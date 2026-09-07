import Link from "next/link";
import { LayoutDashboard } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

/** IPI-1074 · PLANS-001 — plan workspace 404 boundary (honest, non-recursive). */
export default function AppPlanDetailNotFound() {
  return (
    <div className="p-8">
      <EmptyState
        heading="Plan not found"
        body="This plan doesn't exist or you don't have access to it."
        icon={<LayoutDashboard aria-hidden />}
        action={
          <Link href="/app/plans" className="font-semibold text-sm underline">
            Back to plans
          </Link>
        }
      />
    </div>
  );
}