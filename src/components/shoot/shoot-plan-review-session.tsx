"use client";

import { useEffect, useRef, useState } from "react";

import {
  ShootPlanReview,
  type PlanReviewIdentity,
  type PlanReviewSettled,
} from "@/components/shoot/shoot-plan-review";
import { primaryDeliverableChannel } from "@/lib/shoot/shoot-plan-review-view";
import type { ShotReferenceCatalogEntry } from "@/lib/shoot/shot-type-references";

let catalogCache: ShotReferenceCatalogEntry[] | null = null;
let catalogInFlight: Promise<ShotReferenceCatalogEntry[]> | null = null;
const REVIEW_START_TIMEOUT_MS = 20_000;

function loadCatalogOnce(): Promise<ShotReferenceCatalogEntry[]> {
  if (catalogCache) return Promise.resolve(catalogCache);
  if (!catalogInFlight) {
    catalogInFlight = (async () => {
      try {
        const response = await fetch("/api/plans/references");
        if (!response.ok) return [];
        const body: unknown = await response.json();
        const references = typeof body === "object" && body !== null
          ? (body as { references?: unknown }).references
          : null;
        if (!Array.isArray(references)) return [];
        catalogCache = references as ShotReferenceCatalogEntry[];
        return catalogCache;
      } catch {
        return [];
      } finally {
        catalogInFlight = null;
      }
    })();
  }
  return catalogInFlight;
}

export type ShootPlanReviewSessionProps = {
  brandId: string;
  plan: Record<string, unknown>;
  reviewStartId?: string;
  onSettled?: (outcome: PlanReviewSettled, identity: PlanReviewIdentity) => void;
  onStartFailed?: () => void;
  onRevised?: (identity: PlanReviewIdentity) => void;
};

/** Shared IPI-1084 review owner used by both CopilotKit HITL and the Wizard. */
export function ShootPlanReviewSession({
  brandId,
  plan,
  reviewStartId,
  onSettled,
  onStartFailed,
  onRevised,
}: ShootPlanReviewSessionProps) {
  const [identity, setIdentity] = useState<PlanReviewIdentity | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<ShotReferenceCatalogEntry[]>([]);
  const startedRef = useRef(false);
  const failedRef = useRef(false);

  useEffect(() => {
    void loadCatalogOnce().then(setCatalog);
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), REVIEW_START_TIMEOUT_MS);
      try {
        const response = await fetch("/api/plans/reviews", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ brandId, plan, ...(reviewStartId ? { reviewStartId } : {}) }),
          signal: controller.signal,
        });
        const body: unknown = await response.json().catch(() => null);
        const record = typeof body === "object" && body !== null ? body as Record<string, unknown> : null;
        if (!response.ok || !record) {
          const reason = record ? String(record.reason ?? record.error ?? "") : "";
          setFailure(reason ? `Review could not start (${reason}).` : "Review could not start.");
          return;
        }
        const next: PlanReviewIdentity = {
          approvalId: String(record.approvalId ?? ""),
          brandId: String(record.brandId ?? brandId),
          revision: Number(record.revision ?? 0),
          planHash: String(record.planHash ?? ""),
        };
        if (!next.approvalId || !next.revision || !next.planHash) {
          setFailure("Review could not start (invalid identity).");
          return;
        }
        setIdentity(next);
      } catch {
        setFailure(controller.signal.aborted
          ? "Review could not start (timed out)."
          : "Review could not start.");
      } finally {
        window.clearTimeout(timeoutId);
      }
    })();
  }, [brandId, plan, reviewStartId]);

  useEffect(() => {
    if (!failure || failedRef.current) return;
    failedRef.current = true;
    onStartFailed?.();
  }, [failure, onStartFailed]);

  if (failure) {
    return <div role="alert" data-testid="shoot-plan-review-failed" className="rounded-md bg-red-50 p-3 text-xs text-red-800">{failure}</div>;
  }
  if (!identity) {
    return <div data-testid="shoot-plan-review-staging" className="rounded-md border border-gray-200 p-3 text-xs text-gray-500">Staging the exact revision for review…</div>;
  }

  const handleRevised = (next: PlanReviewIdentity) => {
    setIdentity(next);
    onRevised?.(next);
  };

  return (
    <ShootPlanReview
      identity={identity}
      plan={plan}
      catalog={catalog}
      deliverableChannel={primaryDeliverableChannel(plan)}
      onSettled={(outcome) => onSettled?.(outcome, identity)}
      onRevised={handleRevised}
    />
  );
}