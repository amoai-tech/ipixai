# IPI-1071 · TALENT-BOOKING-001 — Let Operators Find Talent and Manage Bookings

**File:** `IPI-1071-TALENT-BOOKING-001.md`  
**Linear action:** UPDATE  
**MIGRATEv2:** Yes (already)  
**READY TO PATCH LINEAR:** YES

## 1. Task full name

IPI-1071 · TALENT-BOOKING-001 — Let Operators Find Talent and Manage Bookings

## 2. Current V2 owner / scope

Talent + Matching + Bookings operator surfaces. AI coordinator later. talent schema.

## 3. Exact Lumina URLs / files to inspect

- https://github.com/amoai-tech/luminaai/tree/main/app/src/app/(operator)/app/talent
- https://github.com/amoai-tech/luminaai/tree/main/app/src/app/(operator)/app/matching
- https://github.com/amoai-tech/luminaai/tree/main/app/src/app/(operator)/app/bookings
- https://github.com/amoai-tech/luminaai/tree/main/app/src/components/matching
- https://github.com/amoai-tech/luminaai/tree/main/app/src/components/booking
- https://github.com/amoai-tech/luminaai/tree/main/app/src/components/talent
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/tools/talent-match-tools.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/tools/booking-tools.ts
- https://github.com/amoai-tech/luminaai/tree/main/app/src/lib/booking
- https://github.com/amoai-tech/luminaai/tree/main/app/src/lib/talent

## 4. COPY

Three routes' UI; filters/cards/shortlists; booking presentation; EvidenceBlock match explanations.

## 5. ADAPT

Canonical booking/talent FSM/status imports; talent schema; tools as contract/test oracles only.

## 6. DROP

Booking agent, model-match agent, mutation AI tools as current Mastra tools in M2.

## 7. Exact additions / corrections required in the Linear issue

- Audit **Talent + Matching + Bookings** routes (three-source)
- Import canonical status/FSM — no duplicated strings
- booking-tools / talent-match-tools = contract oracles, not necessarily live tools

## 8. Acceptance criteria additions

- [ ] All three route families usable under trusted org
- [ ] Match evidence via EvidenceBlock where shown
- [ ] No Booking/Model-Match agents in M2

## 9. Dependency / relation correction

APP-001 + audit any Booking RPCs touched (task-local security).

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

Port three UIs + FSM constants → trusted reads/writes → defer agents.

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
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/talent/talent-profile-workspace.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/matching/talent-card.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/matching/talent-tab.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/matching/talent-tab.test.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/matching/shortlist-drawer.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/matching/talent-match-tabs.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/booking/booking-detail-workspace.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/booking/booking-detail-workspace.test.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/booking/booking-wizard-workspace.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/booking/booking-wizard-workspace.test.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/tools/talent-match-tools.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/tools/booking-tools.ts

## Current Supabase truth
`talent.bookings` is durable booking truth and includes `brand_org_id` + optimistic `version`; talent profiles/shortlists/availability exist. Existing booking RPCs are SECURITY DEFINER and must be audited individually before reuse.

## Faster/better approach
Reuse deterministic UI/FSM first. Generic talent discovery can use its existing visibility model; booking mutations must bind trusted active brand org and current version. Defer Booking/Model-Match agents.

## Red flags / fixes
- SECURITY DEFINER RPC accepted because legacy used it → inspect auth checks and current-org binding first.
- duplicate status strings → canonical booking FSM.
- AI mutation tools in M2 → DROP.
- cross-org booking IDs → negative tests on get/list/transition.

## Score / production gate
Architecture 99 · Security 97 · Reuse 99 · Overall **98/100 provisional**. Success = talent discovery correct, shortlist ownership safe, booking create/get/list/transition current-org safe with version checks, no agent writes, targeted tests/typecheck/build/browser.

