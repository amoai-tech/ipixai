# 24 — SECURITY DEFINER body audit

Status: Started 2026-09-01 (read-only live `nvdlhrodvevgwdsneplk`)  
Owner ticket: **IPI-1039 · SB-V2-003 — Give Every Supabase Security Warning an Owner and Clear Action**  
Companion: [23-audit-supa.md](./23-audit-supa.md) · [21-fix-plan.md](./21-fix-plan.md) B4  

**Do not mint a Linear ticket for this file.**  
**Do not mass-revoke.** DEFINER is often the intended write door (planner / booking / shoot).  
Negative tests (own org / other org / outsider JWT) are **not run in this pass** — classify only.

Official: [Database functions](https://supabase.com/docs/guides/database/functions) — default INVOKER; when DEFINER, pin `search_path` and tightly control EXECUTE. RLS does **not** wrap function execution.

---

## Live surface

`get_advisors` security: **34** `authenticated_security_definer_function_executable` WARN, **0 ERROR**.

Catalog this pass: **35** functions with `prosecdef` + `authenticated` EXECUTE (planner 4 + public 30 + talent 1 trigger). Advisor 34 vs catalog 35 is a snapshot/linter filter difference, not a rebuild.

| `search_path` | Count | Meaning |
| --- | ---: | --- |
| `''` (empty) | 12 | Matches current Supabase guidance + schema-qualified names |
| `public` only | 3 | Org helpers — keep |
| `public, talent` / `pg_catalog, public, talent[, shoot]` / `shoot, public` | rest | Pinned, not empty — **tighten later**, not revoke |

---

## Classification (bodies opened this pass)

Legend: **KEEP** = intended DEFINER + authz present · **TIGHTEN** = keep EXECUTE, fix path/scope · **TEST** = body looks OK, needs JWT negative proof.

| Function | search_path | auth.uid / org | Verdict |
| --- | --- | --- | --- |
| `is_org_member` / `is_org_owner` / `is_org_editor_or_above` | `public` | `(select auth.uid())` + `org_members` | **KEEP** |
| `planner_create_instance` | `''` | editor/owner on `p_org_id`; entity must live in that org; `shoot.shoots` not `public.shoots` | **KEEP** · **TEST** |
| `planner_update_task` | `''` | member + assignee or contributor; CAS `expected_updated_at` | **KEEP** · **TEST** |
| `planner_approve_gate` / `planner_discard_gate` | `''` | member + role; FORBIDDEN codes | **KEEP** · **TEST** |
| `planner_shift_task` | `''` | member + assignee/contributor | **KEEP** · **TEST** — inner `SELECT … FROM planner.tasks WHERE id = v_task_id` (no `instance_id`) is a hygiene miss; update still scopes instance |
| `planner_invite_member` | `''` | manager+; unknown email indistinguishable (`user_not_available`) | **KEEP** |
| `create_booking_request` | `public, talent, shoot` | member of `p_brand_org_id`; shoot via **`shoot.shoots`** + brand org | **KEEP** · **TEST** |
| `transition_booking` | `pg_catalog, public, talent, shoot` | brand member or talent self or agency | **KEEP** · **TEST** |
| `get_or_create_shortlist` | `public, talent` | `is_org_member(p_org_id)` before insert | **KEEP** · **TEST** (caller-supplied org_id is gated) |
| `toggle_shortlist_item` | `public, talent` | member of shortlist owner org | **KEEP** · **TEST** |
| `get_shoot_detail` / `get_brand_assets` | shoot+public | `auth.uid()` + org via brand | **KEEP** — reads **canonical** `shoot.*` |
| `crm_convert_deal` | `''` | editor+ on deal’s org (not caller-supplied org) | **KEEP** · **TEST** |
| `claim_lead_draft` | `''` | `auth.uid()` + token + unclaimed | **KEEP** |
| `talent.log_booking_status_change` | `talent, public` | trigger | **KEEP** as trigger; confirm EXECUTE is not a useful client RPC |

Remaining authenticated DEFINER names (bodies **not** pasted here; same classify rule):  
`planner_get_my_assignment`, `planner_get_member_names`, `planner_remove_assignment`, `planner_update_role`, `check_talent_availability`, `create_talent_profile_with_sources`, `get_booking`, `get_own_talent_profile`, `list_bookings`, `list_notifications`, `mark_notifications_read`, `search_talent`, `is_organizer_team_member`, `planner.can_broadcast_instance`, `planner.can_subscribe_instance`, `planner.is_assigned`, `planner.is_at_least`.

---

## What this audit does **not** claim

- Cross-org JWT negative tests — **UNVERIFIED** (needs QA Org A/B).
- Anon EXECUTE — not the 34-WARN set.
- Mass `REVOKE EXECUTE` — **out of scope**.

---

## Next (still IPI-1039)

1. Finish remaining bodies (same checklist).  
2. Representative negatives: `planner_create_instance`, `planner_update_task`, `create_booking_request`, `get_or_create_shortlist`, `crm_convert_deal`.  
3. Optional: empty `search_path` on talent/booking helpers in a **forward** migration via **IPI-1040**, not repair.

**Correctness confidence: 82/100** (bodies read for the high-risk set; negatives not executed).
