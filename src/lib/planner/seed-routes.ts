/** Set only by playwright.config.ts on the server it starts (`webServer.env`). */
export const E2E_WEBSERVER_MARKER = { key: "IPIX_E2E_WEBSERVER", value: "playwright" } as const;

/**
 * Whether the test-only Planner seed route may run.
 *
 * Always on in `next dev`. In a production build it stays off unless the e2e
 * CI job opts in with IPIX_E2E_SEED_ROUTES=1 AND the server was started by
 * Playwright (which alone sets IPIX_E2E_WEBSERVER=playwright), and never on
 * Vercel. A generic flag such as CI=true is not enough, because real builds
 * and deployments can inherit it.
 */
export function plannerSeedRoutesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV !== "production") return true;
  return (
    env.IPIX_E2E_SEED_ROUTES === "1" &&
    env[E2E_WEBSERVER_MARKER.key] === E2E_WEBSERVER_MARKER.value &&
    !env.VERCEL
  );
}
