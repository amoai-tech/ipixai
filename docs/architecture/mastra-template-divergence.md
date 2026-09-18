# Mastra template divergence — why this repo does not mirror the upstream starter

**Status:** current as of `origin/main@2d197901bc1f5de6574c70f0bc1e3d732a99eb89` (2026-09-18).

**Upstream source:** `CopilotKit/CopilotKit` → `examples/integrations/mastra/src/mastra/index.ts`
(https://github.com/CopilotKit/CopilotKit/blob/main/examples/integrations/mastra/src/mastra/index.ts)

Pinned SHAs:

| Upstream commit | Date | Meaning |
| --- | --- | --- |
| `c3142d36` | 2026-06-04 | starter state at the time iPix copied it |
| `c17c1560` | 2026-09-16 | upstream adds dev-server loopback pinning |

## What actually happened (corrected archaeology)

iPix bootstrapped from the starter in commit `3b0cc62` (2026-08-24, *chore: bootstrap clean
iPix CopilotKit + Mastra runtime*). At that date the upstream file was still the `c3142d36`
version, which contained **only**:

```ts
import { LibSQLStore } from "@mastra/libsql";
export const mastra = new Mastra({ agents: { default: weatherAgent },
  storage: new LibSQLStore({ url: ":memory:" }) });
```

Verified by fetching the file at `c3142d36`: 19 lines, module-scope `new Mastra`, in-memory
LibSQL store, and **no `server` block and no `MASTRA_HOST` reference anywhere**.

Upstream added the loopback hardening three weeks later in `c17c1560` (2026-09-16,
*fix(examples): bind the Mastra starter's dev server to loopback*):

```ts
server: { host: process.env.MASTRA_HOST ?? "127.0.0.1" },
```

**So iPix did not "drop" that control — the control did not exist when iPix copied the
template.** The copy was faithful. The divergence was created later, by upstream moving and
by iPix changing requirements (protected Postgres URL, durable multi-tenant state, split
CLI/runtime entry), not by careless copying.

## Divergence table

| Upstream assumption at copy time | iPix decision | Why | Task |
| --- | --- | --- | --- |
| Module-scope `new Mastra({ storage })` | Lazy, memoised `getMastra()` | Constructing storage validates `MASTRA_DATABASE_URL`. `vercel pull` does not decrypt `sensitive` vars — it writes the literal `[SENSITIVE]` — so import-time construction failed the production build during page-data collection. | IPI-1231 · VERCEL-RUNTIME-001 (#210) |
| `LibSQLStore(":memory:")` | `@mastra/pg` `PostgresStore` | Planner threads, workflow state and HITL approvals must survive invocations, cold starts and redeploys. In-memory state cannot. | IPI-1229 · VERCEL-OPT-001 |
| No host pinning at all | `MASTRA_HOST` pinned in `scripts/dev-guard.mjs` | `server` is read by the Mastra CLI from the **build-time AST** of `src/mastra/index.ts`. Under the lazy split that file only re-exports `getMastra()`, so there is no `server` literal to read and upstream's `c17c1560` fix cannot be adopted verbatim. The installed deployer resolves the bind as `serverOptions?.host ?? process.env.MASTRA_HOST ?? "localhost"`, so the launcher pins it instead. | IPI-1232 · MASTRA-DEV-SEC-001 (#213) |
| Starter chat renderer used as-is | Retained deliberately | It is the product UX. It also pulls `streamdown` → `shiki` into the client graph, which is a bundle cost, not an accident to be "fixed" by rewriting the chat surface. | IPI-1234 · VERCEL-BUNDLE-003 |
| Demo identity (single implicit user) | Tenant/resource identity per org and user | Durable memory is multi-tenant; a demo identity would leak one org's Planner context into another's. | architecture (RLS + resource ids) |

## Evidence for each row

- **Lazy entry.** `src/mastra/index.ts` imports `getMastra` from `./runtime` and exports `export const mastra = getMastra()`. `src/mastra/runtime.ts` holds `let cachedMastra` and constructs inside `getMastra()` (line 18). No module-scope construction remains.
- **Postgres storage.** `src/mastra/pg-store.ts` imports `PostgresStore` from `@mastra/pg` (installed `@mastra/pg@1.22.2`, `@mastra/core@1.63.2`).
- **Loopback pin.** `scripts/dev-guard.mjs` exports `resolveChildEnv(ports, env)`; the agent-port child receives `MASTRA_HOST: env.MASTRA_HOST ?? "127.0.0.1"`. Measured before the fix: `LISTEN 0 511 *:4111 *:*` while the banner printed `http://localhost:4111`. After: `LISTEN 0 511 127.0.0.1:4111 0.0.0.0:*`. Note the banner keeps printing `localhost`, which is the same interface — the bound address is the security-relevant value.
- **Shiki carrier.** Verified chain in the installed tree: `@copilotkit/react-core@1.68.1` declares `streamdown@^1.3.0` → resolved `streamdown@1.6.11` → declares `shiki` → resolved `shiki@3.23.0`. Neither `streamdown` nor `shiki` appears in this repo's `package.json`, so it is a transitive carrier, not a direct dependency.

## Rule

> **DO NOT blindly copy future upstream starter code. Compare assumptions first.**

The starter is a demo: single user, in-memory state, unprotected environment values, and a
CLI that reads its config from a literal. iPix is a multi-tenant production app with a
protected database URL and a split CLI/runtime entry. A change that is correct upstream can
break the Vercel build, the tenant boundary, or the dev-listener security control here.

Before adopting anything from the starter, answer: *does it construct anything at module
scope? does it assume in-memory state? does it rely on the CLI reading a literal config?*

## Re-check upstream deliberately, not incidentally

`c17c1560` was a security fix that iPix independently rediscovered — it went unnoticed here
for the three weeks between the bootstrap and the upstream fix, and was found by local
measurement on 2026-09-18 rather than by watching upstream. Because iPix cannot take
upstream's mechanism verbatim (see the split-entry row above), an upstream security fix does
**not** automatically protect this repository.

Practical consequence: security-relevant upstream changes must be re-evaluated against iPix's
architecture and re-implemented in the location that actually owns the behaviour — here, the
dev launcher rather than the Mastra config.

## Known residual doc drift

`src/agent.ts` still carries a comment referring to `LibSQL` ("threadId that does not exist
in LibSQL yet"). The storage backend is Postgres; the comment is stale and should be
corrected when that file is next touched. Recorded here rather than silently edited, because
it is unrelated to any current task's scope.
