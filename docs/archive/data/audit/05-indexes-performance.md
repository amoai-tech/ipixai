# 05 — Indexes + performance

Status: Complete (read-only, 2026-09-01)
Score: 68/100
Verification confidence: 80/100
Tables inspected: `pg_indexes` per schema; performance advisors (328 lints)
Code paths inspected: none
Live queries: index counts; `get_advisors` type=performance
Official references: [Query performance](https://supabase.com/docs/guides/database/query-optimization), linter unused_index / unindexed_foreign_keys / auth_rls_initplan

## Verdict

Indexes exist in volume (**634**). Advisors scream **150 unused_index INFO** and **51 unindexed FKs INFO** plus **124 auth_rls_initplan WARN**. That is **not** a mandate to drop or add indexes in bulk. Workload evidence is missing. Duplicate-index WARN = 2. pgvector is installed; **brand graph / agent embeddings tables are empty** (0 rows) so vector index pressure is theoretical.

## Current state

| Schema | Indexes |
| --- | ---: |
| public | 366 |
| auth | 87 |
| mastra | 66 |
| planner | 26 |
| talent | 23 |
| shoot | 21 |
| realtime | 20 |
| storage | 17 |
| other | 8 |

Advisor mix: unused_index 150 INFO; auth_rls_initplan 124 WARN; unindexed_foreign_keys 51 INFO; duplicate_index 2 WARN; no_primary_key 1 INFO (`mastra_workflow_snapshot`).

Unindexed FKs include planner `user_id` / `instance_id` / `org_id` on several tables, CRM composite FKs, shoot `created_by`, talent booking actor columns.

**Do not** create 51 indexes from this list. Many FKs are low-cardinality or write-rarely (`gate_approvals` 0 rows).

RLS initplan: mostly FashionOS `auth.uid()` uncached — wrap when those policies are next edited.

## What is correct

- Unique/PK indexes exist on planner/shoot/talent roots (no missing PK except Mastra snapshot).
- Prior migrations already dropped some duplicate `brand_scores` indexes (history).

## Errors / red flags

| Pri | Finding |
| --- | --- |
| P2 | 6140 workflow snapshots + 6078 schedule triggers — storage/index bloat risk |
| P2 | 150 “unused” indexes — `pg_stat_statements` not used here; unused can be false on idle tables |
| P3 | duplicate_index WARN ×2 (names not expanded in this report) |

## Fixes

- No bulk index PR.
- Next time a slow query is proven: add **that** FK index.
- Initplan wraps opportunistically with RLS edits (**IPI-1039** / FashionOS freeze).

## Faster/better approach

Dashboard advisors instead of `EXPLAIN` on unknown queries. Correct — no production workload capture in this audit.

## Production blockers

None from indexes alone.

## Existing Linear ownership

Advisor classify **IPI-1039**. No dedicated “add all FK indexes” ticket should be minted.

## Verification / success criteria

- [x] Advisors fetched
- [ ] `pg_stat_statements` top queries — **not run** (optional, would need care)

## ERD / data flow where useful

N/A — performance, not domain.

## Next step

**06 — Functions, RPCs + triggers**
