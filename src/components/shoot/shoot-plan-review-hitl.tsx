"use client";

import { useHumanInTheLoop } from "@copilotkit/react-core/v2";
import { useEffect, useRef, useState } from "react";

import {
  ShootPlanReview,
  type PlanReviewIdentity,
  type PlanReviewSettled,
} from "@/components/shoot/shoot-plan-review";
import { primaryDeliverableChannel } from "@/lib/shoot/shoot-plan-review-view";
import type { ShotReferenceCatalogEntry } from "@/lib/shoot/shot-type-references";

/**
 * IPI-1084 · APPROVAL-001 — the CopilotKit human-in-the-loop host for plan review.
 *
 * Mounted inside the existing `/app` CopilotKit provider (no second runtime).
 * The model can only *request* a review; staging and the decision both go
 * through authorized server routes, and `respond` is called exactly once, only
 * after the server confirms the durable outcome — so no branch can leave the
 * run parked. A failed staging attempt still responds with an error so the
 * agent can surface it and retry.
 */

type ReviewShootPlanArgs = {
  brandId?: unknown;
  plan?: unknown;
};

function asPlan(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Matches `ToolCallStatus.Executing` by its runtime value ("executing"). */
function isExecuting(status: unknown): boolean {
  return status === "executing";
}

let catalogCache: ShotReferenceCatalogEntry[] | null = null;
let catalogInFlight: Promise<ShotReferenceCatalogEntry[]> | null = null;

/**
 * Loads the trusted reference catalog at most once per successful response.
 *
 * Only a real catalog is cached. A transient failure (network error, 401 before
 * the session is ready, 5xx) resolves to `[]` for the review that asked for it
 * but clears the in-flight entry, so the next review retries instead of
 * inheriting an empty catalog for the rest of the page session.
 */
function loadCatalogOnce(): Promise<ShotReferenceCatalogEntry[]> {
  if (catalogCache) return Promise.resolve(catalogCache);
  if (!catalogInFlight) {
    catalogInFlight = (async () => {
      try {
        const response = await fetch("/api/plans/references");
        if (!response.ok) return [];
        const body: unknown = await response.json();
        const references =
          typeof body === "object" && body !== null
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

function ReviewPending({ label, testId }: { label: string; testId: string }) {
  return (
    <div data-testid={testId} className="rounded-md border border-gray-200 p-3 text-xs text-gray-500">
      {label}
    </div>
  );
}

function ReviewFailure({ label, testId }: { label: string; testId: string }) {
  return (
    <div role="alert" data-testid={testId} className="rounded-md bg-red-50 p-3 text-xs text-red-800">
      {label}
    </div>
  );
}

type ReviewFlowProps = {
  brandId: string;
  plan: Record<string, unknown>;
  respond: (payload: unknown) => void;
};

function ShootPlanReviewFlow({ brandId, plan, respond }: ReviewFlowProps) {
  const [identity, setIdentity] = useState<PlanReviewIdentity | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<ShotReferenceCatalogEntry[]>([]);
  const startedRef = useRef(false);
  const settledRef = useRef(false);
  const respondRef = useRef(respond);
  respondRef.current = respond;

  useEffect(() => {
    void loadCatalogOnce().then(setCatalog);
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      try {
        const response = await fetch("/api/plans/reviews", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ brandId, plan }),
        });
        const body: unknown = await response.json().catch(() => null);
        const record =
          typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
        if (!response.ok || !record) {
          const reason = record
            ? String(record.reason ?? record.error ?? "")
            : "";
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
        setFailure("Review could not start.");
      }
    })();
  }, [brandId, plan]);

  useEffect(() => {
    if (!failure || settledRef.current) return;
    settledRef.current = true;
    respondRef.current({ ok: false, error: "review_start_failed" });
  }, [failure]);

  if (failure) {
    return <ReviewFailure label={failure} testId="shoot-plan-review-failed" />;
  }

  if (!identity) {
    return <ReviewPending label="Staging the exact revision for review…" testId="shoot-plan-review-staging" />;
  }

  const settled = (outcome: PlanReviewSettled) => {
    if (settledRef.current) return;
    settledRef.current = true;
    respondRef.current({
      ok: true,
      decision: outcome.decision,
      resumeState: outcome.resumeState,
    });
  };

  return (
    <ShootPlanReview
      identity={identity}
      plan={plan}
      catalog={catalog}
      deliverableChannel={primaryDeliverableChannel(plan)}
      onSettled={settled}
    />
  );
}

export function ShootPlanReviewHitl() {
  useHumanInTheLoop(
    {
      name: "reviewShootPlan",
      description:
        "Ask the operator to review, edit, approve, reject, request changes on, or cancel a ShootPlan before anything is saved.",
      render: ({ status, args, respond, toolCallId }) => {
        // `respond` is only present on the Executing branch of the render-prop
        // union, so checking it both narrows the type and correctly reports
        // "not actionable yet" for the in-progress / complete states.
        if (!respond || !isExecuting(status)) {
          return <ReviewPending label="Preparing the plan for review…" testId="shoot-plan-review-pending" />;
        }

        const typed = args as ReviewShootPlanArgs | undefined;
        const plan = asPlan(typed?.plan);
        const brandId = typeof typed?.brandId === "string" ? typed.brandId : "";
        const respondOnce = (payload: unknown) => void respond(payload);

        if (!plan || !brandId) {
          return (
            <InvalidReview
              toolCallId={toolCallId}
              respond={respondOnce}
              label="The plan could not be read for review."
            />
          );
        }

        return (
          <ShootPlanReviewFlow key={toolCallId} brandId={brandId} plan={plan} respond={respondOnce} />
        );
      },
    },
    [],
  );

  return null;
}

function InvalidReview({
  toolCallId,
  respond,
  label,
}: {
  toolCallId: string;
  respond: (payload: unknown) => void;
  label: string;
}) {
  const respondedRef = useRef<string | null>(null);
  useEffect(() => {
    if (respondedRef.current === toolCallId) return;
    respondedRef.current = toolCallId;
    respond({ ok: false, error: "review_request_invalid" });
  }, [toolCallId, respond]);
  return <ReviewFailure label={label} testId="shoot-plan-review-invalid" />;
}
