# IPI-1072 · OPERATIONS-001 — Bring the Operator Inbox and Coordination Workflow Into the New App

**File:** `IPI-1072-OPERATIONS-001.md`  
**Linear action:** UPDATE  
**MIGRATEv2:** Yes (already)  
**READY TO PATCH LINEAR:** YES

## 1. Task full name

IPI-1072 · OPERATIONS-001 — Bring the Operator Inbox and Coordination Workflow Into the New App

## 2. Current V2 owner / scope

Operator inbox/notifications. Not second durable workflow SSOT.

## 3. Exact Lumina URLs / files to inspect

- https://github.com/amoai-tech/luminaai/tree/main/app/src/app/(operator)/app/inbox
- https://github.com/amoai-tech/luminaai/tree/main/app/src/components/notifications
- https://github.com/amoai-tech/luminaai/tree/main/app/src/lib/notifications
- https://github.com/amoai-tech/luminaai/tree/main/app/src/app/api/notifications

## 4. COPY

Inbox/notifications UI; unread/read/status helpers/tests; loading/error/empty.

## 5. ADAPT

Links → current V2 entity routes; deleted targets fail safely.

## 6. DROP

Campaigns triage; AI triage; Worker dispatcher; inbox as second workflow truth; API route wholesale port.

## 7. Exact additions / corrections required in the Linear issue

- Unread/read/status derivation tests
- Prevent inbox becoming second durable workflow truth
- Links resolve to supported V2 routes; deleted targets fail safely
- API notifications = contracts/tests only

## 8. Acceptance criteria additions

- [ ] Inbox lists org notifications with honest states
- [ ] Broken/deleted targets fail safely
- [ ] No AI triage / Worker

## 9. Dependency / relation correction

APP-001. Parallel Wave B.

## 10. Checklist

- [ ] Current Linear issue read first
- [ ] Current `ipixai` target code inspected
- [ ] Exact Lumina URLs/files listed
- [ ] COPY / ADAPT / DROP documented
- [ ] Pure tests identified for reuse
- [ ] Old API inspected only for contract/tests when needed
- [ ] Current auth/org/schema/runtime remains authority
- [ ] No browser service-role / tenant authority
- [ ] No obsolete Worker/custom SSE
- [ ] No fake data/metrics
- [ ] Loading/empty/success/error/unauthorized where UI
- [ ] Cross-org negative proof where tenant data
- [ ] Exact ACs + dependency changes listed
- [ ] At task start: inspect `package.json` scripts (as of 2026-09-03 `npm run dev` disabled → `dev:ui` / `dev:agent`)
- [ ] Installed package versions recorded at task start (ignore stale pins in issue body)

## 11. Faster / better approach

COPY notifications UI+helpers → ADAPT link targets → DROP AI/Worker.

## 12. READY TO PATCH LINEAR

**YES**

Patch style: prepend `AUTHORITATIVE MIGRATION REUSE ADDENDUM — 2026-09-03` with only deltas above — do not rewrite the full issue body.

---

# AUTHORITATIVE FULL-URL + PRODUCTION AUDIT REFRESH — 2026-09-03

**Code authority:** audit and implement from a clean/current `amoai-tech/ipixai@main` / `origin/main`, not the current dirty docs worktree. At audit time local HEAD was `dbc6f0b...` while `origin/main` was `b034423...`. Re-check SHA at task start.

**Global execution rule:** inspect `package.json` + installed source/types first; current package/runtime contracts beat stale issue pins. The current skill tree has no `ponytail` skill, so use explicit cheapest-proof-first verification instead.

**Official implementation authority when relevant:**
- https://github.com/vercel/next.js
- https://github.com/supabase/supabase
- https://github.com/mastra-ai/mastra
- https://github.com/CopilotKit/CopilotKit

Use the official repository only to resolve current framework/library behavior; installed versioned source/types in ipixai still win when upstream `main` has moved ahead.

## Exact Lumina sources
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/notifications/inbox-workspace.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/notifications/inbox-workspace.test.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/notifications/inbox-format.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/notifications/inbox-format.test.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/notifications/notification-row.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/notifications/notification-row.test.tsx

## Current Supabase truth / blocker
`public.notifications` + `notification_reads` exist. `public.list_notifications` and `mark_notifications_read` are SECURITY DEFINER. Notifications can target `brand_org_id`, `agency_org_id`, talent and CRM entities, so membership-union visibility must not silently become active-org inbox authority.

## Faster/better approach
First certify or add a **current-org-bound notification read contract**; only then COPY notification presentation/formatting. Do not port old API routes wholesale.

## Red flags / fixes
- list/mark-all spans every membership → bind active org or explicitly define cross-org inbox product semantics.
- deleted target links crash → safe non-navigation state.
- `read` column vs per-user `notification_reads` ambiguity → choose one canonical per-user read contract.
- inbox becomes second workflow truth → notifications only point to durable domain truth.

## Score / production gate
Architecture 98 · Security **90 until org contract is certified** · Reuse 99 · Overall **94/100 provisional → 99 after contract fix**. Success = current-org-safe list/read behavior, no cross-org leak, broken targets safe, honest states, no AI triage/Worker, targeted tests/typecheck/build/browser.

