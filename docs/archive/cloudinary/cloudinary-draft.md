---
title: Cloudinary media — layer PRD (ipixai)
status: Canonical for this folder
checked: 2026-09-02
parent: docs/prd.md
epic: IPI-1102
---

# Cloudinary — product requirements

Think of Cloudinary as the **photo lab** (negatives, named prints, courier). Supabase is the **studio ledger** (who owns the shoot, which print was approved). Next.js is the **front desk** that signs for packages. CopilotKit/Mastra may later **ask** “what do we already have?” — they do not store bytes.

This deepens [docs/prd.md](../../prd.md) (ADR-005). It does **not** replace it. Host is **Vercel**. Do **not** retarget production Cloudinary notifications until **IPI-1115 · CLD-CUTOVER-001**.

If this file disagrees with [live Linear](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2) or `package.json`, **Linear and the lockfile win**. Mint / do-not-add: [todo.md](./todo.md). Inspect GitHub first: [official-repos.md](../../cloudinary/official-repos.md).

**Today (2026-09-02):** [PR #40](https://github.com/amoai-tech/ipixai/pull/40) has the SDKs; **`origin/main` does not**. **[IPI-1108 · CLD-FOUNDATION-001](https://linear.app/amo100/issue/IPI-1108)** is Linear **Done** (merge ≠ Done). Probe: [audit-2026-09-02.md](./audit-2026-09-02.md). Auth **IPI-1037 / 1046** is **Done**. Shell **IPI-1065 · APP-001** is **In Progress**.

---

## 1. Problem

Operators still live in the old lab (`www.ipix.co` webhook). The new app has **tables** (`assets`, `cloudinary_assets`, `asset_events`) and **no pipe**: no SDK, no signed widget, no HMAC mirror, no approved delivery. July notes that say “no upload UI” in old iPix are **wrong** — V2 should COPY+CLEAN that pipe, not invent a dropzone.

Without a tenant-safe rack, Brand “reuse before shoot” and campaign crops are demos.

## 2. Outcome

A signed-in operator in **Org A**:

1. Opens a saved shoot (after **IPI-1067**).
2. Uploads selects with **`CldUploadWidget`** (signed; secret never in the browser).
3. Cloudinary notifies V2; webhook verifies **raw body**; Supabase row is Ready (`cloudinary_asset_id` + `version`).
4. Library browse is **IPI-1069** (not this pipeline’s gallery IA).
5. Approver locks **that exact version** (**IPI-1119**).
6. Delivery is a **server-signed named-transform URL** (**IPI-1120**). Org B cannot see Org A’s files.

**IPI-1097 · MEDIA-001** is the **product gate** (upload → review → approve → deliver). It is **not** one PR. Children: **1116 / 1118 / 1119 / 1120**.

## 3. Who owns what

| System | Owns | Must not own |
| --- | --- | --- |
| **Cloudinary** | Bytes, transforms, CDN, provider `asset_id` + `version`, widget transport | Org membership, approval truth, library search SoT |
| **Supabase + RLS** | Org/brand/shoot, approval, audit, business filters | Image pixels |
| **Next.js (Vercel)** | Sign route, webhook Route Handler, signed DAM URLs | Custom uploader; Cloudflare image Worker |
| **CopilotKit / Mastra** | Later `findAssets` (**MEDIA-AGENT-001**) | Delete/upload/publish; Cloudinary Search as DB |

**ASSETS-001 (1069)** = list/detail. **MEDIA-001 (1097)** = pipeline. **APPROVAL-001 (1084)** = *plan* HITL — not asset approval. **MARKETING-MEDIA (1064)** = public site — not DAM.

## 4. Constraints

- Faster path: Console → CLI (`cld login`) → MCP read-only → `cloudinary` + `next-cloudinary` → [cloudinary-examples](https://github.com/cloudinary-community/cloudinary-examples) `nextjs-clduploadwidget-signed` → COPY+CLEAN old iPix → custom last. **No** `create-cloudinary-next` over this repo.
- Sign with `api_sign_request` / widget `prepareUploadParams`. **No** hand-rolled hash. **No** Worker signer.
- `CldImage` = **public/marketing** only. Authenticated DAM = **server signed URL + named transform**.
- Webhook: `request.text()` → verify raw body + timestamp + HMAC → parse → persist → **200**. DB fail → **503**. Observe `X-Cld-Signature_v2`; do **not** implement EdDSA in Core. Do not retarget prod trigger in feature PRs.
- Forward-only migrations (**IPI-1040**). Never replay old iPix migration history. Never mutate production Supabase for this track unless the named ticket says so.
- Cloud (public name) `dzqy2ixl0` — reuse; **read-only** hosted DB audits.

## 5. Official runtime (inspect before code)

| Rank | Use |
| --- | --- |
| [cloudinary_npm](https://github.com/cloudinary/cloudinary_npm) | Sign, HMAC, upload/destroy, signed URLs |
| [next-cloudinary](https://github.com/cloudinary-community/next-cloudinary) | `CldUploadWidget`; `CldImage` public only |
| [cloudinary-examples](https://github.com/cloudinary-community/cloudinary-examples) | Signed widget + route-handler **shape** |
| [mcp-servers](https://github.com/cloudinary/mcp-servers) / [CLI](https://github.com/cloudinary/cloudinary-cli) | Inspect before coding; read-only until cutover |
| [asset-management-js](https://github.com/cloudinary/asset-management-js) | Reconcile list — not library SoT |

Later (not Core): structured metadata MCP, [product-launch-agent-single-tool](https://github.com/cloudinary-devs/product-launch-agent-single-tool) `findAssets` only. Full launch agent after Brand Core. Campaign OS essays (**12** / **13**) stay in [archive](.) — Brand loop is [../copilotkit-mastra/brand.md](../copilotkit-mastra/brand.md).

## 6. Acceptance (human-readable)

- [ ] Packages from official SDKs; no API secret in the client.
- [ ] Signed widget only; brand/shoot change gets a **fresh** signature; stale sign rejected.
- [ ] Webhook HMAC on **raw** body; replay-safe; 503 on DB fail.
- [ ] Org A ≠ Org B on assets (grants + RLS).
- [ ] Unapproved originals not anonymously fetchable; approval does not inherit to a newer version.
- [ ] One disposable upload reaches Ready on preview; fixture destroyed.
- [ ] Prod webhook stays on `www.ipix.co` until **IPI-1115** with a written rollback.

Execution: [roadmap.md](./roadmap.md). Check-off: [todo.md](./todo.md).
