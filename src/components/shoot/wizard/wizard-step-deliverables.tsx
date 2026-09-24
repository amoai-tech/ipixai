import type { ShootPlan } from "@/mastra/tools/plan-schema";
import styles from "../shoot-wizard-shell.module.css";
export function WizardStepDeliverables({ plan }: { plan: ShootPlan }) { return <div className={styles.placeholder} data-testid="wizard-deliverables"><h2>Deliverables</h2>{plan.deliverablesResult.deliverables.length ? <ul>{plan.deliverablesResult.deliverables.map((item, index) => <li key={`${item.channel}-${index}`}>{item.channel} · {item.format} × {item.quantity}</li>)}</ul> : <p>No deliverables are ready yet.</p>}</div>; }
