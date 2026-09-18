---
title: Cloudinary media — product roadmap
horizon: Now / Next / Later
checked: 2026-09-01
ssot_status: live Linear IPI-1102
---

# Cloudinary — roadmap

Season board, not a calendar. Status: live Linear — epic **[IPI-1102 · PRODUCTION & MEDIA](https://linear.app/amo100/issue/IPI-1102)**. Mint: [todo.md](./todo.md). Product: [prd.md](../../cloudinary/prd.md). Whole-app order: [docs/roadmap.md](../../roadmap.md).

Cloudinary is **parallel** to Mastra Core — it does **not** wait for **IPI-1041 · CORE-001**. It **does** wait on AUTH (Done) and the operator shell for UI tickets.

**Mint:** create **0** extra Foundation Cloudinary tickets. **IPI-1108–1120** and **1115** already exist. Do not recreate old IPI-433 / 641 / 639. Do not mint **IPI-XXX** Post-MVP rows until after **IPI-1120** + duplicate search.

---

## Now (pipe, no widget required yet)

| Initiative | Why | Linear |
| --- | --- | --- |
| Forward migrations | Media DDL must not replay 309 old files | **IPI-1040 · MIGRATION-001** (**In Progress**) |
| SDK + env **names** | Nothing compiles without packages | **IPI-1108 · CLD-FOUNDATION-001** **Todo** — Power Start → CLI → MCP → install if missing |
| Org-safe tables | Dump RLS vs AUTH-002 | **IPI-1109 · MEDIA-DATA-001** **Todo** — read-only first; **1108 is not parallel with 1109** |
| Grants + `shoot.shoots` | Proven gaps from 1109 | **IPI-1122 · SB-MEDIA-HARDEN-001** after 1040 |
| Sign ∥ webhook ∥ delivery | Three doors of the lab | **IPI-1110** ∥ **1111** ∥ **1112** |
| E2E ∥ reconcile | Disposable upload; drift report no writes | **IPI-1113** ∥ **IPI-1114** |

Operator UI for upload/browse still needs **IPI-1065 · APP-001** (**In Progress**).

## Next (operators can use the rack)

```text
IPI-1116 · CLD-UPLOAD-001  ∥  IPI-1069 · ASSETS-001
        ↓
IPI-1118 · SHOOT-ASSETS-001
        ↓
IPI-1119 · MEDIA-APPROVAL-001
        ↓
IPI-1120 · MEDIA-DELIVERY-001
        ↓
IPI-1115 · CLD-CUTOVER-001   ← last prod webhook
```

Parent gate: **IPI-1097 · MEDIA-001** (Backlog — do not implement as one PR). Shoot list **IPI-1067** before attach-to-shoot.

Golden path: `login → shoot → CldUploadWidget → webhook 200 after persist → library → exact-version approval → named-transform delivery`.

## Later (after delivery)

| Spec | When | Notes |
| --- | --- | --- |
| **CLD-SEARCH-001** | After 1069 | Filter in **Supabase**, not Cloudinary Search |
| **CLD-META-001** | After library | Season/shoot/role on Cloudinary; org/approval stay in Postgres |
| **MEDIA-AGENT-001** | After Brand Core + 1120 | One `findAssets` tool; no delete/upload/publish |
| **MEDIA-LAUNCH-AGENT-001** | After agent | [product-launch-agent](https://github.com/cloudinary-devs/product-launch-agent) **patterns**; HITL |
| Video player, ML widget, bulk, trash UI, export manifest | After MVP | Official widgets only |
| MediaFlows, AI mod/tags, R2 backup, publish manifests | Advanced | Native Cloudinary; no invented analytics |

Check-off: [todo.md](./todo.md).
