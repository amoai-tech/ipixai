# 01 — Live inventory

Status: Complete (read-only, 2026-09-01)
Score: 82/100
Verification confidence: 92/100
Tables inspected: all 191 table-like objects on `nvdlhrodvevgwdsneplk` (183 ordinary + 7 partitions + 1 partitioned parent)
Code paths inspected: none required for catalog; repo `supabase/migrations/` counted
Live queries: MCP `list_projects`, `get_project`, `list_tables`, `list_extensions`, `list_edge_functions`, `list_migrations`, `execute_sql` (counts, FKs, RLS, cron, publications, views), `get_advisors` security
Official references: [Supabase Database Linter](https://supabase.com/docs/guides/database/database-linter)

## Verdict

The live project is a **shared FashionOS + iPix ledger**: 145 application tables (`public` + `mastra` + `planner` + `shoot` + `talent`) plus 46 infrastructure objects. RLS is **on for every** table in those five schemas. Canonical product schemas exist (`shoot.*`, `planner.*`, `talent.*`, `mastra.*`) **alongside** populated legacy `public.shoots` (8 rows vs `shoot.shoots` 4). This repo vendors **one** forward migration; live history has **309** applied versions. Inventory is production-usable as a map. It is **not** proof that operators can persist planner chat after restart or that Org B is denied on hosted.

## Current state

| Key | Live value |
| --- | --- |
| Project | `nvdlhrodvevgwdsneplk` (`fashionos`, `us-east-2`, Postgres 17.6.1.052, ACTIVE_HEALTHY) |
| Ordinary tables | **183** |
| Partition children | **7** (`realtime.messages_2026_08_*`) |
| Partitioned parent | **1** (`realtime.messages`) |
| **Table-like total** | **191** (matches `docs/data/tables.md`; `pg_class` relkind `r` alone is **190**) |
| Application tables | **145** (public 84 + mastra 34 + planner 11 + shoot 8 + talent 8) |
| Views (non-system) | 8 (2 public, 1 talent, 4 extensions, 1 vault) |
| RLS on app schemas | **145 on / 0 off** |
| RLS + no policy | 5 (`chatbot_*`, `processed_firecrawl_webhooks`, `media_size_specs`) — fail-closed comments on four; `media_size_specs` deprecated |
| Policies | public 285, planner 38, mastra 34, talent 26, shoot 8, realtime 2, cron 2 |
| FKs | public 148, planner 25, talent 18, auth 18, shoot 14, storage 5, **mastra 0** |
| Indexes (`pg_indexes`) | 634 across listed schemas |
| Functions (non-catalog) | public 400 (48 DEFINER), planner 11 (all DEFINER), talent 4 (1 DEFINER), mastra 1, shoot 2 |
| User triggers | 75 (public 48, planner 13, …) |
| Edge Functions | 7 ACTIVE |
| Storage buckets | **0** (`storage.buckets` empty; `storage.objects` 0) |
| pg_cron | 2 active jobs |
| Realtime pubs | `supabase_realtime` (brands, brand_crawls, brand_crawl_results) + message partitions |
| Remote migrations | **309** in `supabase_migrations.schema_migrations` |
| This repo migrations | **1** file (`20260825095051_ipi897_revoke_planner_default_privileges.sql`) — **not** in the 309 list (IPI-897 In Review) |

CLI `supabase projects list` failed (account privilege). MCP was the faster inventory path.

### Schema counts (ordinary `relkind=r`, not partitioned)

| Schema | Tables | Role |
| --- | ---: | --- |
| public | 84 | Mixed iPix + FashionOS |
| mastra | 34 | Mastra PostgresStore / Studio |
| auth | 23 | Supabase Auth |
| planner | 11 | Planner OS |
| realtime | 9 | 2 catalogs + 7 partitions (parent is `relkind=p`) |
| shoot | 8 | Canonical shoot |
| storage | 8 | Supabase Storage internals |
| talent | 8 | Talent OS |
| cron | 2 | pg_cron |
| supabase_migrations | 2 | CLI history |
| vault | 1 | Vault secrets |

### Classification

| Class | What |
| --- | --- |
| **Supabase-managed** | `auth.*`, `storage.*`, `realtime.*`, `cron.*`, `vault.secrets`, `supabase_migrations.*`, `extensions` views, `graphql_public` (function only; pg_graphql dropped per live migration `ipi680_drop_pg_graphql`) |
| **iPix-owned (canonical)** | `planner.*`, `shoot.*`, `talent.*`; in `public`: `organizations`, `org_members`, `profiles`, `brands` + brand_* intelligence, `campaigns*`, `assets` + Cloudinary/asset_* , `crm_*`, `notifications*`, `onboarding_sessions`, `ai_agent_logs`, `agent_*`, commerce/social **link** tables |
| **Mastra runtime** | all `mastra.mastra_*` |
| **Active legacy / dual** | `public.shoots` (8) vs `shoot.shoots` (4); `public.shoot_*`; `public.tasks` / `task_assignees` vs `planner.tasks`; `public.model_profiles` (3) vs `talent.talent_profiles` (1) |
| **FashionOS / events (legacy coexistence)** | `events`, `event_*`, `venues`, `ticket_tiers`, `registrations`, `stakeholders`, `fashion_*`, `sponsor_*`, `call_times`, availability tables — mostly empty except `events` 14, `event_phases` 170, `event_rehearsals` 3 |
| **Fail-closed / deprecated** | chatbot_* , `processed_firecrawl_webhooks`, `media_size_specs` (IPI-963) |
| **Unknown / leftover** | `public.supabase_migrations` (0 rows, distinct from `supabase_migrations` schema); two empty IPI-949 verify orgs (see 02) |

### Exact current counts (MCP `list_tables.rows` where listed; else `pg_stat` live_rows)

Row counts are **live snapshots**. Prefer MCP exact `rows` for app tables.

**public (84)** — MCP exact:

| Table | Rows | Table | Rows |
| --- | ---: | --- | ---: |
| venues | 0 | events | 14 |
| event_schedules | 0 | ticket_tiers | 0 |
| registrations | 0 | payments | 0 |
| event_assets | 0 | organizer_teams | 0 |
| stakeholders | 0 | event_stakeholders | 0 |
| sponsor_organizations | 0 | sponsorship_packages | 0 |
| event_sponsors | 0 | model_agencies | 0 |
| model_profiles | 3 | event_models | 0 |
| fashion_brands | 0 | event_designers | 0 |
| supabase_migrations | 0 | event_phases | 170 |
| tasks | 0 | task_assignees | 0 |
| call_times | 0 | venue_availability | 0 |
| model_availability | 0 | designer_availability | 0 |
| profiles | 2 | media_size_specs | 0 |
| organizations | 4 | shoots | 8 |
| shoot_items | 0 | shoot_assets | 0 |
| shoot_payments | 0 | assets | 55 |
| instagram_connections | 0 | instagram_posts | 0 |
| facebook_connections | 0 | facebook_posts | 0 |
| asset_variants | 0 | shopify_shops | 0 |
| shopify_products | 0 | shopify_media_links | 0 |
| amazon_connections | 0 | amazon_products | 0 |
| amazon_media_links | 0 | cloudinary_assets | 27 |
| fashion_show_designer_profiles | 0 | event_rehearsals | 3 |
| organizer_team_members | 0 | asset_links | 22 |
| brands | 7 | brand_scores | 0 |
| commerce_product_links | 0 | ai_agent_logs | 3194 |
| brand_intake_drafts | 0 | agent_context_snapshots | 0 |
| agent_decision_log | 0 | chatbot_conversations | 7 |
| chatbot_messages | 8 | chatbot_events | 8 |
| lead_intake_drafts | 10 | org_members | 3 |
| brand_social_channels | 0 | brand_competitors | 0 |
| brand_crawl_results | 40 | brand_agent_results | 0 |
| brand_crawls | 5 | brand_graph_nodes | 0 |
| brand_graph_edges | 0 | platforms | 7 |
| image_type_defs | 8 | image_specs | 9 |
| recommendation_rules | 9 | notifications | 5 |
| notification_reads | 5 | crm_companies | 4 |
| crm_contacts | 8 | crm_deals | 5 |
| crm_activities | 11 | campaigns | 3 |
| campaign_deliverables | 6 | processed_firecrawl_webhooks | 7 |
| onboarding_sessions | 78 | asset_events | 15 |

**mastra (34)** — notable non-zero: `mastra_workflow_snapshot` 6140, `mastra_schedule_triggers` 6078, `mastra_messages` 117, `mastra_threads` 50, `mastra_ai_spans` 6, `mastra_resources` 1, `mastra_schedules` 1. All others 0 including `mastra_workflow_definitions`, `mastra_observational_memory`, `mastra_agents`.

**planner (11):** workflows 4, phases 44, tasks 44, dependencies 20, instances 4, events 5, assignments 3, view_configs 2, gate_approvals 0, gate_conditions 0, notification_rules 0.

**shoot (8):** shot_type_references 49, shot_list 16, shoots 4, shoot_deliverables 4; rest 0.

**talent (8):** talent_profile_sources 7, talent_profiles 1, talent_shortlists 1; bookings 0.

**auth:** users 2, identities 2, sessions ~31, refresh_tokens ~53 (stats).

**storage:** buckets 0, objects 0, migrations 8.

**cron:** job 2.

**supabase_migrations.schema_migrations:** 309.

### Extensions (installed)

| Extension | Schema | Version |
| --- | --- | --- |
| plpgsql | pg_catalog | 1.0 |
| pg_cron | pg_catalog | 1.6.4 |
| vector | **public** | 0.8.0 |
| pg_trgm | **public** | 1.6 |
| btree_gist | **public** | 1.7 |
| pgcrypto | extensions | 1.3 |
| uuid-ossp | extensions | 1.1 |
| pg_stat_statements | extensions | 1.11 |
| pgtap | extensions | 1.2.0 |
| supabase_vault | vault | 0.3.1 |

### Edge Functions (ACTIVE)

| Slug | JWT | Version |
| --- | --- | --- |
| health | off | 39 |
| edge-test | on | 526 |
| brand-intelligence | on | 540 |
| audit-asset-dna | on | 499 |
| capture-lead | off | 499 |
| start-brand-crawl | on | 516 |
| firecrawl-webhook | off | 515 |

No `cloudinary-sign` / `register-asset` on this project (skill inventory is stale).

### Cron

1. Hourly: `select public.expire_stale_bookings();`
2. Every 2 min: `select public.expire_stale_brand_analysis();`

### Security advisor (snapshot, not a full RLS audit)

43 lints: 5 INFO `rls_enabled_no_policy`; 3 WARN extensions in `public`; 1 WARN HIBP off; 34 WARN authenticated can EXECUTE SECURITY DEFINER RPCs (expected surface — classify in 03/06, do not mass-revoke). **No ERROR lints.**

## What is correct

- Five product schemas exist and all 145 tables have RLS enabled.
- Cloudinary-as-bytes matches empty Storage buckets.
- Brand crawl Realtime publication is explicit (not `puballtables`).
- Fail-closed chatbot / webhook tables match comments (service-role only).
- Dual shoot schemas are **visible** in counts (`public.shoots` 8 vs `shoot.shoots` 4).

## Errors / red flags

| Pri | Finding |
| --- | --- |
| P1 | **Migration SSOT split:** 309 remote versions vs 1 file in this repo. Forward work is **IPI-1040 · SB-V2-004**. |
| P1 | **Dual shoot rows** — do not treat `public.shoots` as dead. |
| P1 | **mastra has zero FKs** — isolation is app-layer `resourceId` + RLS, not referential integrity to `organizations`. |
| P1 | **HIBP leaked-password protection off** — **IPI-863 · AUTH-V2-001**. |
| P2 | Extensions `vector` / `pg_trgm` / `btree_gist` in `public` (advisor WARN). Do not move without a named task. |
| P2 | `mastra_workflow_snapshot` 6140 + `mastra_schedule_triggers` 6078 — growth / leftover schedule data (step 07). |
| P3 | `public.supabase_migrations` empty duplicate name. |

## Fixes

- Do **not** drop FashionOS tables or rewrite 309 history.
- Apply planner ACL only via **IPI-897** after review (repo migration not live).
- Prove hosted persistence/ACL before schema cleanup (**IPI-1124**, PR #23).
- Classify DEFINER EXECUTE with **IPI-1039**, not a mass revoke.

## Faster/better approach

Used MCP catalog + one `pg_stat` listing instead of 191 `COUNT(*)`. CLI project list was a dead end. Advisors fetched once for 01/03.

## Production blockers

None that are **P0 stop-the-audit** (no open ERROR advisor, no RLS-off app table). Hosted Org A/B + restart persistence remain **unproven here** (not an inventory defect).

## Existing Linear ownership

| Topic | Owner |
| --- | --- |
| Forward migrations / history | **IPI-1040 · SB-V2-004 — Forward-only migrations** |
| Planner default privileges | **IPI-897 · SB-SEC-009** (In Review; not on live 309) |
| Advisor classify DEFINER | **IPI-1039 · SB-V2-003** |
| HIBP | **IPI-863 · AUTH-V2-001** |
| Shoot canonical | shoot track **IPI-1067** family |
| Mastra store / fingerprint | **IPI-1042**, **IPI-1124** |

## Verification / success criteria

- [x] Schema/table/view/function/trigger/index/FK/RLS/extension/edge/cron/realtime listed from live
- [x] All application tables named with row counts
- [x] Classification into managed / iPix / Mastra / legacy
- [ ] Hosted operator journey (out of scope for 01)

## ERD / data flow where useful

```text
auth.users (2)
    → public.profiles (2)
    → public.org_members (3) → organizations (4)
planner.* ─┐
shoot.*   ─┼─ iPix product (RLS on)
talent.*  ─┘
mastra.*  ── runtime (RLS on, no FKs to orgs)
public.shoots (8)  ── legacy parallel to shoot.shoots (4)
Cloudinary ── bytes; storage.buckets = 0
```

## Next step

**02 — Identity + organizations** → `02-identity-organizations.md`
