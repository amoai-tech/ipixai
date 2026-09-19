import type { ProductionPlanCardView } from "@/lib/shoot/compose-shoot-plan-card-view";

/**
 * IPI-1233 · PLAN-CARD-001 — the pure Production Plan Card. Presentation only:
 * receives an already-projected, client-safe view model (see
 * `compose-shoot-plan-card-view.ts`) and renders exactly what it contains.
 * Never fetches, never parses raw tool output, never fabricates a field the
 * view model didn't provide — an absent field is simply not rendered.
 */

export function ComposeShootPlanCard({ plan }: { plan: ProductionPlanCardView }) {
  const hasDeliverables = plan.deliverables.length > 0;
  const hasShots = plan.shots.length > 0;

  return (
    <section
      data-testid="compose-shoot-plan-card"
      data-status={plan.status}
      className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4"
    >
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Production Plan</h3>
        <span
          data-testid="compose-shoot-plan-status"
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            plan.status === "complete"
              ? "bg-green-50 text-green-800"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          {plan.status === "complete" ? "Complete" : "Needs input"}
        </span>
      </header>

      {plan.objective ? (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Objective</h4>
          <p className="mt-1 text-sm text-gray-900" data-testid="compose-shoot-plan-objective">
            {plan.objective}
          </p>
        </div>
      ) : null}

      {plan.channels.length > 0 ? (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Channels</h4>
          <div className="mt-1 flex flex-wrap gap-1" data-testid="compose-shoot-plan-channels">
            {plan.channels.map((channel) => (
              <span
                key={channel}
                className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700"
              >
                {channel}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {hasShots ? (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Shots{plan.totalShots !== null ? ` (${plan.totalShots})` : ""}
          </h4>
          <ol className="mt-1 flex flex-col gap-1" data-testid="compose-shoot-plan-shots">
            {plan.shots.map((shot) => (
              <li key={shot.shotNumber} className="flex gap-2 text-xs text-gray-900">
                <span className="shrink-0 text-gray-400">
                  {String(shot.shotNumber).padStart(2, "0")}
                </span>
                <span>
                  {shot.description}
                  {shot.angle ? <span className="text-gray-500"> · {shot.angle}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {hasDeliverables ? (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Deliverables{plan.totalAssets !== null ? ` (${plan.totalAssets} assets)` : ""}
          </h4>
          <ul className="mt-1 flex flex-col gap-1" data-testid="compose-shoot-plan-deliverables">
            {plan.deliverables.map((deliverable, index) => (
              <li key={`${deliverable.channel}-${index}`} className="text-xs text-gray-900">
                {deliverable.channel} · {deliverable.format} × {deliverable.quantity}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {plan.assumptions.length > 0 ? (
        <div data-testid="compose-shoot-plan-assumptions" className="rounded-md bg-gray-50 p-2">
          <p className="text-xs font-medium text-gray-700">Assumptions</p>
          <ul className="list-disc pl-4 text-xs text-gray-700">
            {plan.assumptions.map((entry, index) => (
              <li key={`${entry.key}-${index}`}>
                {entry.key}: {entry.value} <span className="text-gray-500">· {entry.source}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {plan.missingInputs.length > 0 ? (
        <div role="alert" data-testid="compose-shoot-plan-missing-inputs" className="rounded-md bg-amber-50 p-2">
          <p className="text-xs font-medium text-amber-900">Missing inputs</p>
          <ul className="list-disc pl-4 text-xs text-amber-900">
            {plan.missingInputs.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {plan.warnings.length > 0 ? (
        <div data-testid="compose-shoot-plan-warnings" className="rounded-md bg-gray-50 p-2">
          <p className="text-xs font-medium text-gray-700">Warnings</p>
          <ul className="list-disc pl-4 text-xs text-gray-700">
            {plan.warnings.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
