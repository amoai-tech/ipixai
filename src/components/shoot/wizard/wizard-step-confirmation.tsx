import { useRef } from "react";

import {
  ShootPlanReviewSession,
} from "@/components/shoot/shoot-plan-review-session";
import type {
  PlanReviewIdentity,
  PlanReviewSettled,
} from "@/components/shoot/shoot-plan-review";
import type { ShootPlan } from "@/mastra/tools/plan-schema";
import styles from "../shoot-wizard-shell.module.css";

type Props = {
  plan: ShootPlan;
  brandId: string;
  reviewStarted: boolean;
  saving: boolean;
  saveError: string | null;
  onReviewStart: () => void;
  onReviewStartFailed: () => void;
  onReviewSettled: (outcome: PlanReviewSettled, identity: PlanReviewIdentity) => void;
  onRetrySave: () => void;
};

export function WizardStepConfirmation({
  plan,
  brandId,
  reviewStarted,
  saving,
  saveError,
  onReviewStart,
  onReviewStartFailed,
  onReviewSettled,
  onRetrySave,
}: Props) {
  const reviewStartIdRef = useRef<string | null>(null);
  if (!reviewStartIdRef.current) reviewStartIdRef.current = crypto.randomUUID();

  return <div className={styles.formStack} data-testid="wizard-confirmation">
    <p>Plan status: <strong>{plan.status}</strong></p>
    {plan.productRefs.length ? <ul data-testid="wizard-product-refs">{plan.productRefs.map((ref) => <li key={`${ref.provider}:${ref.providerProductId}:${ref.providerVariantId ?? ""}`}>{ref.title} · {ref.providerProductId}{ref.providerVariantId ? ` · ${ref.providerVariantId}` : ""}</li>)}</ul> : <p>No product references were supplied.</p>}
    {plan.status === "needs_input" ? <div role="alert"><p>This plan still needs input before exact-revision review.</p><ul>{plan.missingInputs.map((item) => <li key={item}>{item}</li>)}</ul></div> : reviewStarted ? <ShootPlanReviewSession reviewStartId={reviewStartIdRef.current} brandId={brandId} plan={plan as unknown as Record<string, unknown>} onStartFailed={onReviewStartFailed} onSettled={onReviewSettled} /> : <button type="button" className={styles.primary} onClick={onReviewStart}>Review exact plan</button>}
    {saving ? <p role="status">Saving the exact approved shoot…</p> : null}
    {saveError ? <div role="alert"><p>{saveError}</p><button type="button" className={styles.primary} onClick={onRetrySave}>Retry save</button></div> : null}
    <p>Approved revisions are saved only through the IPI-1083 save-once boundary.</p>
  </div>;
}