# 08 — Planner

Status: Complete (live schema + RPC names; UI concurrency **not** browser-probed)
Score: 76/100
Verification confidence: 80/100
Tables inspected: all 11 `planner.*`
Code paths inspected: CopilotKit tenant gate only (planner RPCs not traced call-by-call)
Live queries: row counts, org_id on workflows/instances, policy count 38
Official references: none extra (RLS already pulled)

## Verdict

Planner OS is **real data**: 4 workflows, 4 instances, 44 tasks, 20 dependencies, 3 assignments, **0 gate_approvals**. Gates exist as tables but **no approved-gate rows**. Mutations are DEFINER RPCs. Default table privileges for planner may still be loose until **IPI-897** applies. Realtime helpers exist in migration history (`can_broadcast_instance`).

## Current state

| Table | Rows | org_id? |
| --- | ---: | --- |
| workflows | 4 | yes |
| phases | 44 | no (via workflow) |
| instances | 4 | yes |
| tasks | 44 | no |
| dependencies | 20 | no |
| assignments | 3 | no |
| events | 5 | no |
| view_configs | 2 | no |
| gate_approvals | 0 | no |
| gate_conditions | 0 | no |
| notification_rules | 0 | no |

Idempotency: RPCs named with `p_idempotency_key` in advisors (`planner_approve_gate`, `planner_shift_task`, `planner_create_instance` history). **Bodies not re-read.**

Concurrency: `planner_update_task` takes `p_expected_updated_at` (optimistic lock) — from advisor signature.

## What is correct

- Template vs instance split.
- Gate table comment: completing tasks ≠ approved.
- Child tables keyed through instance.

## Errors / red flags

| Pri | Finding |
| --- | --- |
| P1 | IPI-897 planner default privileges **not on live 309** |
| P2 | Zero gate_approvals — HITL gate unused or untested in this DB |
| P2 | Unindexed FKs on planner (INFO only) |

## Fixes

- Apply IPI-897 after review.
- Prove a gate approve/discard in QA, not schema change.

## Faster/better approach

Live counts + advisor RPC list.

## Production blockers

Planner **ACL grants** until 897 is live. Product HITL unproven (0 approval rows).

## Existing Linear ownership

**IPI-897**, planner create-instance / gate tickets, **IPI-670** complete workflow phases.

## Verification / success criteria

- [x] Tables/rows
- [ ] Browser timeline + gate (**not this session**)

## ERD / data flow where useful

```text
org → workflows → phases
org → instances → tasks → dependencies
              → assignments
              → gate_approvals (empty)
```

## Next step

**09 — Brand Intelligence**
