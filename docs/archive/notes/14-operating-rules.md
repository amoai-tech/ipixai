# 14 — Operating rules (before code)

**After:** [13-mastra-rebuild.md](./13-mastra-rebuild.md)
**SSOT live DB:** [01-current-state-audit.md](./01-current-state-audit.md)
**ADRs:** [adr/](../../notes/adr)
**Tickets:** [12-task-roadmap.md](./12-task-roadmap.md)

These rules exist so the new repo does not grow a second walkie-talkie museum while we port the lookbook.

---

## 1. Empty GitHub (`amo-tech-ai/ipix`)

Repo is **empty**. Implementation has not started until Wave 1 green.

| Setting | Recommendation |
| ------- | -------------- |
| Visibility | **Private** until proprietary UI is ported |
| Merge | Squash only |
| Delete branch on merge | On |
| Auto-merge | Off until CI is real |
| Branch protection | After first starter commit on `main` |

Wave 1 proof: `npm install` · typecheck · build · starter chat screenshot.

---

## 2. Environment matrix

| | `development` | `preview` (PR) | `production` |
| - | ------------- | -------------- | ------------ |
| App | localhost | Vercel preview | Vercel (current `app/` until cutover) |
| Supabase app data | existing project, **read** brands/shoots OK | **prefer branch/preview project** | live `fashionos` |
| Mastra storage | local or preview schema | **preview/branch `mastra` only** | live `mastra.*` after Wave 4 |
| Gemini | Infisical `dev` | Infisical `preview` | Infisical `prod` |
| Cloudflare | DNS/CDN optional | AI Gateway optional | DNS/CDN/WAF/R2; **Worker chat deferred** |
| Infisical | `dev` | `preview` | `prod` |
| URLs | `:3002` | `*.vercel.app` | current production host |

**Hard rules:** no production `MASTRA_DATABASE_URL` in preview. No `NEXT_PUBLIC_` server keys. Preview never writes live threads.

---

## 3. Reuse register (KEEP / PORT / ADAPT / DROP)

Full matrix: [02-keep-rebuild-matrix.md](./02-keep-rebuild-matrix.md). Short list:

| Asset | Action |
| ----- | ------ |
| Command Center, Brand, Shoots, Assets, OperatorShell, IntelligencePanel | **PORT** |
| Production Planner prompt + tools | **PORT** after Wave 4 |
| Shoot Wizard, Brand Intelligence workflows | **PORT** MVP |
| Copilot 681-line route, ALS, Worker PG shims, Intelligence-as-persist | **DROP** |
| Dispatcher / 6k snapshots | **DROP** — new one-reminder proof later |
| `mastra.*` schema + org `resourceId` pattern | **KEEP** (preview first) |
| mastra-pm | **ADAPT** as feature ref only |

Every ported page gets a parity check: old route vs new (screenshot + critical click). Goal: same or better, not “it rendered.”

---

## 4. Product truth vs AI memory

Shoots, bookings, brands, CRM, approvals live in **normal Supabase tables**. Mastra stores conversation/context only. Working memory may *mirror* `brandName` / `shootType` for the chat; it is not the booking system.

---

## 5. One tool authz + idempotency (priority)

Before porting ~35 tools, one helper:

```text
authenticated user → org membership → role → resource ownership → approval state
```

Write tools (booking, CRM, shoot create, approve) take an **idempotency key**. Retries must not double-book the studio.

---

## 6. One HITL contract + typed outputs (priority)

Same approval shape for Brand DNA, budget, shot list, booking, CRM writes. One backend contract; UI/workflow/agent all feed it.

Zod outputs: `ShootPlan`, `TalentShortlist`, `BudgetProposal`, `BrandDnaDraft`, `ApprovalRequest`. GenUI binds to types, not prose.

HITL is **MVP right after Wave 4**, not a Core gold blocker and not Advanced.

---

## 7. Contract tests (CopilotKit ↔ Mastra)

Besides unit tests, assert: agent ids, event types, interrupt payload, `threadId`, tool-result shape. Run on every bundle upgrade (ADR 004).

---

## 8. Golden fixture org

Dedicated QA org: known brand, shoot, user, thread. `TEST-<uuid>` never runs against real client lookbooks.

---

## 9. Retention

Define retention for traces, workflow snapshots, task history, test threads **before** volume grows. Do not copy the 6k dispatcher rows.

---

## 10. Feature flags + exit checklist

Flags: `NEW_PLANNER_RUNTIME`, `NEW_BRAND_AI`, `NEW_SHOOT_WIZARD`. One journey at a time.

A feature leaves `lumina-studio` only when the new path has: functional parity, tests, production proof, rollback, telemetry, old-route removal scheduled.

---

## 11. Performance budgets (set in Wave 4, enforce in MVP)

Record baselines: first load, API latency, first token, bundle size, PG queries per turn. Update if a port blows the budget.

---

## 12. CI security

Secrets scan · dependency audit · no `NEXT_PUBLIC_` server keys · no `public.mastra_*` · no prod DB URL in preview · RLS/SQL tests when tools write.

---

## 13. Observability before the second agent

Request id, thread id, agent id, model, tool name, duration, error — visible in **staging** before Creative Director or Brand Intelligence port (IPI-V2-049). Live prod today: ~6 spans.

---

## 14. Scheduler

Do **not** port the old dispatcher. Later: one shoot reminder → prove run/retry/dedupe/retention → then expand.

---

## Priority if time is short

1. Central tool authz + idempotency  
2. Typed agent outputs + one HITL contract  
3. Preview Supabase / schema isolation (env matrix)
