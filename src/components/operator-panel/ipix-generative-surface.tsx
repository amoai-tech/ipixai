"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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

type ScopedSurface = {
  threadId: string;
  agentId: string | undefined;
  surfaceId: string;
};

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
  const lastMappedScope = useRef(scopeKey);
  const surfacesByScope = useRef(new Map<string, ScopedSurface>());
  const previousRunActive = useRef(runActive);
  const [interruptedSurfaceKey, setInterruptedSurfaceKey] = useState<string | null>(null);

  useSyncExternalStore(
    runtime?.manager.subscribe ?? noSubscription,
    runtime?.manager.getVersion ?? zero,
    zero,
  );
  const surface = runtime?.manager.getSurfaceForTarget(TARGET);

  // Remember the surface that belongs to this scope. The manager is
  // thread-scoped, so a scope change can leave the old thread's surface
  // behind even when the active thread already points at the new scope.
  useEffect(() => {
    if (lastMappedScope.current !== scopeKey) return;
    if (surface) {
      surfacesByScope.current.set(scopeKey, {
        threadId: surface.threadId,
        agentId: surface.agentId,
        surfaceId: surface.surfaceId,
      });
    }
  }, [scopeKey, surface]);

  // Delete every surface recorded under the previous scope, including one
  // that belongs to a thread no longer active. Never delete the new scope's
  // surface; the new run owns that target.
  useEffect(() => {
    if (previousScope.current === scopeKey) return;
    for (const [key, scoped] of surfacesByScope.current) {
      if (key === scopeKey) continue;
      runtime?.manager.ingest(scoped.threadId, scoped.agentId, {
        surfaceId: scoped.surfaceId,
        catalogId: ipixGenerativeUI.id,
        target: TARGET,
        status: "ready",
        rejected: [],
        operations: [
          {
            version: A2UI_VERSION,
            deleteSurface: { surfaceId: scoped.surfaceId },
          },
        ],
      });
      surfacesByScope.current.delete(key);
    }
    previousScope.current = scopeKey;
    lastMappedScope.current = scopeKey;
  }, [runtime, scopeKey]);

  // Tie the interrupted state to the surface, not to one render. A run ending
  // while the surface is still "streaming" keeps recovery visible through
  // unrelated re-renders until that surface becomes ready, is deleted, or is
  // replaced.
  useEffect(() => {
    if (previousRunActive.current && !runActive && surface?.status === "streaming") {
      setInterruptedSurfaceKey(surface.key);
    }
    previousRunActive.current = runActive;
  }, [runActive, surface?.key, surface?.status]);

  useEffect(() => {
    if (!interruptedSurfaceKey) return;
    if (!surface || surface.key !== interruptedSurfaceKey || surface.status === "ready") {
      setInterruptedSurfaceKey(null);
    }
  }, [interruptedSurfaceKey, surface]);

  const interrupted = Boolean(
    interruptedSurfaceKey &&
      surface?.key === interruptedSurfaceKey &&
      surface.status === "streaming",
  );
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
