# 12 — Talent + booking

Status: Complete
Score: 70/100
Verification confidence: 80/100
Tables inspected: all 8 `talent.*` + legacy `model_profiles` (3)
Code paths inspected: none
Live queries: counts, shortlist columns, bookings→shoot SET NULL
Official references: none

## Verdict

Talent OS schema is **in place** but **almost unused**: 1 profile, 7 sources, 1 shortlist, **0 bookings / history / availability / shortlist items / agency_talent**. Legacy `model_profiles` still has 3 rows. Transition RPCs exist (`create_booking_request`, `transition_booking`, cron expire). Concurrency: `bookings` version column in migration history (**IPI-339**).

## Current state

`talent_shortlists.owner_org_id` is the org key. View `talent.talent_profiles_public`. DEFINER: `search_talent`, `get_or_create_shortlist`, `toggle_shortlist_item`, booking RPCs (advisor list).

## What is correct

- Separate schema from FashionOS models.
- Booking → shoot SET NULL (no cascade wipe of bookings).
- Cron expire stale bookings.

## Errors / red flags

| Pri | Finding |
| --- | --- |
| P2 | Dual model directories (public.model_profiles vs talent) |
| P2 | Booking path unproven (0 rows) |
| P3 | Unindexed actor FKs on bookings |

## Fixes

- Do not merge model tables without a ticket.
- QA one booking lifecycle when product needs it.

## Faster/better approach

Occupancy + FK delete type.

## Production blockers

Not Core Mastra. Booking product is **schema-ready, data-empty**.

## Existing Linear ownership

**IPI-585** create talent RPC, **IPI-339/340/341** booking, **IPI-256** expire cron.

## Verification / success criteria

- [x] Schema/rows
- [ ] transition_booking race test (**not run**)

## ERD / data flow where useful

```text
owner_org → talent_shortlists → items (0)
talent_profiles → sources
bookings 0 → shoot.shoots SET NULL
```

## Next step

**13 — Assets + Cloudinary**
