"use client";

import { useHumanInTheLoop } from "@copilotkit/react-core/v2";
import { useEffect, useRef } from "react";

import type { PlanReviewSettled } from "@/components/shoot/shoot-plan-review";
import { ShootPlanReviewSession } from "@/components/shoot/shoot-plan-review-session";

type ReviewShootPlanArgs = {
  brandId?: unknown;
  plan?: unknown;
};

function asPlan(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isExecuting(status: unknown): boolean {
  return status === "executing";
}

function ReviewPending({ label, testId }: { label: string; testId: string }) {
  return <div data-testid={testId} className="rounded-md border border-gray-200 p-3 text-xs text-gray-500">{label}</div>;
}

function ReviewFailure({ label, testId }: { label: string; testId: string }) {
  return <div role="alert" data-testid={testId} className="rounded-md bg-red-50 p-3 text-xs text-red-800">{label}</div>;
}

function HitlReviewSession({
  brandId,
  plan,
  respond,
}: {
  brandId: string;
  plan: Record<string, unknown>;
  respond: (payload: unknown) => void;
}) {
  const respondedRef = useRef(false);
  const respondRef = useRef(respond);
  useEffect(() => {
    respondRef.current = respond;
  }, [respond]);
  const respondOnce = (payload: unknown) => {
    if (respondedRef.current) return;
    respondedRef.current = true;
    respondRef.current(payload);
  };
  const settled = (outcome: PlanReviewSettled) => respondOnce({
    ok: true,
    decision: outcome.decision,
    resumeState: outcome.resumeState,
  });

  return (
    <ShootPlanReviewSession
      brandId={brandId}
      plan={plan}
      onSettled={settled}
      onStartFailed={() => respondOnce({ ok: false, error: "review_start_failed" })}
    />
  );
}

/** IPI-1084 CopilotKit HITL adapter around the shared exact-revision review session. */
export function ShootPlanReviewHitl() {
  useHumanInTheLoop(
    {
      name: "reviewShootPlan",
      description:
        "Ask the operator to review, edit, approve, reject, request changes on, or cancel a ShootPlan before anything is saved.",
      render: ({ status, args, respond, toolCallId }) => {
        if (!respond || !isExecuting(status)) {
          return <ReviewPending label="Preparing the plan for review…" testId="shoot-plan-review-pending" />;
        }

        const typed = args as ReviewShootPlanArgs | undefined;
        const plan = asPlan(typed?.plan);
        const brandId = typeof typed?.brandId === "string" ? typed.brandId : "";
        const respondOnce = (payload: unknown) => void respond(payload);

        if (!plan || !brandId) {
          return <InvalidReview toolCallId={toolCallId} respond={respondOnce} label="The plan could not be read for review." />;
        }

        return <HitlReviewSession key={toolCallId} brandId={brandId} plan={plan} respond={respondOnce} />;
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
