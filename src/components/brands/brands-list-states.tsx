import { Building2 } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import type { BrandListResult } from "@/lib/brand/get-brands";

import { BrandsSearchFilter } from "./brands-search-filter";

/**
 * IPI-1068 · BRAND-001 — the three list states: error, empty (zero brands
 * ever — no search would help), and search/filter over real brands.
 * Mirrors `ShootsListStates` — a failed read degrades only this section,
 * the header stays usable. Error and true-empty stay server-rendered; only
 * a non-empty result needs the client-side search/filter component.
 */
export function BrandsListStates({ result }: { result: BrandListResult }) {
  if (!result.ok) {
    return <ErrorState message="Couldn't load your brands. Please try again shortly." />;
  }

  if (result.brands.length === 0) {
    return (
      <EmptyState
        heading="No brands yet"
        body="Brands your organization creates will show up here."
        icon={<Building2 aria-hidden />}
      />
    );
  }

  return <BrandsSearchFilter brands={result.brands} />;
}
