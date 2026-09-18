---
title: Cloudinary media — tracker
checked: 2026-09-02
ssot_status: live Linear IPI-1102
ssot_mint: docs/cloudinary/todo.md
---

# Cloudinary — tracker

**How to use:** Work **pipe** then **widget** then **cutover**. Later rows are the full media list — **not** “create these in Linear today.”  
**Status SSOT:** live Linear — [**IPI-1102 · PRODUCTION & MEDIA**](https://linear.app/amo100/issue/IPI-1102)  
**Mint SSOT:** this file.  
**Specs:** [prd.md](../../cloudinary/prd.md) · [roadmap.md](./roadmap.md) · [official-repos.md](../../cloudinary/official-repos.md) · **URLs:** [../links.md](../../links.md)

If this file disagrees with Linear, **Linear wins**. If it disagrees with **Do not add** / **Add later**, **this file wins** on mint.

**Linear action:**

| Action | Meaning |
| --- | --- |
| **Exists — execute** | Ticket is live. Do the work. |
| **Exists — update** | Ticket is live. Strengthen ACs / `relatedTo` — **not** a new IPI. |
| **Add later** | Not in Linear as this spec. After **IPI-1120** + duplicate search, mint only if still needed. |
| **Do not add** | Invented name. Use the mapped live ticket. |

**Legend:** 🟢 Done · 🟡 In Progress · 🔵 Todo · ⚪ Backlog · **n/a** not an IPI yet

Host: **Vercel**. Split `dev:ui` / `dev:agent`. No production Cloudinary trigger change until **IPI-1115**. No production Supabase writes unless the named ticket says so.

Checked Linear **2026-09-02:** Foundation pipe **Done** (**IPI-1040**, **IPI-1108**, **IPI-1109**, **IPI-1122**, **IPI-897** live on prod). Next: **IPI-1110 ∥ 1111 ∥ 1112** after locking the shared contracts below. Lockfile has `cloudinary@^2.11.0` + `next-cloudinary`; server-only config at `src/lib/cloudinary/config.ts`.

---

## Next (do this)

**Gate:** Lock the two shared contracts below **before** coding three unrestricted parallel PRs. Biggest remaining risk is contract drift, not Cloudinary itself.

1. **Lock shared contracts** (this file + Linear AC updates on 1110/1111/1112) — upload identity + atomic webhook RPC + named/eager transform ownership.  
2. **[IPI-1110 · CLD-SIGN-001 — Sign Cloudinary Uploads for the Trusted Organization](https://linear.app/amo100/issue/IPI-1110)** — 🔵 **Exists — execute** (full sign route + correlation ID).  
3. **[IPI-1111 · CLD-WEBHOOK-001 — Mirror Cloudinary Uploads and Deletes into Supabase](https://linear.app/amo100/issue/IPI-1111)** — 🔵 **Exists — execute** in parallel (verify + transactional RPC; do **not** retarget prod trigger).  
4. **[IPI-1112 · CLD-DELIVERY-001 — Serve Org-Safe Cloudinary Previews with Named Transforms](https://linear.app/amo100/issue/IPI-1112)** — 🔵 **Exists — execute** with **read/prove first** (named transforms + eager derivatives), then delivery helper.  
5. Only after 1110/1111/1112 pass: **[IPI-1113 · CLD-E2E-001](https://linear.app/amo100/issue/IPI-1113)**.

Do **not** start **IPI-1113** until 1110/1111/1112 pass.

---

## Shared contracts (lock before coding)

Analogy: the upload is a sealed shipping label. The warehouse (webhook) must read the same label the dock (signer) printed — not guess from the box handwriting (`public_id`).

### 1. Upload identity (1110 ↔ 1111)

```text
Provider identity = Cloudinary asset_id   (immutable; not public_id)
Provider version  = Cloudinary version
Internal identity = iPix asset UUID       (server-generated at sign time)
Tenant identity   = trusted server-resolved org
Business scope    = brand + optional V2 shoot
Delivery type     = authenticated
Approval          = database event/state only
Allowed previews  = named + eagerly generated transforms only
```

Flow:

```text
iPix server creates trusted upload context
  org_id · brand_id · optional v2_shoot_id · internal asset_id UUID · schema_version
→ server signs those into Cloudinary context/metadata/folder
→ browser cannot alter them
→ Cloudinary upload
→ webhook receives signed provider payload
→ webhook resolves internal asset_id
→ persists Cloudinary asset_id + exact version
```

**Do not** infer tenant ownership by parsing a user-controlled `public_id`.

### 2. Webhook persistence = one transactional RPC (1111)

Keep one Next.js Route Handler. Persistence is **one** Postgres RPC (e.g. `apply_cloudinary_asset_event`), not sequential JS read→compare→update:

```text
POST /api/cloudinary/webhook
→ request.text() + headers
→ verifyNotificationSignature (only if live auth_scheme is default|legacy_hmac)
→ JSON.parse after verify; forward-compatible normalize
→ apply_cloudinary_asset_event(...)
     lock/compare → reject stale version
     upsert mirror → insert event ON CONFLICT DO NOTHING
     archive on delete
→ 200
DB/transient fail → 503 (Cloudinary retries ~3/6/9 min)
```

No inbox table, queue, or distributed lock by default. Prefer Cloudinary `request_id` for idempotency; if missing, deterministic fallback from verified event material — **never** a fresh UUID per delivery.

**Auth scheme gate:** verify live production trigger `auth_scheme`. HMAC path only for `default` / `legacy_hmac`. If `eddsa_v2`-only → **STOP**; do not hand-roll EdDSA.

### 3. Ownership boundaries (avoid preset collisions)

| Owner | Owns |
| --- | --- |
| **1110** | Signing endpoint · trusted upload params · asset correlation · direct-upload auth |
| **1111** | Notification verify · normalize · atomic mirror/event RPC · retry semantics |
| **1112** | Named transforms (`t_ipix_asset_masonry` / `_review` / `_detail`) · eager derivative contract · signed delivery helper |

**1112** owns named + eager contract; **1110** only consumes the resulting signed preset/config. Do not let both PRs edit the same upload preset.

### 4. Multi-org (1110 fail-closed)

`resolveTrustedRuntimeOrg()` today: 0 → onboarding · 1 → trusted · >1 → `needs_org_selection`. There is **no** trusted selected-org input yet.

- Reuse a real server-side selected-org mechanism if APP/AUTH already has one, **or**
- Scope 1110 to single-org runtime and **fail closed** for multi-org.

**Do not** take `body.orgId` from the client. **Do not** silently pick the first membership.

### 5. Delivery nuance (1112)

- Authenticated assets need **eager** derived resources; live prod assets may have `derived: []` — prove/create before claiming delivery Done.
- Stored `secure_url` is provider metadata, **not** the app authorization boundary.
- MVP signed delivery URLs are bearer URLs after server auth — acceptable; do not add token-based delivery unless product requires it.

---

## Dependency-aware parallel plan

```text
NOW
  Agent A — IPI-1110: sign route + upload-context contract + correlation ID + tests
  Agent B — IPI-1111: verify + normalize + transactional RPC + idempotency/stale/delete tests
  Agent C — IPI-1112: READ/PROVE first (named transform inventory + eager derivatives)
                      then delivery helper/tests

THEN
  Lock shared Cloudinary preset/eager contract → finish 1110/1112 integration
  → merge independently
  → IPI-1113 disposable E2E (sign → Cloudinary → webhook → Supabase → signed preview)
```

Do **not** give three agents unrestricted parallel implementation without the contracts above.

---

## Pipe (Core APIs)

```text
1040 → 1108 → 1109 → 1122 (+ 897)   ✅ live
        → 1110 ∥ 1111 ∥ 1112        ← NOW (contracts first)
        → 1113 ∥ 1114
```

| Status | Task | Linear action | Phase |
| :---: | --- | --- | --- |
| 🟢 | **[IPI-1040 · MIGRATION-001 — Prove New iPix Database Changes Can Be Added Without Replaying Old Migrations](https://linear.app/amo100/issue/IPI-1040)** | Done | Pipe |
| 🟢 | **[IPI-1108 · CLD-FOUNDATION-001 — Validate Cloudinary Tooling, SDKs, Environment, and Existing Configuration](https://linear.app/amo100/issue/IPI-1108)** | Done · `cloudinary@2.11.0` + server-only config | Pipe |
| 🟢 | **[IPI-1109 · MEDIA-DATA-001 — Prove Asset Tables Stay Org-Safe for V2](https://linear.app/amo100/issue/IPI-1109)** | Done (audit → 1122) | Pipe |
| 🟢 | **[IPI-1122 · SB-MEDIA-HARDEN-001 — Harden Supabase Media Grants and Canonical Shoot Links for Cloudinary V2](https://linear.app/amo100/issue/IPI-1122)** | Done · live prod | Pipe |
| 🟢 | **[IPI-897 · SB-SEC-009 — Lock Down Default Planner Privileges for New Tables](https://linear.app/amo100/issue/IPI-897)** | Done · live with 1122 | Pipe |
| 🔵 | **[IPI-1110 · CLD-SIGN-001 — Sign Cloudinary Uploads for the Trusted Organization](https://linear.app/amo100/issue/IPI-1110)** | Exists — execute · correlation contract | Pipe |
| 🔵 | **[IPI-1111 · CLD-WEBHOOK-001 — Mirror Cloudinary Uploads and Deletes into Supabase](https://linear.app/amo100/issue/IPI-1111)** | Exists — execute · atomic RPC · no prod retarget | Pipe |
| 🔵 | **[IPI-1112 · CLD-DELIVERY-001 — Serve Org-Safe Cloudinary Previews with Named Transforms](https://linear.app/amo100/issue/IPI-1112)** | Exists — execute · prove eager first | Pipe |
| ⚪ | **[IPI-1113 · CLD-E2E-001 — Prove One Disposable Upload Reaches Supabase Ready](https://linear.app/amo100/issue/IPI-1113)** | Exists — after 1110/1111/1112 | Pipe |
| ⚪ | **[IPI-1114 · CLD-RECONCILE-001 — Detect Cloudinary and Supabase Drift Without Mutating Production](https://linear.app/amo100/issue/IPI-1114)** | Exists — execute | Pipe |

---

## Widget + library (needs APP-001)

```text
1065 shell ∥ pipe
1116 ∥ 1069
        ↓
1067 → 1118 → 1119 → 1120
        ↓
1115 last
```

| Status | Task | Linear action | Phase |
| :---: | --- | --- | --- |
| 🟡 | **[IPI-1065 · APP-001 — Give Operators One Consistent iPix Workspace Across the App](https://linear.app/amo100/issue/IPI-1065)** | Exists — execute (shell; parallel with pipe) | Widget |
| ⚪ | **[IPI-1067 · SHOOT-001 — Let Operators Browse Shoots and Open Complete Shoot Records](https://linear.app/amo100/issue/IPI-1067)** | Exists — execute before attach-to-shoot | Widget |
| ⚪ | **[IPI-1069 · ASSETS-001 — Let Operators Browse Assets and Manage Asset Records](https://linear.app/amo100/issue/IPI-1069)** | Exists — update (thumbs via 1112; no upload in this PR) | Widget |
| ⚪ | **[IPI-1116 · CLD-UPLOAD-001 — Let Operators Upload Shoot Selects with the Cloudinary Widget](https://linear.app/amo100/issue/IPI-1116)** | Exists — execute · child of 1097 | Widget |
| ⚪ | **[IPI-1118 · SHOOT-ASSETS-001 — Attach Uploaded Assets to the Correct Saved Shoot](https://linear.app/amo100/issue/IPI-1118)** | Exists — execute · child of 1097 | Widget |
| ⚪ | **[IPI-1119 · MEDIA-APPROVAL-001 — Approve or Reject the Exact Cloudinary Asset Version](https://linear.app/amo100/issue/IPI-1119)** | Exists — execute · child of 1097 | Widget |
| ⚪ | **[IPI-1120 · MEDIA-DELIVERY-001 — Deliver Only Approved Named-Transform Asset Versions](https://linear.app/amo100/issue/IPI-1120)** | Exists — execute · child of 1097 | Widget |
| ⚪ | **[IPI-1097 · MEDIA-001 — Upload, Review, Approve, and Deliver Shoot Assets](https://linear.app/amo100/issue/IPI-1097)** | Exists — execute as **gate**, not one PR | Widget |
| ⚪ | **[IPI-1102 · PRODUCTION & MEDIA](https://linear.app/amo100/issue/IPI-1102)** | Exists — epic | Widget |
| ⚪ | **[IPI-1115 · CLD-CUTOVER-001 — Cut Cloudinary Notifications Over to V2 Safely](https://linear.app/amo100/issue/IPI-1115)** | Exists — execute **last** | Cutover |

---

## Add later (do not mint now)

| Spec | After | Notes |
| --- | --- | --- |
| **CLD-SEARCH-001** | 1069 | Filter in **Supabase** |
| **CLD-META-001** | Library | Structured metadata; org/approval stay in Postgres |
| **MEDIA-AGENT-001** | Brand Core + 1120 | One `findAssets` tool |
| **MEDIA-LAUNCH-AGENT-001** | Agent | Official launch-agent **patterns**; HITL |
| **CLD-BULK-001** | 1119 | N audit events for N ids |
| **CLD-MLW-001** | MVP | Media Library Widget pick → existing row |
| **CLD-VIDEO-001** | 1069 + 1112 | `CldVideoPlayer` |
| **CLD-TRASH-001** | 1111 delete path | Archive ≠ Cloudinary trash as SoT |
| **CLD-RECONCILE-UI-001** | 1114 | Read-only report |
| **CLD-EXPORT-001** | 1120 | Named transforms + manifest |
| **CLD-CHUNK-001** | 1116 | Widget large upload only if needed |
| **CLD-OPS-001** | 1108 | Usage pointer; no fake metrics |
| **CLD-AI-MOD-001** / **CLD-AI-TAG-001** | MVP | Native Cloudinary; store in metadata |
| **CLD-MEDIAFLOWS-001** / **CLD-SMARTCOL-001** | Named workflow | Native |
| **CLD-PUBLISH-001** | Campaigns epic | Manifests, not Postiz clone |
| **CLD-BACKUP-001** | Exit plan | R2/originals |
| **CLD-ANALYTICS-001** | Delivery | Official analytics only |

---

## Do not add

| Invented / old | Use instead |
| --- | --- |
| Duplicate **IPI-433 / 641 / 639** on v2-ipix | **1116 / 1111 / 1119** |
| Custom uploader / Worker signer | **1116** + **1110** |
| Cloudinary Search as library DB | **CLD-SEARCH-001** later + **1069** |
| **IPI-1084 · APPROVAL-001** as asset approval | Planner HITL — assets are **1119** |
| **IPI-1064 · MARKETING-MEDIA-001** as DAM | Public site |
| One-PR **MEDIA-001** | Children **1116 / 1118 / 1119 / 1120** |
| `create-cloudinary-next` over this repo | **1108** in existing Next app |
| Webhook inbox / queue / distributed lock | **1111** transactional RPC + Cloudinary retries |
| Infer tenant from `public_id` | Signed upload context + Cloudinary `asset_id` |
| Client `body.orgId` for multi-org | Fail closed or real selected-org mechanism |
| Use stored `secure_url` as browser auth | **1112** server-authorized signed named-transform URL |
| Hand-roll EdDSA if trigger is `eddsa_v2` | STOP; official path only after live scheme proof |

---

## Hard gates (ACs, not extra tickets)

- Official `cloudinary` + `next-cloudinary`; no API secret in the client.
- Signed widget; fresh sign on brand/shoot change; stale sign rejected; `type=authenticated`; reject `ai_powerstart`.
- Sign embeds internal asset UUID + org/brand/(optional) shoot — browser cannot alter.
- Multi-org: fail closed until trusted selection exists — never first-membership or client org hint.
- Webhook: raw body → verify (HMAC only if live scheme allows) → transactional RPC → **200**; DB fail **503**. Observe `X-Cld-Signature_v2`; no EdDSA until proven required.
- Stale/duplicate/concurrent versions resolved in Postgres, not app-level race.
- Org A ≠ Org B (grants + RLS). Exact `cloudinary_asset_id` + `version` for approval and delivery.
- **1112:** named transforms exist; eager derivatives proven; unsigned original/derivative fail; exact-version signed previews; no Cloudinary ACL flip on business approval.
- Prod `www.ipix.co` trigger unchanged until **1115** with rollback written.
- Slice Done only after one disposable **sign → Cloudinary → webhook → Supabase → signed preview** (then **1113**).

Dumps: [../archive/cloudinary/](.).
