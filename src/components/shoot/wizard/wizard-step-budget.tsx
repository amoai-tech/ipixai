import type { ShootPlan } from "@/mastra/tools/plan-schema";
import styles from "../shoot-wizard-shell.module.css";
export function WizardStepBudget({ plan }: { plan: ShootPlan }) { return <div className={styles.placeholder} data-testid="wizard-budget"><h2>Budget</h2>{plan.budgetResult.status === "ok" && plan.budgetResult.total !== undefined ? <dl><div><dt>Total</dt><dd>{plan.budgetResult.currency} {plan.budgetResult.total}</dd></div></dl> : <p>Budget needs more input.</p>}</div>; }
