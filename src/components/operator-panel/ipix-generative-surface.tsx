"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { A2UI_VERSION, GENERATIVE_UI_ROOT_ID } from "@copilotkit/shared";
import {
  GenerativeUISurface,
  useGenerativeUIRuntime,
} from "@copilotkit/react-core/v2/generative-ui";
import { ipixGenerativeUI } from "@/lib/copilotkit/ipix-generative-ui";
import styles from "./operator-panel.module.css";

const TARGET = "planner-comparison";
const noSubscription = () => () => {};
const zero = () => 0;

/** Keep the native Surface mounted. A completed rootless surface is broken,
 * whether it contains rejected operations or the agent simply omitted its
 * root; streaming/empty states must not show an error. The native manager
 * follows the provider's active thread, preventing stale thread content.
 */
export function IpixGenerativeComparisonSurface({
  scopeKey = "workspace",
  runActive = false,
}: {
  scopeKey?: string;
  runActive?: boolean;
}) {
  const runtime = useGenerativeUIRuntime();
  const previousScope = useRef(scopeKey);
  const previousRunActive = useRef(runActive);
  useSyncExternalStore(
    runtime?.manager.subscribe ?? noSubscription,
    runtime?.manager.getVersion ?? zero,
    zero,
  );
  const surface = runtime?.manager.getSurfaceForTarget(TARGET);

  // A brand/shoot change must not leave the previous scope's card mounted.
  // The manager is thread-scoped; delete the active target surface when the
  // authorized Planner scope changes, then let the new scope render nothing
  // until the model produces a new card.
  useEffect(() => {
    if (previousScope.current === scopeKey) return;
    const active = runtime?.manager.getSurfaceForTarget(TARGET);
    if (active && runtime) {
      runtime.manager.ingest(active.threadId, active.agentId, {
        surfaceId: active.surfaceId,
        catalogId: ipixGenerativeUI.id,
        target: TARGET,
        status: "ready",
        rejected: [],
        operations: [
          {
            version: A2UI_VERSION,
            deleteSurface: { surfaceId: active.surfaceId },
          },
        ],
      });
    }
    previousScope.current = scopeKey;
  }, [runtime, scopeKey]);

  const runJustEnded = previousRunActive.current && !runActive;
  useEffect(() => {
    previousRunActive.current = runActive;
  }, [runActive]);
  const interrupted = surface?.status === "streaming" && runJustEnded;
  const showRecovery = interrupted ||
    (surface?.status === "ready" &&
      (!surface.model?.componentsModel?.get(GENERATIVE_UI_ROOT_ID) ||
        surface.serverRejected.length > 0 ||
        surface.clientRejected.length > 0));

  return (
    <section
      aria-label="AI comparison"
      data-testid="genui-comparison-region"
    >
      {showRecovery ? (
        <p role="status" className="px-4 py-2 text-sm text-[var(--foreground)]" data-testid="genui-comparison-recovery">
          We couldn't show this comparison. Ask iPix to try again.
        </p>
      ) : null}
      {/* Keep the target mounted so the model still learns it exists, but hide
          the prior root when the latest update was rejected or interrupted. */}
      <div hidden={showRecovery} aria-hidden={showRecovery ? true : undefined}>
        <GenerativeUISurface
          id={TARGET}
          description="Read-only qualitative comparison of shoot concepts. Use one ConceptComparison with props title and 2-3 options, each exactly { name, rationale }. Use A2UI 1.0 operations only; do not use an op/component.type wrapper or measured business facts."
          ui={ipixGenerativeUI}
          components={["ConceptComparison"]}
          fallback={<span className="sr-only">No generated comparison yet.</span>}
          autoScroll={false}
          className={styles.generativeSurface}
        />
      </div>
    </section>
  );
}
