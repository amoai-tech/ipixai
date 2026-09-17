"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
 * `Keep` returns the current `referenceId` unchanged. `Replace` is only offered
 * when the PLAN-001 compatibility scorer says the candidate is compatible, so
 * replacement stays compatibility-safe without duplicating selection logic.
 */

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
  onSelect: (referenceId: string) => void;
  /** Optional heading override. */
  title?: string;
};

type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "unavailable" }
  | { status: "error" };

const PREVIEW_KIND = { card: "masonry", detail: "detail" } as const;

/**
 * Fetch an exact-version signed preview for a trusted reference.
 *
 * Fails closed: a reference with no approved mapping is never fetched (the
 * server would answer 409 `missing_approved_media`), and a 404/409 is surfaced
 * as "unavailable" rather than as an image. The client never sees or stores
 * provider identity or signed URLs beyond the rendered `<img src>`.
 */
function useReferencePreview(referenceId: string, kind: "card" | "detail", enabled: boolean): PreviewState {
  const [state, setState] = useState<PreviewState>({ status: "idle" });

  useEffect(() => {
    if (!enabled) {
      setState({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    let active = true;
    setState({ status: "loading" });

    fetch(`/api/references/${encodeURIComponent(referenceId)}/preview?preview=${PREVIEW_KIND[kind]}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) {
          setState(response.status === 404 || response.status === 409 ? { status: "unavailable" } : { status: "error" });
          return;
        }
        const payload = (await response.json()) as { url?: unknown };
        if (typeof payload.url === "string" && payload.url.length > 0) {
          setState({ status: "ready", url: payload.url });
          return;
        }
        setState({ status: "unavailable" });
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof Error && error.name === "AbortError")) return;
        setState({ status: "error" });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [referenceId, kind, enabled]);

  return state;
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))).sort(
    (left, right) => left.localeCompare(right),
  );
}

/** A clear, non-leaking explanation for why a replacement was blocked. */
function incompatibilityReason(
  entry: ShotReferenceCatalogEntry,
  deliverableChannel: string,
  context: ReferenceSelectionContext | undefined,
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

  if (!hasPreview || preview.status === "idle") {
    return (
      <div
        className="flex h-32 w-full items-center justify-center rounded-md bg-gray-100 text-xs text-gray-500"
        data-testid="reference-no-preview"
      >
        No approved image yet
      </div>
    );
  }

  if (preview.status === "loading") {
    return (
      <div
        className="h-32 w-full animate-pulse rounded-md bg-gray-100"
        data-testid="reference-preview-loading"
        aria-busy="true"
      />
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

/**
 * One reference card: preview + trusted metadata + details toggle + replace.
 */
function ReferenceCard({
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
  const label = [entry.category, entry.subcategory, entry.angle].filter(Boolean).join(" \u25b8 ");

  return (
    <li
      role="listitem"
      data-testid="reference-card"
      data-reference-id={entry.id}
      data-current={isCurrent ? "true" : "false"}
      className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3"
    >
      <ReferencePreview referenceId={entry.id} hasPreview={entry.hasPreview} kind={expanded ? "detail" : "card"} />

      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{entry.description}</p>
        {isCurrent ? (
          <span className="w-fit rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800" data-testid="reference-current-badge">
            Current reference
          </span>
        ) : null}
      </div>

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

      {expanded ? (
        <dl className="grid grid-cols-1 gap-1 border-t border-gray-100 pt-2 text-xs text-gray-600" data-testid="reference-details">
          <div className="flex gap-2">
            <dt className="font-medium text-gray-700">Angle</dt>
            <dd>{entry.angle}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-gray-700">Category</dt>
            <dd>{entry.category ?? "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-gray-700">Subcategory</dt>
            <dd>{entry.subcategory ?? "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-gray-700">Model</dt>
            <dd>{entry.modelType ?? "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-gray-700">Channels</dt>
            <dd>{entry.channelFit.join(", ")}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-gray-700">Preview</dt>
            <dd>{entry.hasPreview ? "Approved image available" : "No approved image yet"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-gray-700">Key</dt>
            <dd>{entry.referenceKey}</dd>
          </div>
        </dl>
      ) : null}

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

/**
 * Reusable visual shot-reference browser.
 *
 * Performs no Shoot write: the only output is the trusted `referenceId` handed
 * back through `onSelect`, which the owning review flow owns.
 */
export function ShotReferenceBrowser({
  currentReferenceId,
  catalog,
  deliverableChannel,
  context,
  onSelect,
  title = "Reference image",
}: ShotReferenceBrowserProps) {
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{ referenceId: string; message: string } | null>(null);

  const categories = useMemo(() => uniqueSorted(catalog.map((entry) => entry.category)), [catalog]);
  const subcategories = useMemo(
    () => uniqueSorted(catalog.filter((entry) => !category || entry.category === category).map((entry) => entry.subcategory)),
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

  const currentEntry = useMemo(
    () => catalog.find((entry) => entry.id === currentReferenceId) ?? null,
    [catalog, currentReferenceId],
  );

  const handleKeep = useCallback(() => {
    setBlocked(null);
    onSelect(currentReferenceId);
  }, [currentReferenceId, onSelect]);

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

  return (
    <section aria-label={title} data-testid="shot-reference-browser" className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500" data-testid="reference-current-summary">
            {currentEntry
              ? `Current: ${[currentEntry.category, currentEntry.subcategory, currentEntry.angle].filter(Boolean).join(" \u25b8 ")}`
              : "Current reference is not in the trusted catalog."}
          </p>
        </div>
        <button
          type="button"
          onClick={handleKeep}
          data-testid="reference-keep"
          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-800 transition-colors hover:bg-gray-100"
        >
          Keep current reference
        </button>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          Category
          <select
            data-testid="reference-filter-category"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setSubcategory("");
            }}
            className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-800"
          >
            <option value="">All categories</option>
            {categories.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-gray-600">
          Subcategory
          <select
            data-testid="reference-filter-subcategory"
            value={subcategory}
            onChange={(event) => setSubcategory(event.target.value)}
            className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-800"
          >
            <option value="">All subcategories</option>
            {subcategories.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-gray-600">
          Search
          <input
            type="search"
            data-testid="reference-filter-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Angle, description, model"
            className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-800"
          />
        </label>
      </div>

      {catalog.length === 0 ? (
        <p role="status" data-testid="reference-empty" className="text-sm text-gray-500">
          No trusted references are available yet.
        </p>
      ) : visible.length === 0 ? (
        <p role="status" data-testid="reference-no-matches" className="text-sm text-gray-500">
          No references match these filters.
        </p>
      ) : (
        <ul role="list" data-testid="reference-grid" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((entry) => (
            <ReferenceCard
              key={entry.id}
              entry={entry}
              isCurrent={entry.id === currentReferenceId}
              compatible={scoreReferenceCompatibility(entry, deliverableChannel, context) > 0}
              expanded={expandedId === entry.id}
              blockedMessage={blocked?.referenceId === entry.id ? blocked.message : null}
              onToggleDetails={() => setExpandedId((previous) => (previous === entry.id ? null : entry.id))}
              onReplace={() => handleReplace(entry)}
            />
          ))}
        </ul>
      )}

      <p className="text-xs text-gray-500" data-testid="reference-footnote">
        Choosing a reference only updates the review selection — nothing is saved to the Shoot here.
      </p>
    </section>
  );
}
