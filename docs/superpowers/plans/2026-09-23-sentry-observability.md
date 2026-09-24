# iPix Sentry Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect current iPix Next.js + Mastra runtime to the existing `ipix-wc/ipixai` Sentry project with safe browser/server/agent telemetry, source maps, releases, and deployment credentials.

**Architecture:** Use `@sentry/nextjs@11.0.0` and the official Next.js wizard output, preserving the existing Next.js config. Enable first-party Mastra instrumentation only through Sentry's supported integration and the existing Mastra instance. Sentry remains additive and never owns business state.

**Tech Stack:** Next.js 16.3.5, Node 24.x, Sentry Next.js 11.0.0, Sentry Wizard 8.0.0, Mastra 1.63.2, `@mastra/observability` 1.18.0, Vitest, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-23-sentry-observability-design.md`

## Global Constraints

- Reuse existing Sentry project `ipix-wc/ipixai`; do not create a new project or Internal Integration.
- Never expose `SENTRY_AUTH_TOKEN`, Supabase JWTs, cookies, Authorization headers, request bodies, or raw AI prompts/outputs.
- Preserve all existing `next.config.ts` redirects, Turbopack root, worker limits, and build guards.
- Sentry failures must never block iPix business behavior.
- Stop if Mastra tracing requires a broader Mastra package-family upgrade.

## Review Focus

- Missing/empty DSN must disable telemetry cleanly rather than break startup.
- Browser config must never receive `SENTRY_AUTH_TOKEN` or sensitive HTTP/body/user data.
- Existing Next.js config behavior must survive `withSentryConfig` wrapping unchanged.
- Existing error boundaries must report the provided error exactly once while preserving retry UI.
- Mastra integration must attach to the existing runtime and avoid creating a duplicate Mastra instance.

### Task 1: Install and configure the official Next.js SDK

**Files:**
- Modify: `package.json`, `package-lock.json`, `next.config.ts`
- Create: `instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` if produced/required by the current wizard
- Test: `tests/sentry-config.test.ts`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
- Produces: browser/server Sentry initialization and build-time source-map/release configuration

- [ ] **Step 1:** Write `tests/sentry-config.test.ts` to assert required config files/exports, privacy defaults, and preserved Next.js config markers.
- [ ] **Step 2:** Run `npx vitest run tests/sentry-config.test.ts` and confirm failure because Sentry setup is absent.
- [ ] **Step 3:** Run `npx @sentry/wizard@8.0.0 -i nextjs --org ipix-wc --project ipixai --saas --non-interactive --ignore-git-changes --disable-telemetry`; inspect every generated change.
- [ ] **Step 4:** Pin `@sentry/nextjs` to `11.0.0`, set conservative privacy/sampling, and wrap the existing `nextConfig` without replacing its current options.
- [ ] **Step 5:** Run the targeted test until green, then `npm run typecheck`.
- [ ] **Step 6:** Commit `feat(observability): add Sentry Next.js foundation`.

### Task 2: Report App Router errors without changing UX

**Files:**
- Modify: `src/app/app/plans/error.tsx`, `src/app/app/plans/[instanceId]/error.tsx`
- Create: `src/app/global-error.tsx`
- Test: `tests/sentry-error-boundaries.test.tsx`

**Interfaces:**
- Consumes: React error boundary `error` and `reset` props
- Produces: `Sentry.captureException(error)` plus unchanged retry UI

- [ ] **Step 1:** Write tests that render each boundary, assert `captureException` receives the exact error once, and assert retry copy/button behavior remains.
- [ ] **Step 2:** Run `npx vitest run tests/sentry-error-boundaries.test.tsx` and confirm failure because errors are not reported/global boundary is absent.
- [ ] **Step 3:** Add minimal Sentry capture to the two existing boundaries and add the global App Router boundary.
- [ ] **Step 4:** Run the targeted test until green, then `npm run typecheck`.
- [ ] **Step 5:** Commit `feat(observability): report App Router errors to Sentry`.

### Task 3: Add first-party Mastra tracing safely

**Files:**
- Modify: `package.json`, `package-lock.json`, server-side Sentry initialization file from Task 1
- Test: `tests/sentry-mastra.test.ts`

**Interfaces:**
- Consumes: existing `@mastra/core@1.63.2` runtime and Sentry server initialization
- Produces: Sentry `mastraIntegration()` with observability bootstrap using `@mastra/observability@1.18.0`

- [ ] **Step 1:** Write a contract test asserting installed package compatibility and server config includes `Sentry.mastraIntegration()` without constructing a second Mastra runtime.
- [ ] **Step 2:** Run `npx vitest run tests/sentry-mastra.test.ts` and confirm failure because the integration/dependency is absent.
- [ ] **Step 3:** Install `@mastra/observability@1.18.0` and configure the first-party Sentry Mastra integration in the server runtime only.
- [ ] **Step 4:** Run targeted test, typecheck, and a local Mastra startup smoke.
- [ ] **Step 5:** Commit `feat(observability): trace Mastra operations in Sentry`.

### Task 4: Configure deployment credentials and certify end-to-end telemetry

**Files:**
- Modify outside Git: Vercel env for project `ipixai`
- Temporary only: wizard-generated Sentry example route/page if needed for synthetic proof; remove before final commit
- Docs: update this plan/spec only if implementation differs materially

**Interfaces:**
- Consumes: existing ipixai DSN and local ignored Sentry build token
- Produces: preview/production runtime telemetry, release/source maps, and verifiable Sentry events

- [ ] **Step 1:** Add `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG=ipix-wc`, `SENTRY_PROJECT=ipixai`, and secret `SENTRY_AUTH_TOKEN` to Vercel without printing secrets.
- [ ] **Step 2:** Run `npm test`, `npm run typecheck`, and `npm run build`; capture exact exit codes.
- [ ] **Step 3:** Start local/preview app with safe Sentry env and trigger one browser error plus one server error; query `ipix-wc/ipixai` and confirm new non-development events.
- [ ] **Step 4:** Trigger a controlled Mastra failure or trace path and verify it is associated with Sentry agent/trace telemetry; if Sentry cannot expose agent monitoring yet, record the precise compatibility limitation without inventing a custom exporter.
- [ ] **Step 5:** Verify the latest release/source map data resolves to source TypeScript; remove all generated demo/test routes before commit.
- [ ] **Step 6:** Re-run targeted Sentry tests, `npm test`, `npm run typecheck`, and `npm run build` after cleanup.
- [ ] **Step 7:** Commit remaining deployment-safe changes with `chore(observability): certify Sentry production setup` if any tracked changes remain.
- [ ] **Step 8:** Push `feat/sentry-observability`, open a PR against `main`, then verify exact-head checks, mergeability, submitted reviews, and unresolved review threads.

## Final Verification

- `git diff --check`
- `npx vitest run tests/sentry-config.test.ts tests/sentry-error-boundaries.test.tsx tests/sentry-mastra.test.ts`
- `npm test`
- `npm run typecheck`
- `npm run build`
- Sentry: browser + server events visible in `ipix-wc/ipixai`, correct environment/release, no sensitive payloads, source-mapped frames
- GitHub: exact PR head SHA has required checks green and zero unresolved actionable review findings
