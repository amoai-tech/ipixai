"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ShotReferenceBrowser } from "@/components/shoot/shot-reference-browser";
import { planApprovalMessage } from "@/lib/shoot/plan-approval";
import { isDatabaseUuid } from "@/lib/database-uuid";
import {
  applyReferenceSelection,
  describeShootPlanReview,
} from "@/lib/shoot/shoot-plan-review-view";
import type { ShotReferenceCatalogEntry } from "@/lib/shoot/shot-type-references";

/**
 * IPI-1084 · APPROVAL-001 — the operator's review surface for one exact ShootPlan
 * revision. It renders the canonical plan, lets the operator keep or replace a
 * trusted reference in local review state, and records one of four decisions
 * through the authorized server route. A separate explicit "Approve & save"
 * action reuses the idempotent server-owned save RPC after the decision is durable.
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
  onSettled?: (outcome: PlanReviewSettled) => void | Promise<void>;
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

/**
 * The save API exposes stable reason codes, not human-facing error strings.
 * Map only known codes to safe guidance: approval-specific errorText() returns
 * "decision could not be recorded" for SAVE_FAILED/NOT_APPROVED, which is
 * misleading here because the decision may already be durable.
 */
function saveFailureMessage(body: unknown, status: number): string {
  const record = typeof body === "object" && body !== null
    ? (body as { reason?: unknown })
    : null;
  const reason = typeof record?.reason === "string" ? record.reason.toUpperCase() : "";

  switch (reason) {
    case "SAVE_FAILED":
      return "The save service could not confirm the result. Check your Shoots list, then retry Approve & save; the server ensures one Shoot per approval.";
    case "UNAUTHENTICATED":
      return "Your session expired. Sign in again before trying to save.";
    case "FORBIDDEN":
      return "You do not have permission to save this Shoot. Contact a brand owner or editor.";
    case "NOT_FOUND":
      return "This approval was not found in your organization. Reload and review the current plan.";
    case "NOT_APPROVED":
      return "This plan is not approved. Check its approval status before trying to save.";
    case "SUPERSEDED_REVISION":
      return "A newer plan revision exists. Review and approve the latest version before saving.";
    case "HASH_MISMATCH":
      return "The approved plan does not match the stored revision. Reload and review the current plan.";
    case "INVALID_INPUT":
    case "INVALID_PLAN":
      return "The approval or plan is invalid. Reload and review it before trying again.";
  }

  // Do not echo an unknown or potentially sensitive server error string.
  // Status fallback handles authentication middleware's {error:"unauthorized"}
  // without a reason, and missing/malformed JSON from transient failures.
  if (status === 401) return "Your session expired. Sign in again before trying to save.";
  if (status === 403) return "You do not have permission to save this Shoot. Contact a brand owner or editor.";
  if (status === 409) return "The approved plan has changed. Reload and review its current revision.";
  if (status >= 500) return "The save service could not confirm the result. Check your Shoots list, then retry Approve & save; the server ensures one Shoot per approval.";
  return "The save response was unexpected. Check your Shoots list and reload before trying again.";
}

export function ShootPlanReview({
  identity: initialIdentity,
  plan,
  catalog,
  deliverableChannel,
  onSettled,
  onRevised,
}: ShootPlanReviewProps) {
  const router = useRouter();
  const [identity, setIdentity] = useState(initialIdentity);
  const [draft, setDraft] = useState<Record<string, unknown>>(plan);
  const [edited, setEdited] = useState(false);
  const [superseded, setSuperseded] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<PlanReviewSettled | null>(null);
  const [savedShootId, setSavedShootId] = useState<string | null>(null);
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

  async function decide(decision: Decision, saveAfterApproval = false) {
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
      if (saveAfterApproval) {
        // Explicit operator action, never an AI/model action. The backend
        // revalidates the stored exact approved revision and tenant rights.
        // A dropped connection can happen after the approval was durably
        // recorded. Do not misreport it as a failed approval; the save RPC
        // remains idempotent when the operator retries the same approval ID.
        const savedResponse = await fetch("/api/shoots/save", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ approvalId: identity.approvalId }),
        }).catch(() => null);
        if (!savedResponse) {
          setError(
            "Plan approved, but the Shoot was not confirmed saved. " +
            saveFailureMessage(null, 503),
          );
          return;
        }
        const saved: unknown = await savedResponse.json().catch(() => null);
        const savedRecord =
          typeof saved === "object" && saved !== null ? (saved as Record<string, unknown>) : null;
        if (!savedResponse.ok || savedRecord?.ok !== true ||
            !isDatabaseUuid(savedRecord.shootId)) {
          setError(
            "Plan approved, but the Shoot was not confirmed saved. " +
            saveFailureMessage(saved, savedResponse.status),
          );
          return;
        }
        const shootId = savedRecord.shootId;
        setSavedShootId(shootId);
        setOutcome(result);
        // Persisted truth wins over a separate (possibly failing) agent resume.
        // Keep the saved Shoot link visible if the interrupted run cannot resume.
        try {
          await onSettled?.(result);
        } catch {
          setError("Shoot saved, but Planner could not resume. Open the saved Shoot below.");
          return;
        }
        router.push(`/app/shoots/${shootId}`);
      } else {
        setOutcome(result);
        await onSettled?.(result);
      }
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
        <div role="status" data-testid="review-outcome" className="text-xs text-gray-700">
          {outcome.decision} recorded.
          {outcome.resumeState === "resume_failed"
            ? " The decision is saved; the run has not resumed yet — retry to finish."
            : ""}
          {savedShootId ? (
            <a href={`/app/shoots/${savedShootId}`} className="ml-2 underline" data-testid="saved-shoot-link">
              Open saved Shoot
            </a>
          ) : null}
        </div>
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
          <button
            type="button"
            data-testid="review-approve-and-save"
            onClick={() => void decide("approved", true)}
            disabled={busy !== null}
            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            {busy === "approved" ? "Approving and saving…" : "Approve & save Shoot"}
          </button>
        </div>
      )}
    </section>
  );
}
