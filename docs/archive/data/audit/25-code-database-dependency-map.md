# 25 — Schema-aware code → database map

Status: Started 2026-09-01  
Owner: no new ticket. Product follow-up remains **IPI-1067 / IPI-1083** for shoot canonicality.  
Evidence: `git grep` on **`origin/main`** (`f3b365d`) + live FK inventory.  
**Naive `from("shoots")` is not enough.** Trace `.schema()` then `.from()`, or RPC → table.

---

## Method

```text
UI / route
  → createClient / createClientFromRequest
  → .schema(name)? 
  → .from(table) | .rpc(name)
  → actual relation
  → read / write
```

Repo tree searched: `src/**` on `origin/main`. **No** `.schema("` calls. **No** `.rpc(` calls.

---

## V2 app (`ipixai` `src/` on `origin/main`)

| Path | Client | Query | Schema.table | R/W |
| --- | --- | --- | --- | --- |
| `src/lib/auth/runtime-org.ts` | server (JWT) | `.from("org_members").select().eq(...)` | **`public.org_members`** (default schema) | **R** |
| `src/app/login/login-form.tsx` | browser | Auth only (`signIn*`) | `auth.*` via GoTrue | session |
| `src/app/auth/callback/route.ts` | server | exchange code | Auth | session |
| `src/app/auth/sign-out/route.ts` | server | signOut | Auth | session |
| `src/lib/auth/copilot-hooks.ts` | server | claims + membership via runtime-org | `public.org_members` | **R** |
| `src/mastra/pg-store.ts` | **pg Pool**, not supabase-js | PostgresStore | **`mastra.*`** (`schemaName: "mastra"`, `disableInit: true`) | R/W as **`hyperdrive_mastra_runtime`** |
| CopilotKit route | JWT → `resourceId` | Mastra memory | `mastra.mastra_threads` / `mastra_messages` | via store |

**Not queried from V2 `src/`:** `public.shoots`, `shoot.shoots`, `public.tasks`, `planner.tasks`, `public.model_profiles`, `talent.talent_profiles`, `brands`, `assets`, planner RPCs.

Mastra persistence is **not** a supabase-js `.from("mastra_threads")`. Isolation is `resourceId` in the app, not RLS for `authenticated`.

---

## Live RPCs that *do* touch dual ledgers (database, not this app)

These are the real dual-shoot wiring. V2 does not call them yet. When planner/shoot UI lands, call **these**, not `public.shoots`.

| RPC | Shoot / task / talent table | Canonical? |
| --- | --- | --- |
| `planner_create_instance` | `shoot.shoots` for `entity_type = shoot` | **Yes** |
| `create_booking_request` | `shoot.shoots` + `talent.bookings` | **Yes** |
| `get_shoot_detail` / `get_brand_assets` | `shoot.shoots`, `shoot.shoot_assets`; `public.assets` for platform rows | **Yes** for shoot; `public.assets.shoot_id` still FK → **legacy** `public.shoots` |
| `planner_*` mutations | `planner.tasks` / `planner.instances` | **Yes** (`public.tasks` unused) |

---

## Legacy FKs that block DROP `public.shoots`

Verified live: `public.assets.shoot_id` CASCADE, `crm_deals.shoot_id` NO ACTION, `commerce_product_links.shoot_id` SET NULL, plus `public.shoot_*`.

---

## Verdict

| Claim | Result |
| --- | --- |
| V2 dual-writes `public.shoots` | **No** (no shoot queries in `src/`) |
| V2 uses `shoot.shoots` | **No** — not wired yet |
| Schema-aware grep empty ≠ product complete | Correct; occupancy is planner/shoot UI later |
| Next grep when adding UI | `.schema("shoot")`, `.schema("planner")`, `.schema("talent")`, `.rpc("planner_")`, `.rpc("get_shoot")` |

**Correctness confidence: 88/100** for this repo’s `src/`. Old operator `/home/sk/ipix` was **not** scanned (policy: do not implement from it).
