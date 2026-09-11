import type { BrandListResult } from "@/lib/brand/get-brands";

import { BrandsListHeader } from "./brands-list-header";
import { BrandsListStates } from "./brands-list-states";
import styles from "./brands-list.module.css";

/**
 * IPI-1068 · BRAND-001 — `/app/brands` page composition: header + states.
 * Mirrors `ShootsListWorkspace`. No pagination control yet — see
 * `listBrandsForOrg`'s ponytail note; `result.hasMore` is threaded through
 * so a "there's more" affordance can be added without a data-layer change
 * once a real org needs it.
 */
export function BrandsListWorkspace({
  result,
  count,
}: {
  result: BrandListResult;
  count: number | null;
}) {
  return (
    <div className={styles.root} data-testid="brands-list-workspace">
      <BrandsListHeader count={count} />
      <BrandsListStates result={result} />
      {result.ok && result.hasMore && (
        <p className={styles.count}>Showing the first brands only — more exist.</p>
      )}
    </div>
  );
}
