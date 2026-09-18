# IPI-1069 · ASSETS-001 — Let Operators Browse Assets and Manage Asset Records

**File:** `dash-backend/IPI-1069-ASSETS-001.md`  
**Linear action:** UPDATE  
**MIGRATEv2:** Yes (already)  
**READY TO PATCH LINEAR:** YES  
**Audit:** Batch 1 · local 87→**~99/100** (sync brand-ID scope + data-first order; live already has IPI-1112 placeholder rule)

---

## 0. Faster / better — FIRST / default method

```text
1. Start from clean current origin/main
2. Resolve AUTH-002 trusted active org
3. Verify active-org asset DB read contract (no org_id on assets — scope via brands)
4. Build list/detail using metadata only
5. Prove cross-org denial before UI
6. COPY+CLEAN Lumina Assets browse UI
7. Check whether IPI-1112 is available
   7A. available → reuse signed preview helper
   7B. unavailable → safe placeholder/metadata (never unsigned authenticated URL)
8. Browser/network proof
```

**Do not** investigate Cloudinary signing deeply until workspace + record isolation are proven.  
**Do not** add `org_id` to `public.assets` merely for this task.

### Query contract

```text
trusted org → brand IDs WHERE org_id = trustedOrgId
→ assets WHERE brand_id IN (...)
Detail: asset id + brand_id in trusted-org brand IDs
```

RLS `assets_select` is membership-union via brand — explicit active-org filter still required.

```text
Asset record exists  ≠  User authorized to receive private media bytes
```

Treat `assets.url` / `thumbnail_url` / `cloudinary_assets.secure_url` as metadata — not automatic render authority.

---

## 1. Task full name

IPI-1069 · ASSETS-001 — Let Operators Browse Assets and Manage Asset Records

## 2. Current V2 owner / scope

M2 workspace / list / detail only. Upload/review/approve/deliver = MEDIA-001.  
**Routes:** `/app/assets`, `/app/assets/[id]`.  
IPI-1112 is **related**, not M2 start blocker.

## 3. Exact Lumina URLs / files to inspect

- https://github.com/amoai-tech/luminaai/tree/main/app/src/components/assets
- Prefer `amoai-tech/luminaai` over stale studio attachments

## 4. SELECTIVE COPY / ADAPT

COPY: `asset-card`, `assets-workspace`, `asset-detail-workspace`, filters, sort, selection, empty/loading/error tests.

## 5. ADAPT

Trusted-org via brand IDs; record vs preview authorization; IPI-1112 when present else placeholder.

## 6. DROP

- `asset-upload-panel.tsx` + upload tests
- DNA approval writes; channel export actions
- Direct URL signing code; Cloudinary Search-as-database
- Second signer/transform layer

## 7. Exact additions / corrections for Linear addendum

- Prepend data-contract-first order (§0) — isolation before Cloudinary docs depth
- Explicit: no `org_id` column migration; scope via active-org brand IDs
- Explicit: DB URL columns ≠ safe to render
- Confirm IPI-1112 placeholder rule (already in live — reinforce)
- SELECTIVE COPY + DROP upload panel; lean skills wording

## 8. Acceptance criteria

- [ ] List/detail scoped via active-org brand IDs
- [ ] Cross-org asset ID fails closed
- [ ] Supabase = library truth; no Cloudinary Search-as-DB
- [ ] IPI-1112 reused if present; else safe placeholder — never unsigned auth URL
- [ ] No upload/review/approval/delivery
- [ ] Loading / empty / error / unauthorized matrix

## 9. Dependencies

Hard: APP-001. Related: IPI-1112 (optional for M2 Done), MEDIA-001 (out of scope). Soft Wave B parallel.

## 10. READY TO PATCH LINEAR

**YES** — prepend addendum (data-first + brand-ID scope + URL-as-metadata).

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
- https://github.com/amoai-tech/luminaai/blob/main/app/src/app/(operator)/app/assets/page.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/assets/assets-workspace.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/assets/assets-workspace.test.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/assets/asset-card.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/app/(operator)/app/assets/[id]/page.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/assets/asset-detail-workspace.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/components/assets/asset-detail-workspace.test.tsx
- https://github.com/amoai-tech/luminaai/blob/main/app/src/lib/assets/get-assets.ts

## Current Supabase truth
`public.assets` has `brand_id` and `v2_shoot_id` but no `org_id`; scope through trusted-org brand IDs. Supabase is media-library metadata truth; Cloudinary owns bytes/transforms.

## Faster/better approach
Prove record isolation first, then port browse/detail UI. Reuse an existing private-media preview helper if available; otherwise render safe metadata/placeholders rather than inventing signing infrastructure.

## Red flags / fixes
- DB URL field treated as render authorization → separate record auth from media-byte auth.
- adding `org_id` solely for this page → unnecessary migration.
- Cloudinary Search as business DB → prohibit.
- upload/approval/export scope creep → MEDIA later.

## Score / production gate
Architecture 100 · Security 99 · Media boundary 99 · Overall **99/100 provisional**. Success = org→brand→asset isolation, safe preview behavior, no unsigned private URL leak, honest states, targeted tests/typecheck/build/network/browser.

