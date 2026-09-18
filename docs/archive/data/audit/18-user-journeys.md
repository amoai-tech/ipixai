# 18 — User journeys

Status: Complete (architecture vs this repo + live occupancy)
Score: 58/100
Verification confidence: 80/100
Tables inspected: occupancy from 01
Code paths inspected: login + CopilotKit only
Live queries: none extra
Official references: none

## Verdict

Only **authentication → CopilotKit chat → Mastra memory** is implemented in **ipixai**. Other journeys exist as **database (and old app)** without this frontend. Hosted production proofs (restart, Org B) remain **UNVERIFIED**.

| Journey | Implemented in ipixai? | Wired correctly? | Missing? | Production blocker? | Linear |
| --- | --- | --- | --- | --- | --- |
| 1 Authentication | yes | JWT + org_members | hosted Org B proof | yes until 1125 + PR #23 | AUTH-001/002 Done; **IPI-1125** |
| 2 Planner | chat yes; SQL planner UI no | memory yes | gates 0 rows; RPC UI | Core chat no; full planner yes | **IPI-897**, gates |
| 3 Brand | no UI | DB partial | DNA/graph empty | Brand product yes | brand track |
| 4 Campaign | no UI | 3+6 rows | opportunity tables | no for Core | IPI-268 |
| 5 Shoot | no UI | schema yes | dual public.shoots; reject unproven | shoot product yes | **IPI-1067** |
| 6 Talent | no UI | 1 profile | bookings 0 | no for Core | IPI-585 |
| 7 Assets | no UI | 55 assets | sign edge missing | media product | IPI-962 |
| 8 Publishing | no | 0 rows | entire live publish | no for Core | — |
| 9 Analytics | logs 3194 | not a product UI | learning loop | no | — |

## What is correct

- Fail-closed unsigned CopilotKit.
- Split-dev.

## Errors / red flags

P1: treating live FashionOS/iPix tables as “the app is done.”

## Fixes

Now = Core hosted proofs. Later = port journeys with tickets.

## Faster/better approach

Journey matrix vs occupancy + src pages (`login`, `app`).

## Production blockers

Core: persist + tenant deny. Full OS: most journeys missing in this repo.

## Existing Linear ownership

See table.

## Verification / success criteria

- [x] Matrix
- [ ] Browser each journey — **only chat/auth in scope for this repo**

## ERD / data flow where useful

N/A — matrix is the map.

## Next step

**19 — Migrations + legacy**
