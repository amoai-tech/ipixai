import { ShootPlanReviewSession } from "@/components/shoot/shoot-plan-review-session";
import type { ShootPlan } from "@/mastra/tools/plan-schema";
import styles from "../shoot-wizard-shell.module.css";

type Props = { plan: ShootPlan; brandId: string; reviewStarted: boolean; onReviewStart: () => void; onReviewStartFailed: () => void; };
export function WizardStepConfirmation({ plan, brandId, reviewStarted, onReviewStart, onReviewStartFailed }: Props) {
  return <div className={styles.formStack} data-testid="wizard-confirmation">
    <p>Plan status: <strong>{plan.status}</strong></p>
    {plan.productRefs.length ? <ul data-testid="wizard-product-refs">{plan.productRefs.map((ref) => <li key={`${ref.provider}:${ref.providerProductId}:${ref.providerVariantId ?? ""}`}>{ref.title} · {ref.providerProductId}{ref.providerVariantId ? ` · ${ref.providerVariantId}` : ""}</li>)}</ul> : <p>No product references were supplied.</p>}
    {plan.status === "needs_input" ? <div role="alert"><p>This plan still needs input before exact-revision review.</p><ul>{plan.missingInputs.map((item) => <li key={item}>{item}</li>)}</ul></div> : reviewStarted ? <ShootPlanReviewSession brandId={brandId} plan={plan as unknown as Record<string, unknown>} onStartFailed={onReviewStartFailed} /> : <button type="button" className={styles.primary} onClick={onReviewStart}>Review exact plan</button>}
    <p>No Shoot is saved from this Wizard yet. IPI-1083 remains the single save-once owner.</p>
  </div>;
}
