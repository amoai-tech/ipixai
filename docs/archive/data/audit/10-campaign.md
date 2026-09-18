# 10 — Campaign

Status: Complete
Score: 73/100
Verification confidence: 80/100
Tables inspected: `campaigns` (3), `campaign_deliverables` (6)
Code paths inspected: none
Live queries: row counts; CRM deal campaign FK exists (unindexed advisor)
Official references: none

## Verdict

Campaign is a **thin live slice**: 3 campaigns, 6 deliverables. Opportunity/strategy as separate tables **were not found** in the 84 public names (CRM deals 5 may be the “opportunity”). Shoot ownership is **`shoot.shoots.brand_id`**, not a required campaign FK on shoot (shoot columns listed in 04 — no `campaign_id`). Boundary: campaign can exist without a shoot; CRM `crm_deals.shoot_id` / `fk_crm_deals_campaign` are unindexed INFO.

## Current state

No `opportunities` or `strategies` tables in live public list. Closest: `crm_deals` (5) + `campaigns` (3).

## What is correct

- Dedicated campaign + deliverable tables with RLS on.
- Deliverables can describe channel requirements without owning media bytes.

## Errors / red flags

| Pri | Finding |
| --- | --- |
| P2 | No FK from `shoot.shoots` to `campaigns` — linkage may be planner `entity_type` or implicit |
| P2 | Strategy/opportunity naming not in schema |

## Fixes

- Trace `entity_type` on `planner.instances` in a follow-up query if product requires campaign→planner (NOT run: 4 instances only).
- Do not add shoot.campaign_id without product ticket.

## Faster/better approach

Table list occupancy.

## Production blockers

Campaign OS is **small**; not the Core Mastra blocker.

## Existing Linear ownership

**IPI-268** campaigns schema (history).

## Verification / success criteria

- [x] Tables exist and have rows
- [ ] UI campaign → shoot (**not this session**)

## ERD / data flow where useful

```text
crm_deals ─┬→ campaigns → campaign_deliverables
           └→ shoot_id (nullable FK, unindexed)
shoot.shoots → brands only
```

## Next step

**11 — Shoot**
