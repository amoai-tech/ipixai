# 02 — Keep / rebuild matrix

**After:** [01-current-state-audit.md](./01-current-state-audit.md)
**Before:** [03-repo-review.md](../../notes/03-repo-review.md)
Fashion example: keep the lookbook shots and talent roster; rebuild the radio between producer and photographer.

Yes. The clean way is to separate each platform into **KEEP**, **REBUILD/CLEAN UP**, and **WHY**.

## Mastra

| Part                         | Keep or Rebuild?   | Why                                                           |
| ---------------------------- | ------------------ | ------------------------------------------------------------- |
| Agents                       | **KEEP**           | Business logic is valuable                                    |
| Prompts                      | **KEEP**           | Already tuned for iPix workflows                              |
| Tools                        | **KEEP**           | Reuse existing capabilities                                   |
| Workflows                    | **KEEP**           | Shoot Wizard, Brand Intelligence, Planner logic already exist |
| `mastra.*` database data     | **KEEP**           | Real threads/messages/snapshots already stored                |
| Current `mastra` schema      | **KEEP**           | Correct private schema direction                              |
| `@mastra/pg` storage concept | **KEEP**           | Good persistence architecture                                 |
| Runtime bootstrap            | **REBUILD**        | Too many assumptions and patches accumulated                  |
| Package/version contract     | **REBUILD/CLEAN**  | Must lock one supported family                                |
| Storage initialization       | **REBUILD/CLEAN**  | Make explicit and predictable                                 |
| Environment validation       | **REBUILD**        | Local/preview/prod behavior should be deterministic           |
| Runtime ↔ database boundary  | **REBUILD**        | Needs one clean tested path                                   |
| Observability setup          | **IMPROVE**        | Too little runtime visibility today                           |
| Scheduler/dispatcher setup   | **REVIEW/REBUILD** | Current snapshot/trigger noise suggests poor configuration    |

## CopilotKit

| Part                                   | Keep or Rebuild?     | Why                                                       |
| -------------------------------------- | -------------------- | --------------------------------------------------------- |
| Chat UI                                | **KEEP**             | Product UX already exists                                 |
| Planner interaction model              | **KEEP**             | User experience is useful                                 |
| Existing actions                       | **KEEP**             | Business actions are reusable                             |
| Agent selection/registry concepts      | **KEEP**             | No need to recreate                                       |
| Current org/thread authorization rules | **KEEP + VERIFY**    | Good foundation                                           |
| SSE/streaming wrapper                  | **REBUILD/CLEAN**    | Recent TextDecoder/pipe failures show fragility           |
| Thread persistence wiring              | **REBUILD**          | Refresh restore is not reliably proven                    |
| Runtime configuration                  | **REBUILD**          | Too many implicit assumptions                             |
| HITL integration                       | **REBUILD/CLEAN**    | Needs one canonical suspend/resume path                   |
| Threads drawer/Intelligence wiring     | **SEPARATE / LATER** | Not required for basic Planner persistence                |
| Error handling                         | **IMPROVE**          | Streaming vs persistence failures need clearer separation |
| Runtime tests                          | **IMPROVE**          | Need real deployed refresh/reconnect tests                |

## Cloudflare

| Part                                | Keep or Rebuild?   | Why                                                   |
| ----------------------------------- | ------------------ | ----------------------------------------------------- |
| DNS                                 | **KEEP**           | Strong and stable                                     |
| CDN                                 | **KEEP**           | Core Cloudflare strength                              |
| WAF/security                        | **KEEP**           | Valuable protection                                   |
| R2                                  | **KEEP**           | Good asset storage                                    |
| AI Gateway                          | **KEEP**           | Useful for AI providers/cost/control                  |
| Queues                              | **KEEP**           | Good for background jobs                              |
| Lightweight Workers                 | **KEEP**           | Good fit for edge/webhooks/small APIs                 |
| Worker build setup                  | **REBUILD**        | Git Builds, Wrangler, preview paths are inconsistent  |
| Preview/production deployment model | **REBUILD**        | Needs one clear deployment contract                   |
| Build-time flags                    | **REBUILD/CLEAN**  | `IPIX_CF_INCLUDE_MASTRA_PG_SCOPE` problem proves this |
| OpenNext integration                | **REVIEW/REBUILD** | Major source of runtime complexity                    |
| Mastra PG-scope bundling            | **REBUILD**        | Must be deterministic                                 |
| Secrets sync                        | **REBUILD/CLEAN**  | Too many paths/sources                                |
| Hyperdrive runtime boundary         | **KEEP + CLEAN**   | Good idea, but integration needs better proof         |
| Worker bundle strategy              | **REBUILD/CLEAN**  | Current stubs/size workarounds are fragile            |
| Worker observability                | **IMPROVE**        | Need clear build/runtime/version proof                |

## Supabase

| Part                         | Keep or Rebuild?   | Why                                                 |
| ---------------------------- | ------------------ | --------------------------------------------------- |
| PostgreSQL                   | **KEEP**           | Strong foundation                                   |
| Auth                         | **KEEP**           | Already integrated                                  |
| Existing application data    | **KEEP**           | Valuable production data                            |
| `mastra` schema              | **KEEP**           | Correct private namespace                           |
| RLS patterns                 | **KEEP + IMPROVE** | Good base, continue hardening                       |
| Existing migrations          | **KEEP**           | History should remain authoritative                 |
| Hyperdrive DB role           | **KEEP + REVIEW**  | Good server-side architecture                       |
| Schema diff process          | **REBUILD**        | Missing table issue should have been caught earlier |
| Migration verification       | **REBUILD**        | Need installed-adapter ↔ live-schema checks         |
| Runtime grants verification  | **IMPROVE**        | Make automated                                      |
| Drift detection              | **IMPROVE**        | Prevent live/repo mismatches                        |
| Retention/pruning            | **REBUILD/CLEAN**  | Dispatcher snapshot growth needs control            |
| Observability data strategy  | **IMPROVE**        | Currently underused                                 |
| Environment database mapping | **REBUILD/CLEAN**  | Dev/QA/preview/prod should be explicit              |

## Infisical

| Part                             | Keep or Rebuild?       | Why                                            |
| -------------------------------- | ---------------------- | ---------------------------------------------- |
| Infisical itself                 | **KEEP**               | Good central secret manager                    |
| Existing secret values           | **KEEP**               | No reason to rotate without need               |
| Secret naming                    | **KEEP + STANDARDIZE** | Mostly fine                                    |
| Local secret injection           | **KEEP**               | Good workflow                                  |
| Environment structure            | **REBUILD/CLEAN**      | Dev/preview/prod mapping should be clearer     |
| Secret sync to GitHub/Cloudflare | **REBUILD**            | Missing secrets caused several blockers        |
| Required-secret validation       | **ADD**                | Report missing/present without exposing values |
| Duplicate `.env` reliance        | **REDUCE**             | Avoid multiple sources of truth                |

## GitHub / CI

| Part                         | Keep or Rebuild? | Why                                    |
| ---------------------------- | ---------------- | -------------------------------------- |
| GitHub PR workflow           | **KEEP**         | Good governance                        |
| Protect-main                 | **KEEP**         | Strong safety net                      |
| Unit tests                   | **KEEP**         | Valuable                               |
| Typecheck                    | **KEEP**         | Essential                              |
| Database gates               | **KEEP**         | Good protection                        |
| Required checks              | **KEEP**         | Useful                                 |
| Product readiness definition | **REBUILD**      | CI green ≠ feature works               |
| Preview E2E                  | **REBUILD**      | Must test real deployed Worker         |
| Build artifact verification  | **ADD**          | Verify real PG scope vs stub           |
| Runtime smoke gates          | **ADD**          | Worker → Hyperdrive → Supabase         |
| Refresh/restart journey      | **ADD**          | Critical for AI persistence            |
| Post-deploy verification     | **ADD**          | Exact deployed version must be checked |

## The simplest summary

| Platform       | Keep                                    | Rebuild                                 |
| -------------- | --------------------------------------- | --------------------------------------- |
| **Mastra**     | agents, prompts, workflows, tools, data | runtime + storage integration           |
| **CopilotKit** | UI, actions, interaction model          | streaming + persistence + HITL wiring   |
| **Cloudflare** | DNS, CDN, WAF, R2, AI Gateway, Queues   | Worker build/deploy/runtime setup       |
| **Supabase**   | Postgres, Auth, data, schemas           | schema verification + migration process |
| **Infisical**  | secret manager                          | environment/sync contract               |
| **GitHub/CI**  | tests + branch protection               | deployed-product validation             |

The core idea is:

> **Keep the product and business logic. Rebuild the plumbing between the platforms.**
