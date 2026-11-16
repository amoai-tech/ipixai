---
title: Media Map
task: DESIGN-018
version: "0.1"
lastUpdated: "2026-06-29"
status: stub
ssot: ../handoff/05-feature-map.md
---

# MEDIA-MAP.md

Cloudinary + asset pipeline: upload → transform → display → DNA. **Stub** — extend with DESIGN-074a–f.  
**Handoff detail:** [05-feature-map](../handoff/05-feature-map.md) · **Stack:** [cloudinary-plan](../../cloudinary/cloudinary-plan.md) · **Architecture (canonical folder tree):** [cloudinary-architecture](../../cloudinary/cloudinary-architecture.md)

🟢 wired · 🟡 partial · ⚪ planned · 🔴 missing

---

## Asset types by screen

| Screen | Media use | Source (handoff) | Transform needs | Dot |
|--------|-----------|------------------|-----------------|:---:|
| Brand List | brand covers | Cloudinary | thumb, cover crop | ⚪ |
| Brand Detail | hero, asset tiles, image-diff HITL | Cloudinary + crawl | tile, before/after | 🟡 |
| Shoots List | shoot covers | Cloudinary | card 4:3 | ⚪ |
| Shoot Detail | captured assets per tab | Cloudinary | masonry + tile | ⚪ |
| Assets | full library, grid/table | Cloudinary | masonry, thumb, channel variants | 🟡 |
| Channel Preview | phone frames, safe zones | Cloudinary + specs API | per-channel crop | 🟡 |
| Onboarding | user uploads | Cloudinary | upload + DNA input | ⚪ |
| Command Center | brand row thumbnails | Cloudinary | small thumb | ⚪ |

Prototype images: `app/design/images/` (local only — not production).

---

## Production inventory

| Asset | Location | Dot |
|-------|----------|:---:|
| `cloudinary_assets` table | Supabase | 🟢 schema · 🔴 0 rows |
| `assets.cloudinary_public_id` | Supabase | 🟢 column |
| Thumb URL builder | `GET /api/brands/[id]/assets` | 🟡 |
| Upload (visual-identity agent) | `uploadToCloudinary()` in Mastra | 🟡 env-gated |
| Channel specs | `GET /api/media/specs` | 🟡 |
| Demo fallback URL | `channel-preview-studio.tsx` | 🟡 |

Env (server-only): `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — never `NEXT_PUBLIC_*`.

---

## Transform presets (target)

| Preset | Use | Params (draft) | Dot |
|--------|-----|------------------|:---:|
| `brand-cover` | BrandCard, list rows | `c_fill,w_400,h_300,g_auto` | ⚪ |
| `asset-tile` | Brand Detail, grid | `c_thumb,w_120,h_120,g_auto` | 🟡 |
| `asset-masonry` | Assets library | `c_limit,w_600` | ⚪ |
| `channel-ig` | Channel Preview | safe-zone from specs API | 🟡 |
| `channel-tiktok` | Channel Preview | 9:16 crop | ⚪ |
| `hitl-diff` | Approval before/after | side-by-side URLs | ⚪ |

Align naming with [cloudinary skill](../../../.agents/skills/cloudinary/SKILL.md) when presets ship.

---

## Pipeline (target — DESIGN-074)

```text
Upload (signed) → cloudinary_assets row → assets link → DNA audit (audit-asset-dna edge)
     → dna_match score → Assets UI / Channel Preview
```

| Step | Task | Owner | Dot |
|------|------|-------|:---:|
| 074a | Signed upload API | app route or edge | ⚪ |
| 074b | `cloudinary_assets` write + RLS | Supabase migration | ⚪ |
| 074c | Link to `assets` + brand | app service | ⚪ |
| 074d | DNA audit trigger | `audit-asset-dna` edge | 🟡 |
| 074e | Channel readiness transforms | visual-identity + specs | 🟡 |
| 074f | Bulk tag / replace actions | Assets panel | ⚪ |

---

## Feature → media (from handoff/05)

| Feature | Cloudinary role | Dot |
|---------|-------------------|:---:|
| Brand DNA analysis | crawl imagery + palette extraction | 🟡 |
| Asset library + DNA match | all media storage | 🔴 pipeline |
| Asset actions (use/replace/download/preview) | derivative URLs | ⚪ |
| Channel preview + publish | per-channel crops | 🟡 |
| Onboarding funnel | first upload → DNA payoff | ⚪ |

---

## Gaps vs live Supabase (2026-06-29)

| Gap | Impact | Task |
|-----|--------|------|
| 0 rows in `cloudinary_assets` | no live media pipeline | 074a–b |
| Brand-scoped assets API only | Assets screen needs global library | API-MAP |
| No upload UI in operator shell | onboarding-only path | 074a |
| IPI-151 DNA gallery blocked | Shoot Detail assets tab | IPI-151 · 074d |

---

## Next steps

1. Folder structure (canonical — see [cloudinary-architecture §2](../../cloudinary/cloudinary-architecture.md), dynamic-folder mode, `ipix/` namespace):

```
ipix/brands/{brandId}/{logo,hero,products,campaigns}
ipix/shoots/{shootId}/{raw,edited,approved}
ipix/campaigns/{campaignId}
ipix/users/{userId}
ipix/temp/
ipix/exports/{channel}/
```

2. Add signed upload route + webhook for async processing (`asset_folder` set server-side at sign time).
3. Wire AssetCard variants to preset URLs (tile vs masonry).
