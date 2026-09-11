"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import {
  BRAND_SORT_OPTIONS,
  BRAND_STATUS_FILTERS,
  filterBrands,
  sortBrands,
  type BrandSortOption,
  type BrandStatusFilter,
} from "@/lib/brand/brand-list-filters";
import type { BrandListItem } from "@/lib/brand/get-brands";

import { BrandCard } from "./BrandCard";
import styles from "./brands-list.module.css";

/**
 * IPI-1068 · BRAND-001 — client-side search + status filter + sort over the
 * already-fetched (server-authorized) brand page. No new Supabase reads:
 * filtering/sorting the org-scoped list `BrandsListStates` already loaded,
 * not a second, browser-supplied query — so there's no tenant-boundary
 * surface here to get wrong.
 */
export function BrandsSearchFilter({ brands }: { brands: BrandListItem[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BrandStatusFilter>("all");
  const [sortOption, setSortOption] = useState<BrandSortOption>("newest");

  const filtered = useMemo(
    () => sortBrands(filterBrands(brands, { query, statusFilter }), sortOption),
    [brands, query, statusFilter, sortOption],
  );

  return (
    <div className={styles.filterBar}>
      <div className={styles.controls}>
        <input
          type="search"
          role="searchbox"
          aria-label="Search brands"
          placeholder="Search brands"
          className={styles.searchInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className={styles.chips} role="group" aria-label="Filter brands by status">
          {BRAND_STATUS_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={
                option.value === statusFilter
                  ? `${styles.chip} ${styles.chipActive}`
                  : styles.chip
              }
              aria-pressed={option.value === statusFilter}
              onClick={() => setStatusFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <select
          aria-label="Sort brands"
          className={styles.sortSelect}
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value as BrandSortOption)}
        >
          {BRAND_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          heading="No matching brands"
          body="Try a different search term or filter."
        />
      ) : (
        <ul className={styles.grid} data-testid="brands-list">
          {filtered.map((brand) => (
            <BrandCard key={brand.id} brand={brand} />
          ))}
        </ul>
      )}
    </div>
  );
}
