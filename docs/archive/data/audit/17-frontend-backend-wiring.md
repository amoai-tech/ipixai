# 17 — Frontend/backend wiring

Status: Complete for **this repo** (`/home/sk/ipixai`)
Score: 60/100
Verification confidence: 84/100
Tables inspected: n/a
Code paths inspected: CopilotKit route, `runtime-org.ts`, `pg-store.ts`; grep `src/` for `shoots` / `campaigns` / `commit_shoot_draft`
Live queries: none extra
Official references: CopilotKit Mastra starter pattern

## Verdict

This codebase is a **CopilotKit + Mastra starter with AUTH-002**, not the old operator console. **No `src/` queries** to `shoots` or `campaigns`. Domain UIs (brand, shoot, talent, CRM) are **disconnected here** — they live in the old operator app or are not ported. Chat path: browser → `/api/copilotkit` → JWT + `org_members` → `resourceId` → Mastra agents → `mastra.*` via `hyperdrive_mastra_runtime`. Thread ACL for Org B is **PR #23**, not `main`.

## Current state

| Surface | Wired in ipixai? |
| --- | --- |
| Login / verified operator | yes (AUTH-001/002 Done) |
| CopilotKit planner chat | yes (agents + memory store) |
| Planner SQL RPCs | **not found** in src grep this step |
| Shoot / campaign / brand pages | **not in src/app pages as domain CRUD** |
| Edge brand-intelligence | dashboard only; not called from src grep |

**Dead UI:** none in this thin app. **Disconnected backend:** live 145 tables vs this frontend.

Browser privilege: no service role in client by policy; CopilotKit uses user JWT for org lookup.

## What is correct

- Membership-only org resolution.
- Hosted Mastra URL fail-closed + approved project ref `nvdlhrodvevgwdsneplk`.
- Combined `npm run dev` blocked.

## Errors / red flags

| Pri | Finding |
| --- | --- |
| P1 | Most of the live schema has **no UI in this repo** |
| P1 | PR #23 thread ACL unmerged |
| P2 | Intelligence env defaults to localhost when licensed |

## Fixes

- Port screens only with named Linear tasks — do not copy `/home/sk/ipix`.
- Merge ACCESS ACL when tests green.

## Faster/better approach

Grep absence is evidence of disconnect.

## Production blockers

Operator **fashion production OS** is not this frontend. Core chat can ship separately.

## Existing Linear ownership

Convert plan **docs/mastra/10-mastra-convert.md**; PR #23; AUTH tickets Done.

## Verification / success criteria

- [x] Chat wiring traced
- [ ] Domain pages (N/A this repo)

## ERD / data flow where useful

```text
UI (thin)
  → /api/copilotkit
  → org_members
  → mastra.*
Live DB also has shoot/planner/brand
  → not selected from src/
```

## Next step

**18 — User journeys**
