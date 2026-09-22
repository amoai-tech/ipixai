import type { ShootPlan } from "@/mastra/tools/plan-schema";
import styles from "../shoot-wizard-shell.module.css";
export function WizardStepShotList({ plan }: { plan: ShootPlan }) { return <div className={styles.placeholder} data-testid="wizard-shot-list"><h2>Shot List</h2>{plan.shotListResult?.shots.length ? <ol>{plan.shotListResult.shots.map((shot) => <li key={shot.shotNumber}>{shot.description} · {shot.angle} · reference {shot.referenceId}</li>)}</ol> : <p>No trusted-reference-backed shots are ready yet.</p>}</div>; }
