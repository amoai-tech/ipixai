/**
 * Whether the test-only Planner seed route may run.
 *
 * Always on in `next dev`. In a production build it stays off unless the e2e
 * CI job opts in with IPIX_E2E_SEED_ROUTES=1, and never on Vercel, so a
 * deployed app cannot expose it even if the variable were set there by mistake.
 */
export function plannerSeedRoutesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV !== "production") return true;
  return env.IPIX_E2E_SEED_ROUTES === "1" && !env.VERCEL;
}
