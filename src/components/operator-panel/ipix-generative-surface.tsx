"use client";

import { useSyncExternalStore } from "react";
import { GENERATIVE_UI_ROOT_ID } from "@copilotkit/shared";
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
export function IpixGenerativeComparisonSurface() {
  const runtime = useGenerativeUIRuntime();
  useSyncExternalStore(
    runtime?.manager.subscribe ?? noSubscription,
    runtime?.manager.getVersion ?? zero,
    zero,
  );
  const surface = runtime?.manager.getSurfaceForTarget(TARGET);
  const showRecovery = surface?.status === "ready" &&
    !surface.model?.componentsModel?.get(GENERATIVE_UI_ROOT_ID);

  return (
    <>
      <GenerativeUISurface
        id={TARGET}
        description="Read-only qualitative comparison of shoot concepts. Use one ConceptComparison only for proposed ideas. Do not assert measured or approved business facts."
        ui={ipixGenerativeUI}
        components={["ConceptComparison"]}
        fallback={<span className="sr-only">No generated comparison yet.</span>}
        autoScroll={false}
        className={styles.generativeSurface}
      />
      {showRecovery ? (
        <p role="status" className="px-4 py-2 text-sm text-[var(--foreground)]" data-testid="genui-comparison-recovery">
          We couldn't show this comparison. Ask iPix to try again.
        </p>
      ) : null}
    </>
  );
}
