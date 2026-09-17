"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";

import {
  channelMatchesReference,
  scoreReferenceCompatibility,
  type ReferenceSelectionContext,
} from "@/lib/shoot/shot-list-from-references";
import type { ShotReferenceCatalogEntry } from "@/lib/shoot/shot-type-references";

/**
 * IPI-644 · SHOOT-DATA-002C — reusable visual shot-reference browser.
 *
 * Contract (see the task's remaining-work sections 3-6):
 * - one reusable component; it does NOT create a second reference-selection system
 *   and does NOT create or persist a Shoot;
 * - input: the trusted catalog + the reference currently in review;
 * - output: a trusted `referenceId` through `onSelect` — nothing else.
 *
 * `Keep` returns the current `referenceId` unchanged when it is present in the
 * catalog (and is disabled otherwise, so an untrusted id can never be emitted).
 * `Replace` is only offered when the PLAN-001 compatibility scorer says the
 * candidate is compatible, so replacement stays compatibility-safe without
 * duplicating selection logic.
 */

// TypeScript function types need a named parameter to attach its type, and that name
// documents the callback contract. The base `no-unused-vars` rule Codacy runs cannot
// see that, so each shared handler type carries a targeted one-line suppression
// instead of a whole-file disable.
/* eslint-disable-next-line no-unused-vars -- named parameter documents the callback contract */
type ReferenceIdHandler = (referenceId: string) => void;
/* eslint-disable-next-line no-unused-vars -- named parameter documents the callback contract */
type ValueHandler = (value: string) => void;
/* eslint-disable-next-line no-unused-vars -- named parameter documents the callback contract */
type EntryHandler = (entry: ShotReferenceCatalogEntry) => void;

export type ShotReferenceBrowserProps = {
  /** Reference currently in review (from the planner / owning review flow). */
  currentReferenceId: string;
  /** Trusted catalog (server-loaded safe metadata only; no provider identity). */
  catalog: ShotReferenceCatalogEntry[];
  /** Deliverable channel the reference must fit (e.g. `shopify`, `instagram_feed`). */
  deliverableChannel: string;
  /** Optional operator-known context; same inputs the PLAN-001 scorer already accepts. */
  context?: ReferenceSelectionContext;
  /** Receives ONLY a trusted reference id. Keep = current id; Replace = chosen id. */
  onSelect: ReferenceIdHandler;
  /** Optional heading override. */
  title?: string;
};

type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "unavailable" }
  | { status: "error" };

function previewQueryValue(kind: "card" | "detail"): string {
  return kind === "detail" ? "detail" : "masonry";
}

/**
 * Fetch an exact-version signed preview for a trusted reference.
 *
 * Fails closed: a reference with no approved mapping is never fetched (the
 * server would answer 409 `missing_approved_media`), and a 404/409 is surfaced
 * as "unavailable" rather than as an image. The client never sees or stores
 * provider identity, and the signed URL is only ever used as an `<img src>`.
 */
function useReferencePreview(referenceId: string, kind: "card" | "detail", enabled: boolean): PreviewState {
  const [state, setState] = useState<PreviewState>({ status: "idle" });

  useEffect(() => {
    if (!enabled) {
      setState({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    // Mutable holder (not a closure-narrowable `let`) so TypeScript cannot prove
    // the guard below is unreachable; cleanup flips it before aborting.
    const request = { active: true };
    setState({ status: "loading" });

    // Fixed same-origin path built from a server-loaded trusted reference id.
    const path = ["/api/references/", encodeURIComponent(referenceId), "/preview?preview=", previewQueryValue(kind)].join("");

    // nosemgrep
    fetch(path, { signal: controller.signal })
      .then(async (response) => {
        if (!request.active) return;
        if (!response.ok) {
          setState(response.status === 404 || response.status === 409 ? { status: "unavailable" } : { status: "error" });
          return;
        }
        const payload = (await response.json()) as { url?: unknown };
        if (!request.active) return;
        if (typeof payload.url === "string" && payload.url.length > 0) {
          setState({ status: "ready", url: payload.url });
          return;
        }
        setState({ status: "unavailable" });
      })
      .catch((error: unknown) => {
        if (!request.active || (error instanceof Error && error.name === "AbortError")) return;
        setState({ status: "error" });
      });

    return () => {
      request.active = false;
      controller.abort();
    };
  }, [referenceId, kind, enabled]);

  return state;
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) seen.add(value);
  }
  return Array.from(seen).sort((left, right) => left.localeCompare(right));
}

/** A clear, non-leaking explanation for why a replacement was blocked. */
function incompatibilityReason(
  entry: ShotReferenceCatalogEntry,
  deliverableChannel: string,
  context?: ReferenceSelectionContext,
): string {
  if (!channelMatchesReference(deliverableChannel, entry.channelFit)) {
    return `it does not support the ${deliverableChannel} channel`;
  }
  if (context?.productCategory && entry.category && context.productCategory !== entry.category) {
    return `it is a different product category (${entry.category})`;
  }
  if (context?.modelType && entry.modelType && context.modelType !== entry.modelType) {
    return `it is a different model type (${entry.modelType})`;
  }
  return "it is not a compatible trusted reference for this deliverable";
}

function ReferencePreview({ referenceId, hasPreview, kind }: { referenceId: string; hasPreview: boolean; kind: "card" | "detail" }) {
  const preview = useReferencePreview(referenceId, kind, hasPreview);

  if (!hasPreview) {
    return (
      <div
        className="flex h-32 w-full items-center justify-center rounded-md bg-gray-100 text-xs text-gray-500"
        data-testid="reference-no-preview"
      >
        No approved image yet
      </div>
    );
  }

  if (preview.status === "idle" || preview.status === "loading") {
    return (
      <div className="h-32 w-full motion-safe:animate-pulse rounded-md bg-gray-100" data-testid="reference-preview-loading" aria-busy="true" />
    );
  }

  if (preview.status === "ready") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived authenticated Cloudinary URL; no public loader/CDN caching desired.
      <img
        src={preview.url}
        alt=""
        loading="lazy"
        data-testid="reference-preview-image"
        className="h-32 w-full rounded-md bg-gray-100 object-cover"
      />
    );
  }

  return (
    <div
      className="flex h-32 w-full items-center justify-center rounded-md bg-gray-100 px-2 text-center text-xs text-gray-500"
      data-testid="reference-preview-unavailable"
    >
      {preview.status === "unavailable" ? "Preview unavailable" : "Preview could not be loaded"}
    </div>
  );
}

function ReferenceDetails({ entry }: { entry: ShotReferenceCatalogEntry }) {
  const rows: Array<{ term: string; value: string }> = [
    { term: "Angle", value: entry.angle },
    { term: "Category", value: entry.category ?? "—" },
    { term: "Subcategory", value: entry.subcategory ?? "—" },
    { term: "Model", value: entry.modelType ?? "—" },
    { term: "Channels", value: entry.channelFit.join(", ") },
    { term: "Preview", value: entry.hasPreview ? "Approved image available" : "No approved image yet" },
    { term: "Key", value: entry.referenceKey },
  ];

  return (
    <dl className="grid grid-cols-1 gap-1 border-t border-gray-100 pt-2 text-xs text-gray-600" data-testid="reference-details">
      {rows.map((row) => (
        <div key={row.term} className="flex gap-2">
          <dt className="font-medium text-gray-700">{row.term}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ReferenceCardSummary({ entry, isCurrent }: { entry: ShotReferenceCatalogEntry; isCurrent: boolean }) {
  const label = [entry.category, entry.subcategory, entry.angle].filter(Boolean).join(" \u25b8 ");

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-gray-900">{label}</p>
      <p className="text-xs text-gray-500">{entry.description}</p>
      {isCurrent ? (
        <span
          className="w-fit rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800"
          data-testid="reference-current-badge"
        >
          Current reference
        </span>
      ) : null}
    </div>
  );
}

function ReferenceCardActions({
  isCurrent,
  expanded,
  onToggleDetails,
  onReplace,
}: {
  isCurrent: boolean;
  expanded: boolean;
  onToggleDetails: () => void;
  onReplace: () => void;
}) {
  return (
    <div className="mt-auto flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onToggleDetails}
        aria-expanded={expanded}
        data-testid="reference-toggle-details"
        className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-100"
      >
        {expanded ? "Hide details" : "Details"}
      </button>
      {isCurrent ? null : (
        <button
          type="button"
          onClick={onReplace}
          data-testid="reference-replace"
          className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-100"
        >
          Replace with this
        </button>
      )}
    </div>
  );
}

/** One reference card: preview + trusted metadata + details toggle + replace. */
function ReferenceCardComponent({
  entry,
  isCurrent,
  compatible,
  expanded,
  blockedMessage,
  onToggleDetails,
  onReplace,
}: {
  entry: ShotReferenceCatalogEntry;
  isCurrent: boolean;
  compatible: boolean;
  expanded: boolean;
  blockedMessage: string | null;
  onToggleDetails: () => void;
  onReplace: () => void;
}) {
  return (
    <li
      role="listitem"
      data-testid="reference-card"
      data-reference-id={entry.id}
      data-current={isCurrent ? "true" : "false"}
      className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3"
    >
      <ReferencePreview referenceId={entry.id} hasPreview={entry.hasPreview} kind={expanded ? "detail" : "card"} />
      <ReferenceCardSummary entry={entry} isCurrent={isCurrent} />
      <ReferenceCardActions
        isCurrent={isCurrent}
        expanded={expanded}
        onToggleDetails={onToggleDetails}
        onReplace={onReplace}
      />
      {expanded ? <ReferenceDetails entry={entry} /> : null}
      {blockedMessage ? (
        <p role="alert" data-testid="reference-blocked" className="text-xs text-amber-700">
          {blockedMessage}
        </p>
      ) : null}
      {!compatible && !isCurrent ? (
        <p className="text-xs text-gray-500" data-testid="reference-incompatible-hint">
          Not compatible with this deliverable
        </p>
      ) : null}
    </li>
  );
}

type Filters = {
  category: string;
  subcategory: string;
  query: string;
  categories: string[];
  subcategories: string[];
  visible: ShotReferenceCatalogEntry[];
  onCategoryChange: ValueHandler;
  onSubcategoryChange: ValueHandler;
  onQueryChange: ValueHandler;
};

function useReferenceFilters(catalog: ShotReferenceCatalogEntry[]): Filters {
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [query, setQuery] = useState("");

  const categories = useMemo(() => uniqueSorted(catalog.map((entry) => entry.category)), [catalog]);
  const subcategories = useMemo(
    () =>
      uniqueSorted(
        catalog.filter((entry) => !category || entry.category === category).map((entry) => entry.subcategory),
      ),
    [catalog, category],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return catalog.filter((entry) => {
      if (category && entry.category !== category) return false;
      if (subcategory && entry.subcategory !== subcategory) return false;
      if (!needle) return true;
      return [entry.angle, entry.description, entry.category, entry.subcategory, entry.modelType]
        .filter((value): value is string => typeof value === "string")
        .some((value) => value.toLowerCase().includes(needle));
    });
  }, [catalog, category, subcategory, query]);

  const onCategoryChange = useCallback((value: string) => {
    setCategory(value);
    setSubcategory("");
  }, []);

  return {
    category,
    subcategory,
    query,
    categories,
    subcategories,
    visible,
    onCategoryChange,
    onSubcategoryChange: setSubcategory,
    onQueryChange: setQuery,
  };
}

function FilterSelect({
  label,
  testId,
  value,
  allLabel,
  options,
  onChange,
}: {
  label: string;
  testId: string;
  value: string;
  allLabel: string;
  options: string[];
  onChange: ValueHandler;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-gray-600">
      {label}
      <select
        data-testid={testId}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-800"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterSearch({ value, onChange }: { value: string; onChange: ValueHandler }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-gray-600">
      Search
      <input
        type="search"
        data-testid="reference-filter-query"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder="Angle, description, model"
        className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-800"
      />
    </label>
  );
}

function BrowserHeader({
  title,
  summary,
  onKeep,
  keepEnabled,
  headingId,
}: {
  title: string;
  summary: string;
  onKeep: () => void;
  keepEnabled: boolean;
  headingId: string;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-500" data-testid="reference-current-summary">
          {summary}
        </p>
      </div>
      <button
        type="button"
        onClick={onKeep}
        disabled={!keepEnabled}
        data-testid="reference-keep"
        className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-800 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
      >
        Keep current reference
      </button>
    </header>
  );
}

function ReferenceGrid({
  entries,
  currentReferenceId,
  deliverableChannel,
  context,
  expandedId,
  blocked,
  onToggleDetails,
  onReplace,
}: {
  entries: ShotReferenceCatalogEntry[];
  currentReferenceId: string;
  deliverableChannel: string;
  context?: ReferenceSelectionContext;
  expandedId: string | null;
  blocked: { referenceId: string; message: string } | null;
  onToggleDetails: ReferenceIdHandler;
  onReplace: EntryHandler;
}) {
  return (
    <ul role="list" data-testid="reference-grid" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => (
        <ReferenceCardComponent
          key={entry.id}
          entry={entry}
          isCurrent={entry.id === currentReferenceId}
          compatible={scoreReferenceCompatibility(entry, deliverableChannel, context) > 0}
          expanded={expandedId === entry.id}
          blockedMessage={blocked?.referenceId === entry.id ? blocked.message : null}
          onToggleDetails={() => {
            onToggleDetails(entry.id);
          }}
          onReplace={() => {
            onReplace(entry);
          }}
        />
      ))}
    </ul>
  );
}

/**
 * Reusable visual shot-reference browser.
 *
 * Performs no Shoot write: the only output is the trusted `referenceId` handed
 * back through `onSelect`, which the owning review flow owns.
 *
 * Preview loading is intentionally eager. The grid is bounded by the trusted
 * catalog (49 rows today, and only rows with an approved preview fetch at all),
 * and this component is not mounted yet, so viewport-gated loading via
 * `IntersectionObserver` is deferred until a real mount can be profiled. Add it
 * only if profiling shows the eager request burst is materially costly.
 */
export function ShotReferenceBrowser(props: ShotReferenceBrowserProps) {
  const { currentReferenceId, catalog, deliverableChannel, context, onSelect, title = "Reference image" } = props;
  const headingId = useId();
  const filters = useReferenceFilters(catalog);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{ referenceId: string; message: string } | null>(null);

  const currentEntry = useMemo(
    () => catalog.find((entry) => entry.id === currentReferenceId) ?? null,
    [catalog, currentReferenceId],
  );

  // Keep is only valid while the current reference is in the trusted catalog;
  // emitting an id the catalog does not contain would break the onSelect contract.
  const handleKeep = useCallback(() => {
    if (!currentEntry) return;
    setBlocked(null);
    onSelect(currentEntry.id);
  }, [currentEntry, onSelect]);

  const handleReplace = useCallback(
    (entry: ShotReferenceCatalogEntry) => {
      if (scoreReferenceCompatibility(entry, deliverableChannel, context) <= 0) {
        setBlocked({
          referenceId: entry.id,
          message: `Cannot replace with ${entry.angle}: ${incompatibilityReason(entry, deliverableChannel, context)}.`,
        });
        return;
      }
      setBlocked(null);
      onSelect(entry.id);
    },
    [context, deliverableChannel, onSelect],
  );

  const handleToggleDetails = useCallback((referenceId: string) => {
    setExpandedId((previous) => (previous === referenceId ? null : referenceId));
  }, []);

  const summary = currentEntry
    ? `Current: ${[currentEntry.category, currentEntry.subcategory, currentEntry.angle].filter(Boolean).join(" \u25b8 ")}`
    : "Current reference is not in the trusted catalog.";

  return (
    <section aria-labelledby={headingId} data-testid="shot-reference-browser" className="flex flex-col gap-4">
      <BrowserHeader
        title={title}
        summary={summary}
        onKeep={handleKeep}
        keepEnabled={currentEntry !== null}
        headingId={headingId}
      />

      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          label="Category"
          testId="reference-filter-category"
          value={filters.category}
          allLabel="All categories"
          options={filters.categories}
          onChange={filters.onCategoryChange}
        />
        <FilterSelect
          label="Subcategory"
          testId="reference-filter-subcategory"
          value={filters.subcategory}
          allLabel="All subcategories"
          options={filters.subcategories}
          onChange={filters.onSubcategoryChange}
        />
        <FilterSearch value={filters.query} onChange={filters.onQueryChange} />
      </div>

      {catalog.length === 0 ? (
        <p role="status" data-testid="reference-empty" className="text-sm text-gray-500">
          No trusted references are available yet.
        </p>
      ) : filters.visible.length === 0 ? (
        <p role="status" data-testid="reference-no-matches" className="text-sm text-gray-500">
          No references match these filters.
        </p>
      ) : (
        <ReferenceGrid
          entries={filters.visible}
          currentReferenceId={currentReferenceId}
          deliverableChannel={deliverableChannel}
          context={context}
          expandedId={expandedId}
          blocked={blocked}
          onToggleDetails={handleToggleDetails}
          onReplace={handleReplace}
        />
      )}

      <p className="text-xs text-gray-500" data-testid="reference-footnote">
        Choosing a reference only updates the review selection — nothing is saved to the Shoot here.
      </p>
    </section>
  );
}
