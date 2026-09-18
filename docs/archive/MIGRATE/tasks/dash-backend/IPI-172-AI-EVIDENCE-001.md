# IPI-172 · AI-EVIDENCE-001 — Persist Provider-Neutral Evidence and Citations for iPix AI Decisions

**File:** `IPI-172-AI-EVIDENCE-001.md`  
**Linear action:** UPDATE (external/non-MIGRATE)  
**MIGRATEv2:** No (keep outside)  
**READY TO PATCH LINEAR:** YES

## 1. Task full name

IPI-172 · AI-EVIDENCE-001 — Persist Provider-Neutral Evidence and Citations for iPix AI Decisions

## 2. Current V2 owner / scope

Persist provider-neutral evidence. EvidenceBlock = presentation.

## 3. Exact Lumina URLs / files to inspect

- https://github.com/amoai-tech/luminaai/tree/main/app/src/components/evidence-block
- Brand Intelligence / Talent / Intelligence evidence structures

## 4. COPY

EvidenceBlock presentation contract/types/tests.

## 5. ADAPT

V2 persistence: evidence ID, org/entity linkage, source URL/doc, retrieved-at, excerpt/location, citation metadata — provider-independent.

## 6. DROP

Provider-specific UI assumptions; model-named citation formats as SSOT.

## 7. Exact additions / corrections required in the Linear issue

Provider-neutral evidence identity contract as above; EvidenceBlock consumes without knowing model/provider.

## 8. Acceptance criteria additions

- [ ] Stored evidence usable across Brand/Talent/Rail without provider coupling
- [ ] EvidenceBlock renders from contract only

## 9. Dependency / relation correction

Supports BRAND-INTEL / BRAND-KNOWLEDGE; do not serialize Brand UI on this.

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

Define persistence schema → port EvidenceBlock → wire consumers.

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
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/evidence-block/evidence-block.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/evidence-block/evidence-block.test.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/evidence-block/types.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/evidence-block/index.ts
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/intelligence-panel/evidence-dialog.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/mastra/tools/brand-intelligence-tools.ts

## Current-state gap
The targeted live schema audit did **not** identify an obvious single provider-neutral evidence table. Therefore persistence is not yet proven and must be designed/verified before implementation; EvidenceBlock is presentation, not durable truth.

## Faster/better approach
First define the smallest provider-neutral evidence contract and map all existing consumers to it. Only create new persistence if no existing table can satisfy the contract after a focused schema/code search. Then port EvidenceBlock unchanged where possible.

## Red flags / fixes
- provider/model-specific citation JSON becomes SSOT → provider-neutral fields.
- source excerpt without provenance/retrieved-at/location → incomplete evidence.
- evidence accessible across org/entity boundaries → RLS + explicit org/entity ownership.
- duplicating Brand/Talent/Rail evidence tables → one shared contract.

## Score / production gate
Architecture 98 · Security 96 · Persistence certainty 82 · Overall **94/100 provisional**. Success = authoritative persistence source identified, provider-neutral schema, org/entity isolation, stable evidence IDs + URL/doc/location/retrieved-at metadata, EvidenceBlock consumes contract without provider coupling, migration/RLS/advisor/tests if new DB schema is required.

