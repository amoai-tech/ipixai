# 06 — Functions, RPCs + triggers

Status: Complete (inventory; per-RPC body not all opened)
Score: 70/100
Verification confidence: 75/100
Tables inspected: function/trigger counts; DEFINER flags; cron commands; org helper `proconfig`
Code paths inspected: CopilotKit does not call SQL RPCs directly for chat
Live queries: `pg_proc` counts, `pg_trigger` counts, cron.job, `is_org_*` search_path
Official references: [Database functions](https://supabase.com/docs/guides/database/functions), SECURITY DEFINER `search_path`

## Verdict

iPix writes that JWT cannot do (shoot DML) are supposed to live in **DEFINER RPCs**. That pattern is present (planner 11 DEFINER, public 48 DEFINER). This step **did not** open every function body. Advisor list of 34 authenticated-executable DEFINERs is the **priority review queue**. Cron jobs call `expire_stale_bookings` and `expire_stale_brand_analysis`. Triggers: 75 user triggers (public 48).

## Current state

| Schema | Functions | DEFINER | Triggers |
| --- | ---: | ---: | ---: |
| extensions | 1130 | 1 | — |
| public | 400 | 48 | 48 |
| planner | 11 | 11 | 13 |
| talent | 4 | 1 | 4 |
| shoot | 2 | 0 | 2 |
| mastra | 1 | 0 | 1 |
| storage/realtime/cron/auth/vault | (platform) | | |

`is_org_member` / `is_org_owner` / `is_org_editor_or_above`: DEFINER, `search_path=public`.

Planner RPCs exposed to authenticated (from advisors): `planner_create_instance`, `planner_update_task`, `planner_shift_task`, `planner_approve_gate`, `planner_discard_gate`, `planner_invite_member`, `planner_remove_assignment`, `planner_update_role`, `planner_get_my_assignment`, `planner_get_member_names`, plus `planner.can_*` / `is_assigned` / `is_at_least`.

Domain RPCs: booking/talent/CRM convert/shoot detail/brand assets/lead claim/notifications.

**Assumption:** shoot writes use `commit_shoot_draft` (migration history) — **body not re-read this step**.

## What is correct

- Org helpers pin search_path.
- Planner mutations are DEFINER (bypass table RLS) **with** intended authz inside — must stay reviewed.
- Cron is explicit and named.

## Errors / red flags

| Pri | Finding |
| --- | --- |
| P1 | Any DEFINER without `auth.uid()` + org check is a **write-as-owner** hole — 34 WARNs need classification not panic |
| P2 | 400 public functions — FashionOS leftover surface |
| P2 | shoot schema has **0 DEFINER** functions — writes may live in `public` RPCs |

## Fixes

- **IPI-1039** classify each WARN: keep / revoke anon / tighten.
- Do not `REVOKE ALL` from authenticated.

## Faster/better approach

Advisor function names + counts. Full `pg_get_functiondef` of 48 DEFINERs deferred (would be step 06b if a P0 appears).

## Production blockers

Unclassified DEFINER is a **process** blocker for “we audited every RPC,” not proof of a live exploit.

## Existing Linear ownership

**IPI-1039 · SB-V2-003**, planner RPC family (create instance, gates), **IPI-727** shoot authz, **IPI-685** capture-lead.

## Verification / success criteria

- [x] Counts + cron + helper search_path
- [ ] Each DEFINER: purpose/caller/org/write — **partial** (advisor names only)

## ERD / data flow where useful

```text
JWT → GRANT EXECUTE on public.planner_* / booking_* 
    → DEFINER body → planner.* / talent.* / shoot.*
```

## Next step

**07 — Mastra runtime**
