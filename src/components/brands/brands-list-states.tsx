import { Building2 } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import type { BrandListResult } from "@/lib/brand/get-brands";

import { BrandCard } from "./BrandCard";
import styles from "./brands-list.module.css";

/**
 * IPI-1068 · BRAND-001 — the three list states: error, empty, and the
 * brand grid. Mirrors `ShootsListStates` — a failed read degrades only
 * this section, the header stays usable.
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

  return (
    <ul className={styles.grid} data-testid="brands-list">
      {result.brands.map((brand) => (
        <BrandCard key={brand.id} brand={brand} />
      ))}
    </ul>
  );
}
