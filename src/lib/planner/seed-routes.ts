/**
 * Whether the test-only Planner seed route may run.
 *
 * Always on in `next dev`. In a production build it stays off unless the e2e
 * CI job opts in with IPIX_E2E_SEED_ROUTES=1 on a CI runner (GitHub Actions
 * sets CI=true), and never on Vercel. A deployed app cannot expose it through
 * one misconfigured variable: it would need the opt-in, CI=true, and a host
 * other than Vercel.
 */
export function plannerSeedRoutesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV !== "production") return true;
  return env.IPIX_E2E_SEED_ROUTES === "1" && env.CI === "true" && !env.VERCEL;
}
