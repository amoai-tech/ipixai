"use client";

import { useMemo, useState } from "react";

import { ShotReferenceBrowser } from "@/components/shoot/shot-reference-browser";
import { planApprovalMessage } from "@/lib/shoot/plan-approval";
import {
  applyReferenceSelection,
  describeShootPlanReview,
} from "@/lib/shoot/shoot-plan-review-view";
import type { ShotReferenceCatalogEntry } from "@/lib/shoot/shot-type-references";

/**
 * IPI-1084 · APPROVAL-001 — the operator's review surface for one exact ShootPlan
 * revision. It renders the canonical plan, lets the operator keep or replace a
 * trusted reference in local review state, and records one of four decisions
 * through the authorized server route. It performs no Shoot write: the only
 * durable effect is the approval decision on the revision it was given.
 */

export type PlanReviewIdentity = {
  approvalId: string;
  brandId: string;
  revision: number;
  planHash: string;
};

export type PlanReviewSettled = {
  decision: string;
  resumeState: string;
  message: string;
};

export type ShootPlanReviewProps = {
  identity: PlanReviewIdentity;
  plan: Record<string, unknown>;
  catalog: ShotReferenceCatalogEntry[];
  deliverableChannel: string;
  onSettled?: (outcome: PlanReviewSettled) => void;
  onRevised?: (identity: PlanReviewIdentity) => void;
};

type Decision = "approved" | "rejected" | "changes_requested" | "cancelled";

const DECISION_LABELS: Record<Decision, string> = {
  approved: "Approve plan",
  rejected: "Reject plan",
  changes_requested: "Request changes",
  cancelled: "Cancel review",
};

function testIdFor(decision: Decision): string {
  return `review-${decision.replace(/_/g, "-")}`;
}

/**
 * Explicit lookup rather than an index into a record: `decision` is already the
 * constrained `Decision` union, and the exhaustive switch keeps the label set
 * total if the union ever grows.
 */
function decisionLabel(decision: Decision): string {
  switch (decision) {
    case "approved":
      return DECISION_LABELS.approved;
    case "rejected":
      return DECISION_LABELS.rejected;
    case "changes_requested":
      return DECISION_LABELS.changes_requested;
    case "cancelled":
      return DECISION_LABELS.cancelled;
  }
}

function errorText(body: unknown): string {
  if (typeof body !== "object" || body === null) return "";
  const record = body as { reason?: unknown; error?: unknown };
  const reason = typeof record.reason === "string" ? record.reason : "";
  if (reason) return planApprovalMessage(reason.toUpperCase());
  return typeof record.error === "string" ? record.error : "";
}

export function ShootPlanReview({
  identity: initialIdentity,
  plan,
  catalog,
  deliverableChannel,
  onSettled,
  onRevised,
}: ShootPlanReviewProps) {
  const [identity, setIdentity] = useState(initialIdentity);
  const [draft, setDraft] = useState<Record<string, unknown>>(plan);
  const [edited, setEdited] = useState(false);
  const [superseded, setSuperseded] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<PlanReviewSettled | null>(null);
  const [reviewedReference, setReviewedReference] = useState(0);

  const view = useMemo(() => describeShootPlanReview(draft), [draft]);
  // `referencesUsed` is an array, so each entry is reviewed on its own. The index
  // is clamped because a staged edit re-projects the draft.
  const referenceCount = view.references.length;
  const referenceIndex = referenceCount > 0 ? Math.min(reviewedReference, referenceCount - 1) : 0;
  const currentReference = view.references[referenceIndex] ?? null;
  const currentReferenceId = currentReference?.referenceId ?? "";

  function handleSelect(referenceId: string) {
    if (!currentReferenceId || referenceId === currentReferenceId) return;
    setDraft((previous) => applyReferenceSelection(previous, referenceIndex, referenceId));
    setEdited(true);
    setError(null);
  }

  async function saveRevision() {
    setBusy("revision");
    setError(null);
    try {
      const response = await fetch(`/api/plans/approvals/${identity.approvalId}/revision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: draft }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || typeof body !== "object" || body === null) {
        setError(errorText(body) || planApprovalMessage("STAGE_FAILED"));
        return;
      }
      const next = body as {
        approvalId: string;
        brandId: string;
        revision: number;
        planHash: string;
        supersededRevision: number;
      };
      const nextIdentity: PlanReviewIdentity = {
        approvalId: next.approvalId,
        brandId: next.brandId,
        revision: next.revision,
        planHash: next.planHash,
      };
      setIdentity(nextIdentity);
      setEdited(false);
      setSuperseded(next.supersededRevision);
      onRevised?.(nextIdentity);
    } catch {
      setError(planApprovalMessage("STAGE_FAILED"));
    } finally {
      setBusy(null);
    }
  }

  async function decide(decision: Decision) {
    if (edited) {
      setError("Stage this edit as a new revision before recording a decision.");
      return;
    }
    setBusy(decision);
    setError(null);
    try {
      const response = await fetch(`/api/plans/approvals/${identity.approvalId}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          revision: identity.revision,
          planHash: identity.planHash,
          decision,
          note: note.trim() ? note.trim() : null,
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || typeof body !== "object" || body === null) {
        setError(errorText(body) || planApprovalMessage("DECISION_FAILED"));
        return;
      }
      const settled = body as { resumeState?: unknown; message?: unknown };
      const result: PlanReviewSettled = {
        decision,
        resumeState: typeof settled.resumeState === "string" ? settled.resumeState : "resumed",
        message: typeof settled.message === "string" ? settled.message : "",
      };
      setOutcome(result);
      onSettled?.(result);
    } catch {
      setError(planApprovalMessage("DECISION_FAILED"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      data-testid="shoot-plan-review"
      data-approval-id={identity.approvalId}
      data-revision={identity.revision}
      className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4"
    >
      <header className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-gray-900">Review this plan</h3>
        <p className="text-xs text-gray-500" data-testid="review-revision">
          Revision {identity.revision}
          {superseded !== null ? ` · superseded revision ${superseded}` : ""}
        </p>
      </header>

      <p className="text-sm text-gray-900" data-testid="review-objective">
        {view.objective ?? "No objective recorded."}
      </p>
      {view.mediaType ? (
        <p className="text-xs text-gray-500">Media type: {view.mediaType}</p>
      ) : null}

      {view.missingInputs.length > 0 ? (
        <div role="alert" data-testid="review-missing-inputs" className="rounded-md bg-amber-50 p-2">
          <p className="text-xs font-medium text-amber-900">Missing inputs</p>
          <ul className="list-disc pl-4 text-xs text-amber-900">
            {view.missingInputs.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {view.sections.map((section) => (
        <div key={section.id} data-testid={`review-section-${section.id}`}>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {section.title}
          </h4>
          <dl className="mt-1 flex flex-col gap-1">
            {section.fields.map((field) => (
              <div key={`${section.id}-${field.label}`} className="flex gap-2 text-xs">
                <dt className="w-32 shrink-0 text-gray-500">{field.label}</dt>
                <dd className="text-gray-900">{field.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}

      {catalog.length > 0 ? (
        <div className="flex flex-col gap-2">
          {currentReference ? (
            <p className="text-xs text-gray-500" data-testid="review-reference-active">
              Reviewing reference {referenceIndex + 1} of {referenceCount}
              {currentReference.angle ? ` · ${currentReference.angle}` : ""}
            </p>
          ) : null}
          {referenceCount > 1 ? (
            <div role="group" aria-label="Plan references" className="flex flex-wrap gap-2">
              {view.references.map((reference, index) => (
                <button
                  key={`${reference.referenceId}-${index}`}
                  type="button"
                  data-testid={`review-reference-select-${index}`}
                  data-reference-id={reference.referenceId}
                  aria-pressed={index === referenceIndex}
                  onClick={() => setReviewedReference(index)}
                  className={`rounded-md border px-2 py-1 text-xs ${
                    index === referenceIndex
                      ? "border-blue-500 bg-blue-50 font-medium text-blue-900"
                      : "border-gray-300 text-gray-700"
                  }`}
                >
                  Reference {index + 1}
                </button>
              ))}
            </div>
          ) : null}
          <ShotReferenceBrowser
            currentReferenceId={currentReferenceId}
            catalog={catalog}
            deliverableChannel={deliverableChannel}
            onSelect={handleSelect}
            title="Shot references"
          />
        </div>
      ) : null}

      {edited ? (
        <div role="status" data-testid="review-edited" className="rounded-md bg-blue-50 p-2">
          <p className="text-xs text-blue-900">
            Edited in review state. Stage it as a new revision to record a decision on the exact
            artifact.
          </p>
          <button
            type="button"
            data-testid="review-save-revision"
            onClick={() => void saveRevision()}
            disabled={busy !== null}
            className="mt-2 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            {busy === "revision" ? "Staging…" : "Stage as new revision"}
          </button>
        </div>
      ) : null}

      <label className="flex flex-col gap-1 text-xs text-gray-500">
        Note (optional)
        <textarea
          data-testid="review-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          className="rounded-md border border-gray-300 p-2 text-xs text-gray-900"
        />
      </label>

      {error ? (
        <p role="alert" data-testid="review-error" className="text-xs text-red-700">
          {error}
        </p>
      ) : null}

      {outcome ? (
        <p role="status" data-testid="review-outcome" className="text-xs text-gray-700">
          {outcome.decision} recorded.
          {outcome.resumeState === "resume_failed"
            ? " The decision is saved; the run has not resumed yet — retry to finish."
            : ""}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {(["approved", "rejected", "changes_requested", "cancelled"] as Decision[]).map(
            (decision) => (
              <button
                key={decision}
                type="button"
                data-testid={testIdFor(decision)}
                onClick={() => void decide(decision)}
                disabled={busy !== null}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-900 disabled:opacity-50"
              >
                {busy === decision ? "Recording…" : decisionLabel(decision)}
              </button>
            ),
          )}
        </div>
      )}
    </section>
  );
}
