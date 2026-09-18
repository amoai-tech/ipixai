# 13 — Assets + Cloudinary

Status: Complete
Score: 77/100
Verification confidence: 85/100
Tables inspected: assets 55, cloudinary_assets 27, variants 0, links 22, events 15; storage.buckets 0
Code paths inspected: none
Live queries: counts; bucket list empty
Official references: iPix decision — Cloudinary bytes, Supabase metadata

## Verdict

**Bytes are not in Supabase Storage** (0 buckets, 0 objects). Metadata lives in `assets` (55) + `cloudinary_assets` (27) + `asset_links` (22) + `asset_events` (15). Variants 0. Edge `audit-asset-dna` exists; **no** live `cloudinary-sign` / `register-asset` functions. SoT split matches policy **if** the Next app signs uploads elsewhere (NOT VERIFIED in this repo’s edge list).

## Current state

IPI-962: brand on `assets.brand_id`, not duplicate on cloudinary_assets. IPI-441 append-only events. `media_size_specs` deprecated; `image_specs` 9 rows canonical.

## What is correct

- Empty Storage matches Cloudinary-as-bytes.
- Event timeline table populated (15).
- DNA edge function deployed.

## Errors / red flags

| Pri | Finding |
| --- | --- |
| P1 | Skill/docs still mention sign/register edges that **are not** on this project |
| P2 | 55 assets vs 27 cloudinary_assets — not 1:1 |
| P2 | Dual DNA fields historically on assets vs Cloudinary (CLD-DNA-001) — not re-verified column-by-column |

## Fixes

- Document actual signer path in this repo (17).
- Do not create `ipix-assets` bucket.

## Faster/better approach

Bucket count + table occupancy.

## Production blockers

Upload widget path must be proven in UI (not this step). Metadata model is viable.

## Existing Linear ownership

**IPI-962**, **IPI-441**, **IPI-276**, **IPI-963**.

## Verification / success criteria

- [x] Storage empty, assets populated
- [ ] Browser upload → Cloudinary id on assets row

## ERD / data flow where useful

```text
Client → Cloudinary (bytes)
      → assets / cloudinary_assets (metadata)
      → asset_events
      → optional shoot/campaign links
```

## Next step

**14 — Commerce + publishing**
